# Umami 运营快照与复盘

> Website ID：`99e14cad-6300-4f3c-83d2-b3b71c7d6a25` · 快照日期：2026-07-13 · 运营时区：Asia/Shanghai · 观察窗口：最近 7 天、最近 30 天、此前 30 天

## 可信口径

- 只统计 `tools.songyuankun.top` 与 `songyuankun.github.io`，并始终按 hostname 分行，禁止把两个入口直接合并成一个站点总数。
- GitHub Pages 的 `/dev-tools-nav` 仓库前缀在报表中移除。例如 `/dev-tools-nav/tools/json/` 归一为 `/tools/json/`，从而可以与正式域名比较同一路径。
- PV 是无事件名的 pageview；sessions 按页面、周期和 hostname 对 `session_id` 去重；visitors 是浏览器 `distinct_id`，缺失时按 `session_id` 回退的近似访客口径。不同路径行的 sessions/visitors 不能相加当作全站去重值。
- “有效使用”是中文事件 `工具使用`。`effective_uses` 计事件次数，`effective_users` 按 `session_id` 去重。
- 报表从 pageview 与有效使用的键集合出发；即使某周期、hostname、路径只有有效使用事件而没有 pageview，也会保留该行，north-star 指标不依附于 PV。
- 商业有效使用排除 KMS/JRebel 激活工具。SQL 同时兼容历史原始值 `kms`/`jrebel` 与当前 `umami-labels.js` 写入的 `KMS 激活`/`JRebel 激活`，避免激活工具复制操作进入商业转化总量。

可重复执行的明细查询是 [`scripts/umami-operations-report.sql`](../scripts/umami-operations-report.sql)。它输出：`period`、`hostname`、`normalized_path`、`pv`、`sessions`、`visitors`、`effective_uses`、`effective_users`。

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

基线适合回答“正式域名在当时的量级”，不能与另一个执行时刻的滚动窗口机械对比。按路径输出的 sessions 也不能跨行求和。

## 数据限制

- 旧报告混合了正式域名和 GitHub Pages，且没有移除 `/dev-tools-nav` 前缀；旧总量不能直接作为新报表同比基线。
- GitHub Pages 的开源雷达页出现过高 PV、几乎每次访问都新建 session 的模式，疑似低质量自动流量。运营结论必须先按 hostname 查看，不以该流量证明产品需求。
- DNT、`localStorage` 禁用开关、拦截请求以及浏览器清理本地标识都会让行为事件或跨访问识别缺失。
- Umami 只描述站内行为；自然搜索曝光和点击仍需 Search Console 补充。

## Monthly review

每月固定保存同一刷新命令的结果，并至少复盘四项：

1. **Effective users**：排除 KMS/JRebel 后，至少完成一次自研工具核心动作的去重 session 数。
2. **Effective uses**：同一口径下的核心动作次数；与 effective users 一起看复用深度。
3. **Search Console clicks**：按落地页和查询词查看自然搜索点击，不能用 Umami PV 代替。
4. **30-day return rate**：最近 30 天内被识别为回访的访客占可识别访客的比例；同时记录分子、分母和身份丢失限制，避免只报百分比。

复盘时先比较正式域名的最近 30 天与此前 30 天，再单独检查 GitHub Pages；任何跨 hostname 汇总都应显式标注。
