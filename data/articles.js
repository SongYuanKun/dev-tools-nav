/**
 * 文章/动态数据
 * platform: CSDN | 掘金 | GitHub | 博客 | Bilibili
 */
const ARTICLES_DATA = [
  // 在 CSDN 发布文章后，按以下格式添加：
  // {
  //   title: "文章标题",
  //   description: "文章简介",
  //   date: "2026-03-14",
  //   url: "https://blog.csdn.net/syk123839070/article/details/xxx",
  //   tags: ["标签1", "标签2"],
  //   platform: "CSDN",
  // },
];

/**
 * 个人项目作品集
 */
const PROJECTS_DATA = [
  {
    name: "Dev Tools Nav",
    description: "精选开发者工具导航站，覆盖开发、建站、安全、运维、设计全流程，支持暗色模式与搜索筛选。",
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
