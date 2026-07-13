# dev-tools-nav Umami 当前接入规范

## 当前架构

- `js/base.js` 是全站入口，直接向 `https://umami.songyuankun.top/api/send` 发送 pageview、identify、事件和 performance 数据，并兼容 History API 导航。
- `js/base.js` 依次加载 `js/umami-labels.js`、`js/umami-helper.js` 和彩蛋脚本。业务代码统一调用 `window.umamiTrack(internalKey, data)`。
- `js/umami-labels.js` 把内部英文 key 转为中文事件名、中文属性和可读的 `描述`；`js/umami-helper.js` 用事件委托采集导航、工具卡、CTA、筛选、搜索、外链、滚动和离开事件。
- 全站共用 Website ID `99e14cad-6300-4f3c-83d2-b3b71c7d6a25`。
- 运营范围只有 `tools.songyuankun.top` 与 `songyuankun.github.io`。它们共享 Website ID，但必须按 hostname 分析。

## 事件契约

所有自定义事件至少包含中文属性 `描述`。下表列的是当前代码直接消费的属性；“必需中文属性”是写入 Umami 后的名称。

| 内部 key | Umami 事件名 | 必需中文属性 | 触发 |
|---|---|---|---|
| `nav_click` | 导航点击 | `描述`、`链接`、`文字` | 点击站内导航 |
| `tool_click` | 工具点击 | `描述`、`工具`、`分类` | 点击工具卡或工具入口 |
| `theme_toggle` | 主题切换 | `描述`、`从`、`到` | 切换亮/暗主题 |
| `cta_action` | 按钮点击 | `描述`、`动作`、`目标` | 首页 CTA、关注平台、支持作者 |
| `category_click` | 分类筛选 | `描述`、`分类` | 首页或工具中心切换分类 |
| `search_use` | 搜索使用 | `描述`、`关键词`、`结果数` | 输入至少两个字符并完成防抖 |
| `external_link` | 外部链接 | `描述`、`地址`、`文字` | 点击站外链接 |
| `tool_used` | 工具使用 | `描述`、`工具`、`操作` | 自研工具完成下节列出的核心动作 |
| `favorite_toggle` | 收藏切换 | `描述`、`工具`、`动作` | 收藏或取消收藏工具 |
| `copy_click` | 复制操作 | `描述`、`页面`、`按钮` | 通用复制按钮 |
| `article_click` | 博客文章 | `描述`、`标题` | 点击博客文章卡片 |
| `ai_path_click` | AI 学习路径 | `描述`、`标签`、`页面` | 点击学习路径步骤 |
| `ai_nav_click` | AI 专题导航 | `描述`、`标签`、`页面` | 点击 AI 专题卡片 |
| `ai_filter` | AI 场景筛选 | `描述`、`场景` | 切换 AI 速查筛选 |
| `blog_filter` | 博客筛选 | `描述` | 切换博客分类；当前映射未保留原始分类属性 |
| `radar_filter` | 雷达筛选 | `描述` | 切换开源雷达主题；当前映射未保留原始主题属性 |
| `radar_copy_link` | 雷达复制链接 | `描述` | 复制雷达项目链接；当前映射未保留原始 repo 属性 |
| `easter_egg_unlocked` | 彩蛋解锁 | `描述` | 解锁隐藏激活工具入口 |
| `js_error` | JS 错误 | `描述`、`错误`、`来源`，可选 `行号` | 未捕获 error 或 Promise rejection |
| `scroll_depth` | 滚动深度 | `描述`、`深度` | 首次到达 25/50/75/100% |
| `page_exit` | 页面离开 | `描述`、`停留毫秒` | `pagehide` |

`identify` 不是自定义事件；当前 session data 为 `主题`、`区域`、`回访`、`首访`、`嵌入`。Core Web Vitals 以 Umami `performance` 类型上报，不使用事件表中的 `页面性能` key。

## 十个自研工具的有效使用动作

下表以当前 `js/*-tool.js` 的真实调用为准。`工具`/`操作`列同时给出内部值和当前中文映射结果；映射表没有条目时，Umami 保存内部值。

| 工具脚本 | `tool` → `工具` | 当前有效动作 `action` → `操作` |
|---|---|---|
| `js/json-tool.js` | `json` → JSON 格式化 | `format` → 格式化；`minify` → 压缩；`repair` → 修复；`validate` → 校验；`diff` → 时间差计算（当前通用映射） |
| `js/timestamp-tool.js` | `timestamp` → 时间戳转换 | `ts_to_date` → 时间戳转日期；`date_to_ts` → 日期转时间戳；`batch` → 批量转换；`diff` → 时间差计算 |
| `js/encoding-tool.js` | `base64` → Base64 | `encode` → 编码；`decode` → 解码；`hash` → `hash` |
| `js/regex-tool.js` | `regex` → 正则表达式 | `template` → `template`；`replace` → 替换 |
| `js/cron-tool.js` | `cron` → Cron 表达式 | `parse` → 解析；`apply` → `apply`；`copy` → 复制 |
| `js/jwt-tool.js` | `jwt` → JWT 解码 | `verify` → 验签；`generate` → `generate`；`decode` → 解码 |
| `js/sql-tool.js` | `sql_formatter` → SQL 格式化 | `format` → 格式化；`minify` → 压缩；`analyze` → 分析 |
| `js/diff-tool.js` | `diff` → `diff` | `run` → `run` |
| `js/uuid-tool.js` | `uuid` → `uuid` | `generate` → `generate` |
| `js/color-tool.js` | — | 当前没有 `tool_used` 调用，因此不能从 Umami 计算有效使用 |

这张表描述现状，不把“打开页面”“点击卡片”当成有效使用。补充或改名动作时，应同时修改业务调用、`js/umami-labels.js`、本表和报表契约测试。

## Hostname 与路径报表规则

可执行报表是 `scripts/umami-operations-report.sql`：

1. 只接收 psql 变量 `website_id`，标准调用值为共享 Website ID。
2. 只选择两个目标 hostname，并在所有结果中保留 hostname 维度。
3. 对 `songyuankun.github.io` 去掉路径开头的 `/dev-tools-nav`；正式域名路径不变。
4. 输出最近 7 天、最近 30 天和此前 30 天，窗口均为执行时刻的滚动窗口。
5. `unified_keys` 合并 pageview 与有效使用的 `period + hostname + normalized_path` 键，再分别 LEFT JOIN 两类指标；没有 pageview 的有效使用行仍会保留，因此 north-star 独立于 PV。
6. visitors 是浏览器 `distinct_id`，缺失时按 `session_id` 回退的近似访客口径，即 `COUNT(DISTINCT COALESCE(s.distinct_id, e.session_id::text))`。
7. 商业有效使用排除 KMS/JRebel。报表兼容原始值 `kms`/`jrebel` 和当前中文持久值 `KMS 激活`/`JRebel 激活`。

Umami 3.2.0 实际 schema 已于 2026-07-13 在只读连接上验证：`event_data.website_event_id` 关联 `website_event.event_id`；文本事件属性保存在 `event_data.string_value`，属性名在 `event_data.data_key`。报表不得改用旧字段假设。

## DNT、禁用与错误隔离

- `navigator.doNotTrack`、`window.doNotTrack` 或 `navigator.msDoNotTrack` 为 `1`/`yes` 时，`js/base.js` 不初始化采集。
- `localStorage.setItem('umami.disabled', '1')` 可在该浏览器禁用采集；删除该 key 后恢复。
- localStorage 读写失败会被捕获；如果 DNT 未开启，采集仍可继续。
- `window.umamiTrack`、中文映射和 helper 的调用均由 `try/catch` 隔离，分析故障不能阻断工具功能。
- 网络发送使用 `fetch(..., { keepalive: true, credentials: 'omit' })`，失败最多重试两次；失败不会抛回业务事件处理器。
- `window.umamiBeforeSend(type, payload)` 可返回空值丢弃单次发送；其自身异常会回退到原 payload。

## Goals / Funnels

当前 Goals 与 Funnels 的数据库重建来源是 `scripts/rebuild-umami-goals.sql`。它使用中文事件名，并把工具路径更新到 `/tools/` 体系。该脚本包含写事务；日常只读验证和运营报表不要执行它。任何执行都应单独审批、备份并在目标 Umami 数据库核对 Website ID。

## 浏览器验证

1. 在两个 hostname 各打开首页和一个工具页；确认网络请求发往 `https://umami.songyuankun.top/api/send`，payload 的 `website` 相同而 `hostname` 各自正确。
2. 在 GitHub Pages 打开 `/dev-tools-nav/tools/json/`，确认浏览器上报原路径；路径归一化只发生在运营 SQL，不改采集 payload。
3. 完成工具核心动作，确认 Umami Events 中出现 `工具使用`，Properties 至少有 `描述`、`工具`、`操作`。
4. 设置 DNT 或 `localStorage.umami.disabled` 后刷新，确认没有新采集请求；验证完删除调试开关。
5. 人为触发可控 JS error 时，只验证 `JS 错误` 事件，不让错误测试影响生产用户。

## SQL 验证

先运行契约测试：

```bash
node --test scripts/umami-operations-report.test.mjs
```

再从仓库根目录执行只读明细查询：

```bash
docker exec -i 1Panel-postgresql-emsf sh -lc \
  'psql -X -v ON_ERROR_STOP=1 -v website_id=99e14cad-6300-4f3c-83d2-b3b71c7d6a25 -U "$POSTGRES_USER" -d umami_wk4zs4 -P pager=off' \
  < scripts/umami-operations-report.sql
```

验收结果只能出现两个目标 hostname；GitHub Pages 的 `normalized_path` 不得以 `/dev-tools-nav` 开头；KMS/JRebel 行的商业 `effective_uses` 和 `effective_users` 必须为 0。

## 商业指标排除

KMS 与 JRebel 是激活辅助入口，不属于十个自研工具的商业有效使用。它们的 pageview 可以保留用于风险和流量观察，但 `工具使用` 事件无论保存为 `kms`、`jrebel`、`KMS 激活` 还是 `JRebel 激活`，都必须从商业 `effective_uses` 和 `effective_users` 排除。
