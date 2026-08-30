# Sprint 1 Must 层 8 OP 任务清单（Sprint 2026-W35+W36）

> 任务顺序严格按依赖；每个任务做完必须打勾 + 对应 commit SHA 记录。

---

## Phase 0：计划与基线（P1-P2）

- [x] **Task 0-1 · 输出本 plan.md + todo.md**（[tasks/plan.md](file:///Users/mac/vs-code/dev-tools-nav/tasks/plan.md) + [tasks/todo.md](file:///Users/mac/vs-code/dev-tools-nav/tasks/todo.md)）
- [ ] **Task 0-2 · 代码基线采集**：读取 index.html / css/style.css / data/tools.js / tools/json / tools/jwt / tools/base64 结构，标记所有需要改动的锚点（class/id/query 参数）

### Checkpoint 0：计划 Review
- [ ] 8 OP 验收标准与 Roadmap §4.2 表格 100% 对齐
- [ ] JB-OSS 合规 grep（plan.md §3）可执行无歧义
- [ ] 依赖链（OP-203/303 → 101 → 102 → 103 → 105 → 107 → 201）无环

---

## Phase 1：W35 D1-D2（JB-OSS 审核证据双截图，最高优先级）

- [ ] **Task 1-1 (OP-203) · README + 首页 header 双徽章**
  - 徽章 1：MIT License（shields.io，链接 → `https://github.com/SongYuanKun/dev-tools-nav/blob/main/LICENSE`）
  - 徽章 2：JetBrains OSS Support（链接 → JB Application ID 29082026/19994700 的 `docs/jetbrains-oss-application-20260828/PROGRESS-TRACKER.md` 直链）
  - 验证：`grep -rn "utm_" .` = 0 行
- [ ] **Task 1-2 (OP-303) · 隐私横幅组件**
  - `css/style.css` 加 `.privacy-banner`（fixed top below header，黄色底，可关闭 localStorage：`privacy_closed = v1`）
  - `index.html` 加 HTML 片段 + `js/privacy-banner.js` 关闭逻辑
  - 内容强制三短语：「✅ 零上传」「✅ 零第三方 SDK」「✅ 纯本地计算」

### Checkpoint 1：JB 双截图入库
- [ ] Playwright 截首页 → `docs/jetbrains-oss-application-20260828/emails/p6a-jb-compliance-badges.jpg`
- [ ] Playwright 截隐私横幅展开 → `docs/jetbrains-oss-application-20260828/emails/p6b-privacy-banner.jpg`
- [ ] `docs/roadmap.md` Phase2 OP-203/OP-303 状态 planned → done

---

## Phase 2：W35 D3-D5（拉激活三件套 OP-101/102）

- [ ] **Task 2-1 (OP-101) · 首屏双栏布局 + 10 自研工具卡片区**
  - 左 60%：`.self-built-tools-area`，背景 `#e8f5e9`，标题「🛠️ 10 款直接运行的站内工具」，从 `data/tools.js` 取 is_selfbuilt=true 的 10 项
  - 右 40%：`.directory-nav`，原目录导航 7 分类（AI/开发/建站/安全/运维/设计/在线工具）
  - <1024px 自动回退单栏堆叠（mobile-friendly）
  - Umami 埋点：每张卡片 `data-umami-event="selfbuilt_click"` + `data-umami-event-op="OP-101"`
- [ ] **Task 2-2 (OP-102) · 4 步新手 Tour 浮层**
  - `js/tour.js` 组件（≤ 120 行）：`window.runTourIfNeeded()`
  - Step 1 欢迎（模态居中）→ Step 2 指向 `.self-built-tools-area` → Step 3 指向 `#fav-entry-anchor`（提前在工具栏预留）→ Step 4 指向 JSON 工作台卡片 `href="/tools/json/"`
  - 完成后写 `localStorage.tour_done = JSON.stringify({v:1, at: Date.now(), completedSteps:4})`
  - 跳过按钮直接写 tour_done 并关闭

### Checkpoint 2：激活三件套视觉 + Playwright
- [ ] 1440px 截图双栏视觉通过；375px 截图单栏堆叠通过
- [ ] Playwright 清 localStorage → tour 4 步走完 → localStorage 有 tour_done
- [ ] `docs/roadmap.md` OP-101/OP-102 planned → done

---

## Phase 3：W36 D1-D2（OP-103 JSON 容错 + 默认示例）

- [ ] **Task 3-1 · 通用 Toast 组件 js/toast.js（≤ 80 行）**
  - API：`Toast.show({type:'error'|'info', msg, fixHint?, actionText?, onAction?})`
  - 自动消失：error 8s，info 4s；点击 × 立即关闭
  - Umami track：`toast_show + OP-103`；onAction 触发 track `toast_action_click`
- [ ] **Task 3-2 (OP-103) · JSON 工作台接入默认示例 + Toast 容错**
  - `tools/json/index.html` 空状态默认填：`{"name":"Koen's 工具箱","tools":[{"id":"json","selfBuilt":true}],"tags":["MIT","JB-OSS"]}` 共 5 行
  - CodeMirror lint 报错 → 调起 Toast：type=error，msg=「JSON 解析失败：第 2 行缺少逗号」，fixHint=「修复建议：在对象键值对之间补逗号」
  - `data-tools.js` 加 JSON 工作台的 `defaultSample` 字段避免硬编码

### Checkpoint 3：JSON 容错回归
- [ ] 粘贴 `{a:1,b:[2,3]` → 1s 内 Toast；点击 Toast「看 JSON 教程」跳对应 URL（教程页 Sprint 2，本期链接先跳 blog/ 占位）
- [ ] `npm test` 全绿；新增 Toast 单测（Node jsdom 环境）
- [ ] `docs/roadmap.md` OP-103 planned → done

---

## Phase 4：W36 D3-D4（场景互链 + MRU/收藏 OP-105/107）

- [ ] **Task 4-1 (OP-105) · 3 条场景互链（AI 两条 Sprint 2）**
  - ① JWT Decode 成功 → 右上角出现「🔍 美化 claims 到 JSON 工作台」按钮 → `sessionStorage.jwt_decode_payload_v1 = JSON.stringify(payload); location.href = '/tools/json/?from_jwt=1'`
  - ② JSON 工作台顶部加 YAML ↔ JSON 双向按钮（已有 yaml 依赖，`yaml.parse/stringify`，已有）+ 成功调 Toast「已转 YAML，可复制」
  - ③ Base64 Decode 成功后尝试 `JSON.parse(decodeStr)` → 成功则出现按钮「🎨 去 JSON 工作台美化」→ `/tools/json/?input=<urlEncode>` 自动填
- [ ] **Task 4-2 (OP-107) · MRU + 收藏夹双模块**
  - `data/tools.js` 每项 is_selfbuilt=true 加收藏按钮 `<button class="fav-btn" data-tool-id="xxx">❤️</button>`
  - 任一工具的 Umami effective_uses 触发 → 写 `localStorage.mru_v1`（unshift + slice(0,8) 去重）
  - 首页工具栏下方 `<section id="mru-section">`（MRU 左半）+ `<section id="fav-section">`（收藏右半）两栏
  - 工具栏预留 `#fav-entry-anchor` 供 Tour Step3 指向

### Checkpoint 4：深度复用闭环
- [ ] JWT decode 1 次 → 跳 JSON 填值成功（sessionStorage 读）
- [ ] 收藏 3 工具 → 刷新 → fav-section 恢复 3 个
- [ ] 使用 5 工具 → MRU 前 4 个按时间倒序
- [ ] `docs/roadmap.md` OP-105/107 planned → done

---

## Phase 5：W36 D5（OP-201 Search Console 静态看板 + 交付）

- [ ] **Task 5-1 (OP-201) · logs/search-queries.json 静态 mock 20 条**
  - 字段：`query, impressions, clicks, ctr, position, has_match_tool, match_tool_ids[]`
  - 20 条中 5 条 `has_match_tool=false`（后续对应工具补位用 Issue 模板）
- [ ] **Task 5-2 (OP-201) · build-blog 扩展生成 search-console.html**
  - `scripts/build-blog.mjs` 扩展：读完 blog 后读 logs/search-queries.json → 渲染模板 `pages/search-console.html.tmpl` → 输出根 `/search-console.html`
  - 页面 4 个表：Top 查询词 / CTR 最低 Top10 / 曝光 Top10 / 无匹配结果查询
  - 无匹配查询 ≥ 1 → 自动写入 `.github/ISSUE_TEMPLATE/search-gap.yml`（模板预填 query/date/Search Console 截图指引）
- [ ] **Task 5-3 · sitemap + footer 同步**
  - `scripts/generate-sitemap.mjs` 加 `/search-console.html`（changefreq=weekly）
  - `js/footer.js` 底部加链接「🔍 搜索意图复盘看板（静态）」

### Checkpoint 5：Sprint 1 总验收
- [ ] `npm run check:generated` 全 PASS（build + check-generated 双步）
- [ ] Playwright 8 截图：首页双栏、Tour Step4、JSON 默认值+Toast、JWT→JSON 填值、MRU、收藏、Search Console 4 表、隐私横幅关闭
- [ ] JB-OSS 合规 grep（plan.md §3）0 违规
- [ ] `docs/roadmap.md` Phase2 8 OP 全部 planned→done（AI 两条 OP-304/305 留 Sprint2）
- [ ] 交付文档 `docs/sprint1-delivery-report-2026Q3.md`（成果说明/使用指南/测试报告/变更记录）

---

## 8 个 OP 验收标准与 Roadmap 对齐核查（每条必打勾）

| OP | 验收标准（来自 Roadmap §4.2）| Task | Status |
|---|---|---|---|
| OP-203 | README+header 双徽章 + grep utm 0 + blob/main LICENSE 链接 | Task 1-1 | ⬜ |
| OP-303 | .privacy-banner 首屏 + 三短语 + 可关闭 | Task 1-2 | ⬜ |
| OP-101 | 双栏 60%/40% + 背景 #e8f5e9 + 10 卡片 10/10 + <1024px 堆叠 | Task 2-1 | ⬜ |
| OP-102 | 4 步 Tour + localStorage tour_done + Step4 跳转 JSON | Task 2-2 | ⬜ |
| OP-103 | 默认 5 行 JSON + 缺逗号 1s 内 Toast + 修复建议 | Task 3-1 + 3-2 | ⬜ |
| OP-105 | JWT→JSON sessionStorage 传值 + JSON↔YAML + Base64→JSON 识别 | Task 4-1 | ⬜ |
| OP-107 | MRU 8 项 + 收藏夹 + 刷新恢复 + 工具栏 anchor 预留 | Task 4-2 | ⬜ |
| OP-201 | logs mock 20 + build 生成 4 表 + 无结果自动 Issue 模板 | Task 5-1+5-2 | ⬜ |
