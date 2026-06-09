# Umami 数据洞察与迭代优先级

> 数据来源：`umami.songyuankun.top`，网站 ID `99e14cad-6300-4f3c-83d2-b3b71c7d6a25`（tools.songyuankun.top）  
> 快照日期：2026-06-09 · 统计窗口：近 90 天

## 如何刷新本报告

在服务器上查询 PostgreSQL（Umami 后端）：

```bash
# 页面 PV（90 天）
docker exec -e PGPASSWORD='…' 1Panel-postgresql-emsf \
  psql -U umami_hWTtkK -d umami_wk4zs4 -c "
SELECT url_path, COUNT(*) AS views
FROM website_event
WHERE website_id = '99e14cad-6300-4f3c-83d2-b3b71c7d6a25'
  AND event_type = 1 AND event_name IS NULL
  AND created_at >= NOW() - INTERVAL '90 days'
GROUP BY url_path ORDER BY views DESC LIMIT 20;"
```

也可登录 [Umami 后台](https://umami.songyuankun.top/) 查看 Pages / Events / Sessions。

## 高访问页面（90 天 PV）

| 排名 | 路径 | PV | 解读 |
|------|------|-----|------|
| 1 | `/` | 347 | 首页入口，应突出自研工具与任务快捷区 |
| 2 | `/pages/template.html` | 154 | 外链工具详情页，说明导航目录仍有价值 |
| 3 | `/index.html` | 134 | 与 `/` 重复统计，需统一 canonical |
| 4 | `/pages/ai/index.html` | 56 | AI 专题有需求，应用横评/工作流承接 |
| 5 | **JSON 工具合计** | **~92** | `/pages/tools/json.html` 55 + `/tools/json/` 37，**站内最高价值自研页** |
| 6 | `/pages/ai/open-source-radar.html` | 26 | 内容型页面表现好，可持续更新 |
| 7 | `/pages/tools/index.html` | 22 | 在线工具汇总入口 |
| 8 | `/pages/blog/index.html` | 20 | 博客信任背书 |

## 自定义事件（样本量仍小）

| 事件 | 次数 | 说明 |
|------|------|------|
| `tool_used` (json) | 2 | JSON 工具改版后需观察增长 |
| `tool_click` | 17 | 首页 v2 工具卡点击已采集 |
| `category_switch` | 5 | 分类切换偶有使用 |

> 事件总量偏低，说明近期以「直达 URL / SEO」流量为主，站内导流埋点需持续观察。

## 优先级矩阵（已落地 2026-06-09）

| 优先级 | 动作 | 依据 |
|--------|------|------|
| **P0** | JSON 工具重构（实时校验、树形视图） | JSON 合计 ~92 PV，最高自研页 |
| **P0** | 首页「我想完成什么」任务入口 | README 待办 + 数据验证 JSON/JWT/AI 选型需求 |
| **P1** | 降权头部 AI 外链精选（ChatGPT/Claude/DeepSeek 等） | 无稀缺性，不应占精选位 |
| **P1** | 提升在线工具精选（JSON/JWT/SQL/正则/Base64） | 护城河内容 |
| **P1** | AI 详情页引导至横评专题 | template.html 流量高，避免停在「又一个 ChatGPT 链接」 |
| **P2** | 统一 JSON 路径 | ✅ `pages/tools/json.html` 非 embed 时 302 到 `/tools/json/` |
| **P2** | 增强 `tool_used` 埋点 + 中文展示 | ✅ 全工具走 `umamiTrack`，Umami 事件名为中文 |
| **P3** | 时间戳/Cron 工具增强 | PV 个位数，低于 JSON 一个数量级 |

## 站点定位（数据 + 产品共识）

```
访客路径：
  SEO/收藏 → 首页或 JSON 工具（高频）
  选型困惑 → AI 专题 / 横评（中频）
  随便逛   → template 外链详情（中频，但不是差异化）

应强化：自研在线工具 + AI 专题手册
应降权：人人皆知的 AI 对话外链作为「精选」展示
```

## 下次复盘建议

- **周期**：每月初看一次 Umami Pages Top 20 + `tool_used` 事件
- **阈值**：某自研工具页连续 30 天 PV &lt; 5 → 考虑合并入口或停止迭代
- **阈值**：某页面 bounce 率 &gt; 70% 且为落地页 → 检查首屏价值是否与搜索意图匹配
