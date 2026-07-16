---
title: MyBatis 源码解析：SQL 是如何执行的
date: 2024-08-20
updated: 2024-08-20
description: 从一个 mapper.selectById() 调用出发，追踪 MyBatis 内部的完整执行链路：代理、SqlSession、Executor、StatementHandler 与 JDBC。
keywords: Java, MyBatis, 源码解析, SQL 执行, JDBC
category: Java 源码
tags: [Java, MyBatis, 源码解析, 数据库]
kicker: 源码级探索 · Java
slug: java-source-mybatis
---

## 前言

MyBatis 可能是 Java 后端开发用得最多的 ORM 框架之一。但你有没有想过：当你调用 `userMapper.selectById(1)` 的时候，MyBatis 内部到底发生了什么？

今天我们就从源码层面，完整追踪一条 SQL 从 Mapper 接口到数据库的执行全链路。

## 一、Mapper 接口的代理机制

你写的 Mapper 接口没有实现类，但为什么能调用方法？答案是 **JDK 动态代理**。

```java
// MapperProxyFactory.java
public T newInstance(SqlSession sqlSession) {
    final MapperProxy<T> mapperProxy = new MapperProxy<>(sqlSession, mapperInterface, methodCache);
    return (T) Proxy.newProxyInstance(
        mapperInterface.getClassLoader(),
        new Class[]{mapperInterface},
        mapperProxy
    );
}
```

每个 Mapper 接口在运行时都会被 `MapperProxyFactory` 创建一个代理对象。当你调用接口方法时，实际执行的是 `MapperProxy.invoke()`。

## 二、MapperProxy → MapperMethod

`MapperProxy` 拦截到方法调用后，会委托给 `MapperMethod` 处理：

```java
// MapperProxy.java
@Override
public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
    if (Object.class.equals(method.getDeclaringClass())) {
        return method.invoke(this, args);
    }
    final MapperMethodInvoker invoker = cachedInvoker(method);
    return invoker.invoke(proxy, method, args, sqlSession);
}
```

`MapperMethod` 会根据 SQL 类型（SELECT/INSERT/UPDATE/DELETE）决定调用 SqlSession 的哪个方法。

## 三、SqlSession → Executor

SqlSession 是 MyBatis 的核心门面，但它不直接执行 SQL。真正的执行者是 `Executor`：

- `SimpleExecutor`：每次执行都创建新的 Statement
- `ReuseExecutor`：复用 Statement（相同 SQL 共享）
- `BatchExecutor`：批量执行模式
- `CachingExecutor`：包装器，增加二级缓存能力

```java
// DefaultSqlSession.java
@Override
public <E> List<E> selectList(String statement, Object parameter, RowBounds rowBounds) {
    MappedStatement ms = configuration.getMappedStatement(statement);
    return executor.query(ms, wrapCollection(parameter), rowBounds, Executor.NO_RESULT_HANDLER);
}
```

## 四、Executor → StatementHandler

Executor 拿到 `MappedStatement`（包含 SQL 模板、参数映射、结果映射），接下来要：

1. 检查一级缓存（PerpetualCache）
2. 缓存未命中，创建 `StatementHandler`
3. StatementHandler 负责：创建 JDBC Statement → 设置参数 → 执行 SQL → 处理结果集

```java
// SimpleExecutor.java
private Statement prepareStatement(StatementHandler handler, Log statementLog) throws SQLException {
    Statement stmt;
    Connection connection = getConnection(statementLog);
    stmt = handler.prepare(connection, transaction.getTimeout());
    handler.parameterize(stmt);  // 设置参数
    return stmt;
}
```

## 五、参数设置：ParameterHandler

SQL 中的 `#{id}` 是怎么变成实际值的？`ParameterHandler` 负责这件事：

```java
// DefaultParameterHandler.java
@Override
public void setParameters(PreparedStatement ps) {
    List<ParameterMapping> parameterMappings = boundSql.getParameterMappings();
    for (int i = 0; i < parameterMappings.size(); i++) {
        ParameterMapping parameterMapping = parameterMappings.get(i);
        Object value = /* 通过反射从参数对象中取值 */;
        TypeHandler typeHandler = parameterMapping.getTypeHandler();
        typeHandler.setParameter(ps, i + 1, value, parameterMapping.getJdbcType());
    }
}
```

核心机制：通过 `TypeHandler` 实现 Java 类型到 JDBC 类型的转换。

## 六、结果集映射：ResultSetHandler

SQL 执行完，JDBC 返回 `ResultSet`，MyBatis 需要把它映射成 Java 对象：

- 根据 `<resultMap>` 或注解确定映射规则
- 通过反射创建目标对象
- 逐列调用 `TypeHandler.getResult()` 取值并设置属性
- 处理嵌套查询、延迟加载等复杂场景

## 七、完整调用链

```text
userMapper.selectById(1)
  → MapperProxy.invoke()
    → MapperMethod.execute()
      → SqlSession.selectOne()
        → CachingExecutor.query()      // 检查二级缓存
          → BaseExecutor.query()       // 检查一级缓存
            → SimpleExecutor.doQuery()
              → StatementHandler.prepare()    // 创建 Statement
              → ParameterHandler.setParameters() // 设置参数
              → StatementHandler.query()      // 执行 SQL
              → ResultSetHandler.handleResultSets() // 映射结果
```

## 总结

MyBatis 的设计思路非常清晰：**职责分离 + 模板方法**。每一层只做一件事：

- `MapperProxy`：接口代理入口
- `SqlSession`：API 门面
- `Executor`：执行策略（缓存/复用/批量）
- `StatementHandler`：JDBC 操作封装
- `ParameterHandler` / `ResultSetHandler`：类型转换

理解了这个链路，你再遇到 MyBatis 的问题（缓存失效、参数绑定异常、结果映射错误），就知道该去哪一层找原因了。

> 源码不是用来背的，是用来解决问题的。当你遇到 bug 时能直接定位到对应的源码位置，这才是读源码的价值。
