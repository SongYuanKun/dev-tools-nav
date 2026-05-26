/**
 * 文章/动态数据（静态兜底：首页优先加载 data/csdn-articles.json，由 CI 从 CSDN RSS 生成）
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
