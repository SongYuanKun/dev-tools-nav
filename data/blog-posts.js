/**
 * 博客文章元数据
 * 原创文章先发自己的站，24h 后同步到 CSDN/掘金
 * status: published | draft
 */
const BLOG_POSTS = [
  {
    id: "why-build-dev-tools-nav",
    title: "为什么一个程序员，会花3天做一个导航站？",
    description: "从想法到实现，从功能到体验，记录 Dev Tools Nav 的诞生过程和独立开发的思考。",
    date: "2026-03-20",
    tags: ["独立开发", "个人项目", "思考"],
    category: "独立开发",
    readTime: 5,
    status: "published",
    url: "why-build-dev-tools-nav.html",
  },
  {
    id: "java-longadder-source",
    title: "LongAdder 源码分析：高性能计数器的设计哲学",
    description: "深入剖析 Java 8 引入的 LongAdder，对比 AtomicLong 的优化思路，理解分段锁与伪共享的工程实践。",
    date: "2025-03-16",
    tags: ["Java", "并发", "源码分析"],
    category: "Java 深度",
    readTime: 12,
    status: "published",
    externalUrl: "https://blog.csdn.net/syk123839070/article/details/146295861",
  },
  {
    id: "mysql-replication-read-write",
    title: "MySQL 主从复制原理与读写分离实践",
    description: "详解 MySQL binlog 同步机制、主从复制原理及读写分离的架构设计与落地方案。",
    date: "2021-08-24",
    tags: ["MySQL", "数据库", "架构"],
    category: "数据库",
    readTime: 10,
    status: "published",
    externalUrl: "https://blog.csdn.net/syk123839070/article/details/119880973",
  },
  {
    id: "jenkins-sonarqube-integration",
    title: "Jenkins + SonarQube 持续集成踩坑记录",
    description: "Jenkins 集成 SonarQube 代码质量检测的完整配置与常见问题解决方案。",
    date: "2018-03-09",
    tags: ["Jenkins", "DevOps", "代码质量"],
    category: "DevOps",
    readTime: 8,
    status: "published",
    externalUrl: "https://blog.csdn.net/syk123839070/article/details/79483873",
  },
];

const BLOG_CATEGORIES = [
  { id: "all", label: "全部文章" },
  { id: "独立开发", label: "独立开发" },
  { id: "Java 深度", label: "Java 深度" },
  { id: "数据库", label: "数据库" },
  { id: "DevOps", label: "DevOps" },
];
