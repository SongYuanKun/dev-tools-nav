---
last_verified: 2026-07-14
---

# 产品路线图

> 北极星指标：有效工具使用次数
>
> 本文件是唯一活跃的产品路线图。状态值仅使用 `planned`、`in_progress`、`done`、`blocked`；每个 `done` 项必须附可复核的证据链接。

“有效工具使用”只包含格式化、转换、生成、验证、复制结果等真正获得工具价值的动作；页面访问、普通导航点击和分类切换不计入。双站数据必须保留 hostname，并先规范化 GitHub Pages 的 `/dev-tools-nav` 路径前缀。

## 固定决策

- 当前继续使用 Vanilla HTML、CSS 和 JavaScript；原创内容达到 30–50 篇，或手工模板明显拖慢迭代时，才重新评估渐进迁移。
- `tools.songyuankun.top` 与 `songyuankun.github.io/dev-tools-nav/` 两个 hostname 均保留，并继续共用现有 Umami website ID；运营查询必须分 hostname 展示。
- 当前不展示广告，核心工具首屏始终无广告。
- KMS、JRebel 等激活类内容继续保留入口，但不得进入首页精选，不展示广告、联盟或赞助内容，并从商业化转化指标中排除。
- Markdown 单一来源是已批准的目标架构，列于 Phase 2 且状态为 `planned`；当前仍有手写 HTML 与人工同步内容，不把目标态写成已落地事实。

## Phase 1：可信基础

| 工作项 | 状态 | 验收标准 | 证据 |
|---|---|---|---|
| 恢复测试并建立 CI 门禁 | done | `npm test` 全部通过；push 与 pull request 均执行 `npm ci`、`npm test` | [`scripts/*.test.mjs`](../scripts/audit-tools.test.mjs)、[测试工作流](../.github/workflows/test.yml) |
| 修复截图自动化 | done | 本地与 Actions 均稳定生成首页、博客、JSON 三张有效 PNG；JSON 截图含示例内容；失败能定位页面与步骤 | [`capture-screenshots.mjs`](../scripts/capture-screenshots.mjs)、[截图工作流](../.github/workflows/update-screenshots.yml)、[2026-07-14 Actions 成功记录](https://github.com/SongYuanKun/dev-tools-nav/actions/runs/29305839196) |
| 校验工具元数据与公开路径 | done | 工具总数 73、自研工具 10、`online-tools` 分类 11；ID 唯一；canonical 为 `/tools/*/` | [`audit-tools.mjs`](../scripts/audit-tools.mjs)、[`audit-tools.test.mjs`](../scripts/audit-tools.test.mjs) |
| 建立双 hostname 运营报表 | done | 输出 hostname、规范化路径、PV、会话、访客、有效使用次数与用户数；商业口径排除激活类内容 | [运营 SQL](../scripts/umami-operations-report.sql)、[Umami 规范](./umami-integration-spec.md) |
| 建立活跃文档职责与一致性门禁 | done | 自动检查 README 路线源、AI 路线重复、部署 manifest 结论、Markdown 目标态和历史 Prompt 归档 | [文档一致性测试](../scripts/audit-tools.test.mjs)、[文档索引](./README.md) |

### Phase 1 总体验收

| 验收项 | 状态 | 证据 / 后续动作 |
|---|---|---|
| `npm test` 全部通过 | done | [`package.json`](../package.json)、[测试工作流](../.github/workflows/test.yml) |
| CI 在 push 和 pull request 上运行 | done | [测试工作流](../.github/workflows/test.yml) |
| 三张截图在本地和 Actions 稳定生成 | done | [2026-07-14 Actions 成功记录](https://github.com/SongYuanKun/dev-tools-nav/actions/runs/29305839196)：首页、博客、JSON 三张 PNG 均生成并提交 |
| 两个 hostname 的统计可分别查看 | done | [运营 SQL](../scripts/umami-operations-report.sql)、[运营快照](./analytics-insights.md) |
| 双 hostname 汇总口径完成验收 | done | [2026-07-14 双站汇总验收](./analytics-insights.md#2026-07-14-双站汇总验收)：三期快照逐项核对；可加指标校验分站和，独立指标坚持从原始事件重新去重 |
| 关键活跃文档规则已纳入自动检查 | done | [文档一致性测试](../scripts/audit-tools.test.mjs)、[使用手册](../manual.md) |

## Phase 2：有效使用增长

| 工作项 | 状态 | 准入 / 验收标准 |
|---|---|---|
| 强化核心工具：JSON、JWT、SQL、Regex、Cron、Timestamp | planned | 每个工具具备 canonical 页、问题型教程、FAQ、真实可复制示例、相关工具互链和适用的结构化数据 |
| 建立 Markdown 单一来源流水线 | planned | `content/blog/*.md` 生成文章 HTML、博客索引、RSS/Atom、sitemap 的真实 `lastmod`、Open Graph 与结构化数据；生成物不得成为第二人工正文源 |
| 接入搜索复盘 | planned | 联合观察查询词、页面、曝光、点击、CTR、收录状态、独立有效工具用户、有效使用次数和 30 天回访 |

Phase 2 不在本阶段实施。连续 30 天有效使用用户过低的工具停止功能扩张；有曝光但 CTR 低的页面优化标题摘要；有访问但无有效使用的工具优先检查搜索意图、首屏价值和操作路径。

## Phase 3：商业化准备

| 顺序 | 工作项 | 状态 | 启用条件与约束 |
|---:|---|---|---|
| 1 | 联盟推荐 | planned | 月独立有效工具用户达到 1,000 后测试；必须披露关系并可追踪 partner、placement、tool、category |
| 2 | 工具赞助与专题合作 | planned | 联盟验证后再评估；付费关系不得改变评价结论 |
| 3 | 低密度展示广告 | planned | 月独立有效工具用户达到 5,000 后仅评估单个广告位；核心工具首屏无广告 |

商业组件默认关闭，关闭时不保留空白占位。禁止弹窗、遮挡、自动播放、诱导点击和虚构用户评价；收入实验必须同时观察出站转化、回访率和 Core Web Vitals。

商业阈值只引用运营 SQL 汇总层重新去重的独立有效工具用户，不得引用或相加路径明细；跨 hostname 合计必须同时披露浏览器身份隔离限制。
