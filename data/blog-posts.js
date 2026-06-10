/**
 * blog-posts.js
 * 博客文章数据源（纯静态，零构建）
 * 引用方式：<script src="../../data/blog-posts.js"></script>
 * 全局变量：BLOG_POSTS_DATA
 */

var BLOG_POSTS_DATA = [
  {
    slug: "why-build-dev-tools-nav",
    title: "为什么我要做一个工具导航站",
    date: "2025-03-10",
    author: "Koen",
    category: "独立开发",
    tags: ["独立开发", "个人IP", "工具站", "副业"],
    description: "从后端程序员到独立开发者，我为什么选择做一个工具导航站作为第一个作品？思路、定位、和踩过的坑。",
    readTime: "8 分钟",
    content: `
      <h2>起因：不想只写业务代码</h2>
      <p>做了7年 Java 后端，技术栈从 Spring Boot 到微服务全链路都摸过。但我越来越觉得，光做需求执行者不够——技术应该是创造价值的工具，而不只是完成别人定义好的任务。</p>
      <p>我开始想：<strong>如果我要做自己的产品，第一步应该做什么？</strong></p>

      <h2>为什么选择工具导航站？</h2>
      <p>我的判断逻辑很简单：</p>
      <ol>
        <li><strong>自己有需求</strong>：我每天都在用各种开发工具，浏览器书签早就乱成一锅粥。一个整理好的导航站，我自己就是第一个用户。</li>
        <li><strong>技术难度可控</strong>：纯静态站，不需要后端服务器，不需要数据库，部署成本为零。对于第一个独立作品来说，减少变量就是减少失败风险。</li>
        <li><strong>有 SEO 价值</strong>：工具类关键词搜索量大且稳定，"JSON 格式化"、"正则测试" 这类词每天都有开发者在搜。做好了就是被动流量。</li>
        <li><strong>可以承载个人 IP</strong>：不只是工具聚合，而是"一个程序员整理的工具合集"。有人格属性，有品牌感。</li>
      </ol>

      <h2>技术选型：为什么是纯静态？</h2>
      <p>很多人可能会问：为什么不用 Next.js / Nuxt / Astro？</p>
      <p>我的答案是：<strong>零构建 = 零维护成本</strong>。</p>
      <ul>
        <li>不需要 Node.js 运行时</li>
        <li>不需要构建步骤，改了文件直接生效</li>
        <li>GitHub Pages 免费托管，CI/CD 只需要一个 copy 动作</li>
        <li>不会遇到依赖升级、包冲突、构建失败这些问题</li>
      </ul>
      <p>对于一个内容型站点来说，纯 HTML + CSS + Vanilla JS 完全够用。数据放在 JS 文件里，改一个 JSON 就能增删工具。</p>

      <h2>架构设计</h2>
      <p>整体很简单：</p>
<pre><code>dev-tools-nav/
├── index.html          # 主页
├── css/style.css       # 全站样式（CSS 变量体系）
├── js/main.js          # 搜索、过滤、渲染逻辑
├── data/tools.js       # 工具数据
├── pages/              # 子页面
└── assets/             # 图片资源</code></pre>
      <p>核心设计原则：<strong>数据与视图分离</strong>。所有工具信息都在 <code>data/tools.js</code> 里，页面只负责渲染。添加新工具只需要往数组里加一个对象。</p>

      <h2>SEO 是怎么做的</h2>
      <p>纯静态站做 SEO 有天然优势——HTML 直出，搜索引擎爬起来毫无障碍。我做了这些：</p>
      <ul>
        <li>完整的 <code>&lt;meta&gt;</code> 标签（description, keywords, og:*, twitter:*）</li>
        <li>JSON-LD 结构化数据（WebSite + SearchAction）</li>
        <li>语义化 HTML（header/main/nav/section/article）</li>
        <li>自动生成 sitemap.xml</li>
        <li>每个工具有独立详情页，有独立 URL</li>
      </ul>

      <h2>上线后的数据</h2>
      <p>说实话，刚上线那几周流量几乎为零。但坚持更新内容、做好 SEO、在社区分享之后，开始有了自然流量。现在每天有稳定的搜索引擎来路。</p>
      <blockquote>
        <p>独立开发最重要的不是技术多牛，而是能不能持续做下去。选一个自己也会用的东西来做，比什么都重要。</p>
      </blockquote>

      <h2>总结</h2>
      <p>如果你也想尝试独立开发，我的建议是：</p>
      <ol>
        <li>从自己的需求出发</li>
        <li>技术选型越简单越好（先做出来再说）</li>
        <li>给作品加上个人属性，让它成为你的名片</li>
        <li>SEO 要从第一天就做，不要等有流量了再补</li>
      </ol>
      <p>这个工具导航站是我的第一个独立作品，也是我个人 IP 的起点。后面还会继续迭代——AI 专题、在线工具、技术博客，都会围绕这个站点展开。</p>
    `
  },
  {
    slug: "java-source-mybatis",
    title: "MyBatis 源码解析：SQL 是如何执行的",
    date: "2024-08-20",
    author: "Koen",
    category: "Java 源码",
    tags: ["Java", "MyBatis", "源码解析", "数据库"],
    description: "从一个 mapper.selectById() 调用出发，追踪 MyBatis 内部的完整执行链路：代理 → SqlSession → Executor → StatementHandler → JDBC。",
    readTime: "15 分钟",
    content: `
      <h2>前言</h2>
      <p>MyBatis 可能是 Java 后端开发用得最多的 ORM 框架之一。但你有没有想过：当你调用 <code>userMapper.selectById(1)</code> 的时候，MyBatis 内部到底发生了什么？</p>
      <p>今天我们就从源码层面，完整追踪一条 SQL 从 Mapper 接口到数据库的执行全链路。</p>

      <h2>一、Mapper 接口的代理机制</h2>
      <p>你写的 Mapper 接口没有实现类，但为什么能调用方法？答案是 <strong>JDK 动态代理</strong>。</p>
<pre><code>// MapperProxyFactory.java
public T newInstance(SqlSession sqlSession) {
    final MapperProxy&lt;T&gt; mapperProxy = new MapperProxy&lt;&gt;(sqlSession, mapperInterface, methodCache);
    return (T) Proxy.newProxyInstance(
        mapperInterface.getClassLoader(),
        new Class[]{mapperInterface},
        mapperProxy
    );
}</code></pre>
      <p>每个 Mapper 接口在运行时都会被 <code>MapperProxyFactory</code> 创建一个代理对象。当你调用接口方法时，实际执行的是 <code>MapperProxy.invoke()</code>。</p>

      <h2>二、MapperProxy → MapperMethod</h2>
      <p><code>MapperProxy</code> 拦截到方法调用后，会委托给 <code>MapperMethod</code> 处理：</p>
<pre><code>// MapperProxy.java
@Override
public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
    if (Object.class.equals(method.getDeclaringClass())) {
        return method.invoke(this, args);
    }
    final MapperMethodInvoker invoker = cachedInvoker(method);
    return invoker.invoke(proxy, method, args, sqlSession);
}</code></pre>
      <p><code>MapperMethod</code> 会根据 SQL 类型（SELECT/INSERT/UPDATE/DELETE）决定调用 SqlSession 的哪个方法。</p>

      <h2>三、SqlSession → Executor</h2>
      <p>SqlSession 是 MyBatis 的核心门面，但它不直接执行 SQL。真正的执行者是 <code>Executor</code>：</p>
      <ul>
        <li><code>SimpleExecutor</code>：每次执行都创建新的 Statement</li>
        <li><code>ReuseExecutor</code>：复用 Statement（相同 SQL 共享）</li>
        <li><code>BatchExecutor</code>：批量执行模式</li>
        <li><code>CachingExecutor</code>：包装器，增加二级缓存能力</li>
      </ul>
<pre><code>// DefaultSqlSession.java
@Override
public &lt;E&gt; List&lt;E&gt; selectList(String statement, Object parameter, RowBounds rowBounds) {
    MappedStatement ms = configuration.getMappedStatement(statement);
    return executor.query(ms, wrapCollection(parameter), rowBounds, Executor.NO_RESULT_HANDLER);
}</code></pre>

      <h2>四、Executor → StatementHandler</h2>
      <p>Executor 拿到 <code>MappedStatement</code>（包含 SQL 模板、参数映射、结果映射），接下来要：</p>
      <ol>
        <li>检查一级缓存（PerpetualCache）</li>
        <li>缓存未命中，创建 <code>StatementHandler</code></li>
        <li>StatementHandler 负责：创建 JDBC Statement → 设置参数 → 执行 SQL → 处理结果集</li>
      </ol>
<pre><code>// SimpleExecutor.java
private Statement prepareStatement(StatementHandler handler, Log statementLog) throws SQLException {
    Statement stmt;
    Connection connection = getConnection(statementLog);
    stmt = handler.prepare(connection, transaction.getTimeout());
    handler.parameterize(stmt);  // 设置参数
    return stmt;
}</code></pre>

      <h2>五、参数设置：ParameterHandler</h2>
      <p>SQL 中的 <code>#{id}</code> 是怎么变成实际值的？<code>ParameterHandler</code> 负责这件事：</p>
<pre><code>// DefaultParameterHandler.java
@Override
public void setParameters(PreparedStatement ps) {
    List&lt;ParameterMapping&gt; parameterMappings = boundSql.getParameterMappings();
    for (int i = 0; i &lt; parameterMappings.size(); i++) {
        ParameterMapping parameterMapping = parameterMappings.get(i);
        Object value = /* 通过反射从参数对象中取值 */;
        TypeHandler typeHandler = parameterMapping.getTypeHandler();
        typeHandler.setParameter(ps, i + 1, value, parameterMapping.getJdbcType());
    }
}</code></pre>
      <p>核心机制：通过 <code>TypeHandler</code> 实现 Java 类型到 JDBC 类型的转换。</p>

      <h2>六、结果集映射：ResultSetHandler</h2>
      <p>SQL 执行完，JDBC 返回 <code>ResultSet</code>，MyBatis 需要把它映射成 Java 对象：</p>
      <ul>
        <li>根据 <code>&lt;resultMap&gt;</code> 或注解确定映射规则</li>
        <li>通过反射创建目标对象</li>
        <li>逐列调用 <code>TypeHandler.getResult()</code> 取值并设置属性</li>
        <li>处理嵌套查询、延迟加载等复杂场景</li>
      </ul>

      <h2>七、完整调用链</h2>
<pre><code>userMapper.selectById(1)
  → MapperProxy.invoke()
    → MapperMethod.execute()
      → SqlSession.selectOne()
        → CachingExecutor.query()      // 检查二级缓存
          → BaseExecutor.query()       // 检查一级缓存
            → SimpleExecutor.doQuery()
              → StatementHandler.prepare()    // 创建 Statement
              → ParameterHandler.setParameters() // 设置参数
              → StatementHandler.query()      // 执行 SQL
              → ResultSetHandler.handleResultSets() // 映射结果</code></pre>

      <h2>总结</h2>
      <p>MyBatis 的设计思路非常清晰：<strong>职责分离 + 模板方法</strong>。每一层只做一件事：</p>
      <ul>
        <li><code>MapperProxy</code>：接口代理入口</li>
        <li><code>SqlSession</code>：API 门面</li>
        <li><code>Executor</code>：执行策略（缓存/复用/批量）</li>
        <li><code>StatementHandler</code>：JDBC 操作封装</li>
        <li><code>ParameterHandler</code> / <code>ResultSetHandler</code>：类型转换</li>
      </ul>
      <p>理解了这个链路，你再遇到 MyBatis 的问题（缓存失效、参数绑定异常、结果映射错误），就知道该去哪一层找原因了。</p>

      <blockquote>
        <p>源码不是用来背的，是用来解决问题的。当你遇到 bug 时能直接定位到对应的源码位置，这才是读源码的价值。</p>
      </blockquote>
    `
  }
];

/**
 * 博客分类（列表页筛选用）
 */
var BLOG_CATEGORIES = [
  { id: "all", label: "全部" },
  { id: "独立开发", label: "独立开发" },
  { id: "AI 实践", label: "AI 实践" },
  { id: "Java 源码", label: "Java 源码" },
  { id: "后端架构", label: "后端架构" },
  { id: "前端", label: "前端" }
];

/**
 * 博客列表数据（兼容 index.html 渲染逻辑）
 * 站内文章用 url 指向 post.html?slug=xxx
 * 外部文章用 externalUrl 指向 CSDN
 */
var BLOG_POSTS = [
  {
    title: "AI 免费 Token / 额度薅羊毛手册",
    description: "各平台免费额度、限流与绑卡说明，及常见踩坑备忘。适合小白与初体验程序员。",
    date: "2026-03-30",
    category: "AI 实践",
    tags: ["AI", "免费额度", "API", "OpenAI"],
    readTime: 18,
    url: "ai-free-tokens-handbook.html",
    featured: true,
    status: "published"
  },
  // === 站内全文 ===
  {
    title: "为什么我要做一个工具导航站",
    description: "从后端程序员到独立开发者，我为什么选择做一个工具导航站作为第一个作品？思路、定位、和踩过的坑。",
    date: "2025-03-10",
    category: "独立开发",
    tags: ["独立开发", "个人IP", "工具站"],
    readTime: 8,
    url: "post.html?slug=why-build-dev-tools-nav",
    status: "published"
  },
  {
    title: "MyBatis 源码解析：SQL 是如何执行的",
    description: "从 mapper.selectById() 出发，追踪 MyBatis 内部完整执行链路：代理 → SqlSession → Executor → StatementHandler → JDBC。",
    date: "2024-08-20",
    category: "Java 源码",
    tags: ["Java", "MyBatis", "源码解析"],
    readTime: 15,
    url: "post.html?slug=java-source-mybatis",
    status: "published"
  },
  // === 外部文章（CSDN） ===
  {
    title: "LongAdder 源码解析：高并发计数器的设计思路",
    description: "深入分析 JDK LongAdder 如何通过分段 Cell 数组和 CAS 策略实现高并发下的高效计数。",
    date: "2024-06-15",
    category: "Java 源码",
    tags: ["Java", "并发", "源码解析"],
    readTime: 12,
    externalUrl: "https://blog.csdn.net/syk123839070",
    status: "published"
  },
  {
    title: "MySQL binlog 主从同步原理详解",
    description: "从 binlog 格式、dump 线程、IO 线程到 SQL 线程，全面剖析 MySQL 主从复制的底层机制。",
    date: "2024-04-08",
    category: "后端架构",
    tags: ["MySQL", "主从同步", "binlog"],
    readTime: 14,
    externalUrl: "https://blog.csdn.net/syk123839070",
    status: "published"
  },
  {
    title: "Redis 持久化：RDB vs AOF 深度对比",
    description: "从实现原理、性能影响、数据安全性三个维度，对比 Redis 两种持久化方案的优劣和适用场景。",
    date: "2024-02-20",
    category: "后端架构",
    tags: ["Redis", "持久化", "架构"],
    readTime: 10,
    externalUrl: "https://blog.csdn.net/syk123839070",
    status: "published"
  },
  {
    title: "Spring Boot 自动配置原理揭秘",
    description: "从 @EnableAutoConfiguration 到 spring.factories，追踪 Spring Boot 自动配置的完整加载链路。",
    date: "2023-11-10",
    category: "Java 源码",
    tags: ["Spring Boot", "自动配置", "源码"],
    readTime: 11,
    externalUrl: "https://blog.csdn.net/syk123839070",
    status: "published"
  }
];
