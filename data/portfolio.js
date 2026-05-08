/**
 * Portfolio / Case Study 数据文件
 * 全局变量方式导出（零构建纯静态站点）
 * 
 * 字段说明：
 * - id:          唯一标识符
 * - name:        项目名称
 * - description: 项目简介（1-2句话）
 * - longDesc:    详细描述（Case Study 用）
 * - techStack:   技术栈数组
 * - status:      项目状态 "active" | "maintained" | "archived" | "beta"
 * - category:    分类标签
 * - liveUrl:     线上地址（可为null）
 * - sourceUrl:   源码地址（可为null）
 * - thumbnail:   缩略图路径（可为null，使用占位）
 * - highlights:  亮点数组
 * - year:        年份
 */

var PORTFOLIO_DATA = [
  {
    id: "devtools-nav",
    name: "Koen的工具箱",
    description: "精选 60+ 款开发者常用工具导航站，纯静态实现，覆盖开发、建站、安全、运维、设计全流程。",
    longDesc: "从零打造的个人 IP 站点，基于纯静态架构（零构建零依赖），涵盖工具导航、AI 专题、在线工具、技术博客四大模块。完整 SEO 优化，Lighthouse 评分 95+，支持暗色模式与响应式设计。",
    techStack: ["HTML5", "CSS3", "Vanilla JS", "JSON-LD", "GitHub Actions"],
    status: "active",
    category: "Web 应用",
    liveUrl: "https://tools.songyuankun.top/",
    sourceUrl: "https://github.com/SongYuanKun/dev-tools-nav",
    thumbnail: null,
    highlights: [
      "60+ 精选工具，分类筛选 + 实时搜索",
      "完整 SEO 元数据 + JSON-LD 结构化",
      "暗色模式 + 响应式全适配",
      "彩蛋系统：5 种趣味解锁方式"
    ],
    year: 2025
  },
  {
    id: "online-tools",
    name: "在线工具集",
    description: "8 个纯前端开发工具：JSON 格式化、正则测试、时间戳转换、Cron 表达式、JWT 解析等。",
    longDesc: "面向开发者的轻量在线工具集合，所有计算均在浏览器端完成，无需后端服务。每个工具独立页面，支持 URL 参数传入数据，可作为 SEO 流量入口引流个人 IP。",
    techStack: ["HTML5", "CSS3", "Vanilla JS", "Monaco Editor"],
    status: "active",
    category: "效率工具",
    liveUrl: "https://tools.songyuankun.top/pages/tools/index.html",
    sourceUrl: "https://github.com/SongYuanKun/dev-tools-nav",
    thumbnail: null,
    highlights: [
      "纯前端处理，零后端依赖",
      "8 个高频工具覆盖日常开发",
      "独立页面利于 SEO 长尾流量",
      "URL 参数支持，可分享结果"
    ],
    year: 2025
  },
  {
    id: "ai-topic",
    name: "AI 专题系列",
    description: "深度横评 6 类 AI 工具 + Prompt 模板库 + 场景工作流 + 术语与选型指南。",
    longDesc: "国内最全的 AI 工具静态手册：覆盖对话/编程/绘图/搜索/视频/翻译 6 类横评，配套 Prompt 模板库、场景工作流、新手入门、隐私安全清单。数据驱动渲染，模块化设计，适合持续更新。",
    techStack: ["HTML5", "CSS3", "Vanilla JS", "数据驱动渲染"],
    status: "active",
    category: "Web 应用",
    liveUrl: "https://tools.songyuankun.top/pages/ai/index.html",
    sourceUrl: "https://github.com/SongYuanKun/dev-tools-nav",
    thumbnail: null,
    highlights: [
      "6 类 AI 横评（对话/编程/绘图/搜索/视频/翻译）",
      "Prompt 模板库 + 场景工作流",
      "术语表 + 选型原则 + 隐私安全清单",
      "数据与视图分离，易维护更新"
    ],
    year: 2026
  },
  {
    id: "jrebel-service",
    name: "JRebel 激活服务",
    description: "自动化 JRebel License 分发服务，GitHub Actions 定时同步可用地址。",
    longDesc: "解决 Java 开发者 JRebel 热部署插件的激活需求。通过 GitHub Actions 定时探测多个激活服务器可用性，自动更新配置并同步到前端展示页。无需手动维护，全自动化运转。",
    techStack: ["GitHub Actions", "Node.js", "Cron", "JSON API"],
    status: "maintained",
    category: "DevOps",
    liveUrl: "https://tools.songyuankun.top/pages/jrebel.html",
    sourceUrl: "https://github.com/SongYuanKun/dev-tools-nav",
    thumbnail: null,
    highlights: [
      "GitHub Actions 定时自动探测",
      "多服务器可用性同步",
      "零人工维护，全自动化",
      "前端一键复制激活地址"
    ],
    year: 2025
  },
  {
    id: "tech-blog",
    name: "技术博客",
    description: "19 篇深度原创文章，5.9w+ 阅读量，专注 Java 源码解析与后端架构设计。",
    longDesc: "持续输出的技术内容体系，涵盖 MyBatis 源码解析、Spring Boot 实战、MySQL 性能优化、Redis 原理等主题。从源码级深度切入，用清晰的图文帮助开发者理解底层原理。",
    techStack: ["Java", "Spring Boot", "MySQL", "Redis", "MyBatis"],
    status: "active",
    category: "内容创作",
    liveUrl: "https://blog.csdn.net/syk123839070",
    sourceUrl: null,
    thumbnail: null,
    highlights: [
      "19 篇深度原创，平均 3000+ 字/篇",
      "累计 5.9w+ 阅读量",
      "Java 源码系列（MyBatis/LongAdder/binlog）",
      "从源码到实战的完整闭环"
    ],
    year: 2024
  }
];

/**
 * 状态映射表（用于UI渲染）
 */
var PORTFOLIO_STATUS_MAP = {
  active:     { label: "活跃开发", color: "#10b981", icon: "🟢" },
  maintained: { label: "维护中",   color: "#f59e0b", icon: "🟡" },
  beta:       { label: "Beta测试", color: "#6366f1", icon: "🟣" },
  archived:   { label: "已归档",   color: "#6b7280", icon: "⚪" }
};
