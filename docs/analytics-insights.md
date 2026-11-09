# Umami 运营快照与复盘

> Website ID：`99e14cad-6300-4f3c-83d2-b3b71c7d6a25` · 快照日期：2026-07-13 · 运营时区：Asia/Shanghai · 观察窗口：最近 7 天、最近 30 天、此前 30 天

## 可信口径

- 只统计 `tools.songyuankun.top` 与 `songyuankun.github.io`。报表同时提供分路径、分 hostname 和 all-hosts 三层结果，汇总层必须从原始事件重算，不能把明细行相加。
- GitHub Pages 的 `/dev-tools-nav` 仓库前缀在报表中移除。例如 `/dev-tools-nav/tools/json/` 归一为 `/tools/json/`，从而可以与正式域名比较同一路径。遗留别名 `/pages/tools/*.html` 也归一到 `/tools/*/`；模板页归一为 `/pages/template.html`。
- **原始总量与筛选队列并列**：`cohort` 取值 `raw`（全量）、`suspected_automation`（疑似自动化）、`selftest`（显式自测标记）、`filtered_external`（排除前两者后的候选外部流量）。`filtered_external` **不是**“已确认真人”，历史未打自测标的主人流量仍可能混入，只能标为 uncertain。
- PV 是无事件名的 pageview；`sessions` 按相应报表层级对 `session_id` 去重；`visits` 优先 `visit_id`，缺失时回退 `session_id`。**不要**把同一 `session_id` 在窗口内的事件时间跨度当成停留时长——现有数据里 `session_id` 可跨天复用。
- visitors / effective_users 是浏览器 `distinct_id`（缺失时按 `session_id` 回退）的近似口径，**近似浏览器，不是人数**。
- “有效使用”是中文事件 `工具使用`，且必须同时命中工具白名单与**核心操作**白名单（见 `scripts/umami-traffic-quality.mjs`）。加载示例、清空、复制、失败点击、输入防抖预览不计入北极星。
- 报表从 pageview 与有效使用的键集合出发；即使某周期、hostname、路径只有有效使用事件而没有 pageview，也会保留该行，north-star 指标不依附于 PV。路径明细可保留观察，**不做路径级 unique 作为决策指标**。

可重复执行的查询是 [`scripts/umami-operations-report.sql`](../scripts/umami-operations-report.sql)。它输出 `report_level`、`cohort`、`period`、`hostname`、`normalized_path`、`pv`、`sessions`、`visits`、`visitors`、`effective_uses`、`effective_users`。汇总层的 sessions / visits / visitors / effective_users 都从原始事件重新去重。

## 疑似自动化与自测

- 复现指纹（CN 与 SG 均出现过）：**Chrome + Windows 10 + 1280x1200 + en-US**。必须使用该**复合条件**；仅按国家或仅按分辨率排除是错误的。
- 自测 / 自动化验收请使用显式可逆机制（见规范），**不要**用地缘推断：
  - 开启：`?selftest=1` 或 `localStorage.setItem('umami.selftest','1')`
  - 关闭：`?selftest=0` 或删除该 key
  - 全量停采：`localStorage.setItem('umami.disabled','1')`（原有）
- 开启自测后，事件属性带 `标记=自测` / `自测=是`，报表进入 `selftest` 队列。历史未标记样本保持 uncertain，不得回写破坏性清洗。

## 刷新命令

在仓库根目录执行；密码由容器环境提供，命令和文档均不嵌入密码：

```bash
docker exec -i 1Panel-postgresql-emsf sh -lc \
  'psql -X -v ON_ERROR_STOP=1 -v website_id=99e14cad-6300-4f3c-83d2-b3b71c7d6a25 -U "$POSTGRES_USER" -d umami_wk4zs4 -P pager=off' \
  < scripts/umami-operations-report.sql
```

SQL 只有读取语句。审计时还可在容器命令中设置 `PGOPTIONS="-c default_transaction_read_only=on"`，由 PostgreSQL 强制只读。

## 2026-07-13 基线

以下是 2026-07-13 对正式域名 `tools.songyuankun.top` 的只读审计快照，不是永久值；刷新报表后应以新窗口结果替换当期运营记录：

| 窗口 | PV | Sessions |
|---|---:|---:|
| 最近 7 天 | 8 | 7 |
| 最近 30 天 | 119 | 25 |
| 此前 30 天 | 386 | 25 |

基线适合回答“正式域名在当时的量级”，不能与另一个执行时刻的滚动窗口机械对比。按路径输出的 sessions 也不能跨行求和。当时有效工具白名单尚未纳入哈希/二维码，且未分 cohort；**旧快照不可与新口径直接同比**。

## 2026-07-14 双站汇总验收

以下结果由刷新命令在 PostgreSQL 强制只读事务中生成，用于验收 `hostname_summary` 与 `all_hosts_summary`。数值是执行时刻的滚动窗口快照，不替代后续月度复盘。

| 窗口 | hostname | PV | Sessions | Visitors | Effective uses | Effective users |
|---|---|---:|---:|---:|---:|---:|
| 最近 7 天 | `songyuankun.github.io` | 72 | 66 | 66 | 0 | 0 |
| 最近 7 天 | `tools.songyuankun.top` | 14 | 8 | 8 | 0 | 0 |
| 最近 7 天 | `all` | 86 | 74 | 74 | 0 | 0 |
| 最近 30 天 | `songyuankun.github.io` | 905 | 857 | 857 | 1 | 1 |
| 最近 30 天 | `tools.songyuankun.top` | 98 | 28 | 28 | 8 | 1 |
| 最近 30 天 | `all` | 1003 | 885 | 885 | 9 | 2 |
| 此前 30 天 | `songyuankun.github.io` | 216 | 102 | 102 | 0 | 0 |
| 此前 30 天 | `tools.songyuankun.top` | 414 | 26 | 26 | 0 | 0 |
| 此前 30 天 | `all` | 630 | 124 | 124 | 0 | 0 |

本次三个窗口中，PV 与 effective uses 的 `all` 值都等于两个 hostname 对应值之和，可加口径校验通过。Sessions、visitors 与 effective users 则由原始事件在 all-hosts 层重新去重：此前 30 天的两个分站 Sessions/Visitors 各自相加为 128，而 all-hosts 正确结果是 124。这个差异证明独立指标不能相加路径或分站汇总得到；未来复盘也必须保留同样的重新去重规则。

## 数据限制

- 旧报告混合了正式域名和 GitHub Pages，且没有移除 `/dev-tools-nav` 前缀；旧总量不能直接作为新报表同比基线。
- GitHub Pages 的开源雷达页出现过高 PV、几乎每次访问都新建 session 的模式，疑似低质量自动流量（thin multi-page check）。运营结论必须先按 hostname 与 `cohort` 查看。
- 模板页、无 pageview 仅有事件、重定向别名需单独解读；`filtered_external` 仍可能含未标记自测。
- DNT、`localStorage` 禁用开关、拦截请求以及浏览器清理本地标识都会让行为事件或跨访问识别缺失。
- 跨 hostname 时浏览器存储隔离会让同一人通常获得不同 `distinct_id`；因此 `all_hosts_summary` 是现有标识下的去重近似值，可能高估真实跨站独立用户，不能宣称完成了跨域身份合并。
- Umami 只描述站内行为；自然搜索曝光和点击仍需 Search Console 补充。
- JSON 漏斗：`工具打开`（含低基数额 `入口`）→ 核心 `工具使用`（格式化/压缩/修复/校验/结构对比）。入口取值仅限首页/手册/引导/JWT/Base64/直达/未知，不含用户内容。

## Monthly review

每月固定保存同一刷新命令的结果，并至少复盘四项：

1. **Effective users**：只引用 `hostname_summary` 或带身份限制说明的 `all_hosts_summary` 在 `filtered_external`（并对照 `raw`）下的独立有效工具用户；任何决策判断都不得引用或相加 `detail` 行。
2. **Effective uses**：同一口径下的核心动作次数；与 effective users 一起看复用深度。同时核对 `suspected_automation` / `selftest` 队列是否异常膨胀。
3. **Search Console clicks**：按落地页和查询词查看自然搜索点击，不能用 Umami PV 代替。
4. **30-day return rate**：最近 30 天内被识别为回访的访客占可识别访客的比例；同时记录分子、分母和身份丢失限制，避免只报百分比。

复盘时先比较正式域名的最近 30 天与此前 30 天，再单独检查 GitHub Pages；任何跨 hostname 汇总都应显式标注浏览器身份隔离限制。
