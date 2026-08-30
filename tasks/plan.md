# Sprint 1 Must 层 OP 落地执行计划（JB-OSS 完全合规版）

> **文档定位**：严格依据 [product-optimization-report-2026Q3-JBOSS-COMPLIANT.md §4.2 Sprint 1](file:///Users/mac/vs-code/dev-tools-nav/docs/product-optimization-report-2026Q3-JBOSS-COMPLIANT.md#L398-L409) 执行，所有改动必须通过 JB-OSS 7 铁律合规门禁。

---

## 1. 核心目标（3 件事，优先级从高到低）

| # | 目标 | 量化指标基线 → 目标 | 对应 OP |
|---|---|---:|---|
| G1 | **拉激活（最严重流失层）**：激活率 0.2% → Sprint1 末 ≥ 4.0% | ×20 提升 | OP-101 / OP-102 / OP-103（前 3 个 Must） |
| G2 | **JB OSS 审核 P6 关键证据齐**：徽章 + 隐私横幅双截图齐备，应对审核问询 | 审核截图点 = 2/2 ✅ | OP-203 / OP-303（W35 前 2 天，优先级最高） |
| G3 | **留存×复用拉起来**：30 天回访率 1.6% → 6%；单会话 effective_uses 1.0→2.2 步 | 回访 ×3.75；复用 ×2.2 | OP-105 / OP-107 / OP-201 |

---

## 2. 交付节点 8 个（按 W35 D1 → W36 D5 顺序，依赖关系无环）

| 交付点 | 日期（计划） | OP | 核心交付物 | 可量化验收标准（fail-closed） |
|---|---|---|---|---|
| D1 | 08-31 周一 | OP-203 | README+首页 header 双徽章 SVG | (a) grep README 含 2 徽章 (b) index.html `<header>` 出现 (c) `grep -rn "utm_\|ref=\|aff=" .` = 0 行 (d) LICENSE 链接 = `blob/main/LICENSE` 格式 |
| D2 | 09-01 周二 | OP-303 | 首页 `<body>` 首屏 `.privacy-banner` | (a) index.html 出现 `.privacy-banner` (b) 内容含「零上传」「零第三方 SDK」「纯本地计算」三短语 (c) CSS 无遮挡，z-index 低于 header 高于 main |
| D3 | 09-02 周三 | OP-101 | 首屏双栏布局（60%/40%） | (a) 左栏 `.self-built-tools-area` 背景 `#e8f5e9` (b) 10 款自研工具卡片 10/10 出现 (c) 右栏 `.directory-nav` 目录导航 (d) 1440px Playwright 截图视觉通过 |
| D4 | 09-03 周四 | OP-101 收尾 + 单测 | 同上 + 测试补全 | (a) 10 工具卡片 CTR 锚点 `data-umami-event` 正确 (b) `npm test` 全绿 (c) `css/style.css` 双栏样式 ≤ 60 行增量 |
| D5 | 09-04 周五 | OP-102 | 新手引导 Tour（4 步浮层） | (a) 清 localStorage 首访自动弹出 (b) 4 步：欢迎→自研区→收藏入口→JSON工作台 (c) localStorage 写 `tour_done = v1 + 完成时间戳` (d) 跳步按钮可跳 → 对应区域 scrollIntoView |
| D6 | 09-07~08 周一二 | OP-103 | JSON 工作台默认示例 + Toast 容错 | (a) 空 load 默认 5 行示例 JSON (b) 粘贴缺逗号 `{a:1,b:[2,3]` → 1s 内顶部红 Toast + CodeMirror 行标红 (c) Toast 含「修复建议：补逗号」(d) 组件化 js/toast.js 单文件 ≤ 80 行 |
| D7 | 09-09 周三 | OP-105 | 4 场景互链（3 条 OP-304/305 留 Sprint 2） | (a) JWT Decode → 跳 tools/json?payload=xxx 自动填值 (b) JSON↔YAML 按钮互转带值 (c) Base64 Decode 后如果是 JSON → 显示「去 JSON 美化」按钮 (d) URL query 填值 3/3 100% 通过 |
| D8 | 09-10 周四 | OP-107 | MRU + 收藏夹双模块 | (a) 首页工具栏下方 `#mru-section` 最多 8 个 (b) 每卡片 ❤️ 切换收藏 (c) 刷 page localStorage 恢复 (d) keys：`mru_v1 = []` / `fav_v1 = []`，两数组独立 |
| D9 | 09-11 周五 | OP-201 | Search Console 静态看板 | (a) `logs/search-queries.json` mock 20 条 (b) build 生成 `search-console.html` 4 个表（查询词/CTR/曝光/无结果查询）(c) 无结果查询 ≥ 1 → `.github/ISSUE_TEMPLATE/search-gap.yml` 模板生成成功 (d) 加入 sitemap + 首页 footer 链接 |

---

## 3. JB-OSS 合规硬约束（所有改动 fail-closed，任何越界直接 FAIL）

**任何 OP 的任何提交必须先过以下 grep 检查才能入 commit**：

```bash
# JB-01 非商业（禁任何付费/联盟/UTM/Ref）
! grep -rn "utm_\|ref=\|aff=\|pay\|订阅\|赞助\|广告" --include="*.html" --include="*.css" --include="*.js" --include="*.json" | grep -v "node_modules\|comment\|README.md 历史文档"
# JB-04 隐私（禁任何 fetch/axios/XMLHttpRequest 上传除 Umami 外）
! grep -rn "fetch\|axios\|XMLHttpRequest\|navigator.sendBeacon" --include="*.js" tools/ pages/ | grep -v "umami-helper\|已存在的 Umami 调用"
# JB-07 LICENSE 链接必须 blob/main
! grep -rn "github.com.*LICENSE" --include="*.md" --include="*.html" | grep -v "blob/main/LICENSE"
```

**Git 身份硬约束（永久）**：
- `GIT_AUTHOR_NAME=SongYuanKun` / `GIT_AUTHOR_EMAIL=123839070@qq.com`
- `GIT_COMMITTER_NAME=SongYuanKun` / `GIT_COMMITTER_EMAIL=123839070@qq.com`
- JB-06 文档同步：每个 OP 提交必须同步改 `docs/roadmap.md` 对应 planned → in_progress → done

---

## 4. 测试策略（每 OP 三级验证，100% 覆盖）

| 层级 | 工具 | 对应 OP | 覆盖率要求 |
|---|---|---|---|
| L1 单元测试 | Node `--test`（scripts/*.test.mjs） | OP-103/105/107/201 | 新增逻辑分支 100% |
| L2 浏览器回归 | Playwright（scripts/*.browser.test.mjs） | OP-203/303/101/102/107 | 关键截图/断言 100% |
| L3 手动走查 | Checklist + 真实浏览器 | 全部 8 OP | 8 × 验收标准 = 全量 |

---

## 5. 风险与缓解

| 风险 | 影响 | 概率 | 缓解策略 |
|---|---|---|---|
| JB OSS 在 W35 审核出邮件问询（P6 监测） | 阻塞 OP-203/303 上线 → 需截图补充证据 | 中 | D1-D2 完成后立即截图 2 张存 `docs/jetbrains-oss-application-20260828/emails/p6a-p6b-*.jpg`，优先入库 |
| OP-101 双栏样式破坏移动端 <768px | 移动端 CTR 下降，激活率不达标 | 中 | 新增 `.self-built-tools-area` 仅 ≥1024px 双栏，<1024px 退回单栏堆叠；Playwright 375/768/1440 三视口 |
| OP-103 Toast 与 CodeMirror Lint 重复提示 | 视觉噪音，反而降有效使用率 | 低 | Toast 只在输入后 1s 无变化时出现，用户开始再输入自动 hide；UMAMI track 只算 Toast 出现 + 用户点击了 Toast 内的跳转链接 |
| OP-105 JWT→JSON query 串超长（RS256 带完整 key） | URL 超长 2KB 限制，Base64 解码失败 | 中 | 用 sessionStorage 传 `jwt_decode_payload_v1`，URL 仅传 `?from_jwt=1` 标识，避免超长 |
| OP-201 真实 GSC 数据拿不到（无 Google API Key） | 看板长期是 mock 数据，效果追踪不准 | 高 | 本期 mock 启动；真实接入开 OP-201b 在 Sprint 2，mock 数据用 `npm run test` 的 20 条固定样本；README 顶部声明「Search Console 演示数据（真实接入待后续）」 |

---

## 6. Definition of Done（每 OP 合并前 8 条全 ✅）

- [ ] OP 对应验收标准（Roadmap 表）100% 量化达标
- [ ] JB-OSS 7 合规 grep（第 3 节）全 PASS（0 违规）
- [ ] Git Author/Committer = SongYuanKun 123839070@qq.com
- [ ] `docs/roadmap.md` Phase2 对应工作项状态同步（planned→done 或 in_progress）
- [ ] `npm test` 0 fail（新增单测必须 PASS）
- [ ] Playwright 关键页（首页/JSON/JWT）截图无视觉回归（`capture-screenshots` 脚本）
- [ ] `README.md` 功能清单同步（如果是用户可见的新功能）
- [ ] Umami `data-umami-event` 埋点 + `data-umami-event-op=OP-XXX` 标签闭环（统计 Δ 达标追踪）
