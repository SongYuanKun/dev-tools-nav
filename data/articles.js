/**
 * 文章/动态数据
 * platform: CSDN | 掘金 | GitHub | 博客 | Bilibili
 */
const ARTICLES_DATA = [
  {
    title: "LongAdder源码分析",
    description: "深入剖析 Java 8 引入的高性能计数器，对比 AtomicLong 的优化思路与适用场景",
    date: "2025-03-16",
    url: "https://blog.csdn.net/syk123839070/article/details/146295861",
    tags: ["Java", "并发", "源码分析"],
    platform: "CSDN",
    views: 1068,
  },
  {
    title: "MySQL的replication是如何做到读写分离的",
    description: "详解 MySQL 主从复制原理、binlog 同步机制及读写分离实践",
    date: "2021-08-24",
    url: "https://blog.csdn.net/syk123839070/article/details/119880973",
    tags: ["MySQL", "数据库", "架构"],
    platform: "CSDN",
    views: 545,
  },
  {
    title: "sourceTree使用教程",
    description: "Git 可视化工具 SourceTree 的完整使用指南，从克隆到分支管理",
    date: "2019-04-12",
    url: "https://blog.csdn.net/syk123839070/article/details/82534968",
    tags: ["Git", "工具", "教程"],
    platform: "CSDN",
    views: 13795,
  },
  {
    title: "华为云Devcloud将本地代码提交到代码托管的步骤",
    description: "华为云 DevCloud 代码托管完整流程，从配置到首次推送",
    date: "2018-08-10",
    url: "https://blog.csdn.net/syk123839070/article/details/80276792",
    tags: ["Git", "DevOps", "华为云"],
    platform: "CSDN",
    views: 15090,
  },
  {
    title: "Jenkins+sonarqube+sonar-scanner持续集成遇到的问题",
    description: "Jenkins 集成 SonarQube 代码质量检测的踩坑记录与解决方案",
    date: "2018-03-09",
    url: "https://blog.csdn.net/syk123839070/article/details/79483873",
    tags: ["Jenkins", "DevOps", "代码质量"],
    platform: "CSDN",
    views: 9223,
  },
  {
    title: "form表单上传文件+接口中转至oss",
    description: "前端表单直传 + 后端接口转发到阿里云 OSS 的完整实现方案",
    date: "2018-03-26",
    url: "https://blog.csdn.net/syk123839070/article/details/79697583",
    tags: ["Java", "OSS", "文件上传"],
    platform: "CSDN",
    views: 2066,
  },
];

/**
 * 个人项目作品集
 */
const PROJECTS_DATA = [
  {
    name: "Dev Tools Nav",
    description: "一个从实战中长出来的工具导航站——收录的都是我日常开发真正在用的工具。从前端到部署、从产品到运维，这是我走向全栈与独立开发的第一次尝试。",
    url: "https://github.com/SongYuanKun/dev-tools-nav",
    tags: ["前端", "开源", "工具"],
    status: "active",
  },
];

/**
 * 成长时间线（仅记录技术探索和项目里程碑，不涉及个人隐私）
 */
const TIMELINE_DATA = [
  {
    year: "2026",
    events: [
      { month: "03", title: "Dev Tools Nav 正式上线", description: "第一个独立开发项目发布，收录 30+ 款精选工具" },
      { month: "02", title: "探索前端技术栈", description: "从纯后端走向全栈，学习原生 JS/CSS 构建完整项目" },
      { month: "01", title: "开启独立开发之路", description: "决定不再只写业务代码，开始用技术做自己的产品" },
    ],
  },
  {
    year: "2025",
    events: [
      { month: "11", title: "开始技术博客写作", description: "在 CSDN 持续输出 Java / Spring Boot 技术文章" },
      { month: "06", title: "深入 Spring Cloud 微服务", description: "学习并实践微服务架构、服务注册发现、网关和链路追踪" },
      { month: "01", title: "容器化实践", description: "开始使用 Docker + Docker Compose 管理开发和部署环境" },
    ],
  },
  {
    year: "2024",
    events: [
      { month: "09", title: "接触开源社区", description: "在 GitHub 参与开源项目，提交第一个 PR" },
      { month: "03", title: "系统学习 MySQL 调优", description: "深入索引原理、慢查询分析、事务与锁机制" },
    ],
  },
];

/**
 * 技术栈数据
 */
const TECH_STACK = [
  { name: "Java", level: 90, icon: "☕", category: "后端" },
  { name: "Spring Boot", level: 90, icon: "🍃", category: "后端" },
  { name: "Spring Cloud", level: 75, icon: "☁️", category: "后端" },
  { name: "MyBatis / MyBatis-Plus", level: 85, icon: "📐", category: "后端" },
  { name: "Maven", level: 85, icon: "📦", category: "后端" },
  { name: "MySQL", level: 85, icon: "🐬", category: "数据库" },
  { name: "Redis", level: 80, icon: "🔴", category: "数据库" },
  { name: "RabbitMQ / Kafka", level: 65, icon: "📨", category: "中间件" },
  { name: "Elasticsearch", level: 60, icon: "🔍", category: "中间件" },
  { name: "JavaScript", level: 70, icon: "⚡", category: "前端" },
  { name: "Vue.js", level: 65, icon: "💚", category: "前端" },
  { name: "HTML / CSS", level: 70, icon: "🎨", category: "前端" },
  { name: "Docker", level: 75, icon: "🐳", category: "运维" },
  { name: "Linux", level: 75, icon: "🐧", category: "运维" },
  { name: "Nginx", level: 70, icon: "🌐", category: "运维" },
  { name: "Git", level: 85, icon: "🔀", category: "工具" },
];
