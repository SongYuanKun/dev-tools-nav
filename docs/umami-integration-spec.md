# Umami 接入规范 — au_message + dev-tools-nav

> **目标**：为 au.songyuankun.top 和 tools.songyuankun.top 补充 Umami 自定义事件埋点，丰富数据分析维度。
>
> **前置条件**：Umami 服务已在 `umami.songyuankun.top` 运行，基础 PV/UV 采集已生效。
>
> **交付物**：
> 1. `umami-helper.js` — 统一埋点工具文件（每个站点一份）
> 2. 模板/页面中引入该文件的修改
> 3. Umami 后台 Goals 配置指南

---

## 一、事件设计

### 1.1 事件列表

两个站点共用以下事件名，事件属性按站点实际情况填充：

| 事件名 | 中文描述 | 触发时机 | 事件属性 | 说明 |
|--------|---------|---------|---------|------|
| `nav_click` | 导航点击 | 点击导航链接 | `{ page, label, 描述 }` | 用户点了哪个导航 |
| `tool_click` | 工具点击 | 点击工具/卡片/链接 | `{ name, category, 描述 }` | 用户点了哪个工具 |
| `theme_toggle` | 主题切换 | 切换暗色/亮色主题 | `{ from, to, 描述 }` | 暗色 ↔ 亮色 |
| `cta_action` | CTA 按钮 | 点击 CTA / 订阅 / 支持作者 | `{ action, target, 描述 }` | 核心转化行为 |

### 1.2 au_message 站点额外事件

| 事件名 | 触发时机 | 事件属性 |
|--------|---------|---------|
| `unit_switch` | 切换 USD/盎司 ↔ 人民币/克 | `{ from: string, to: string }` |
| `calc_use` | 使用计算器任一工具 | `{ tool: string, metal: string }` |
| `alert_action` | 订阅/取消订阅价格提醒 | `{ action: string, metal: string }` |
| `chart_interact` | 图表时间范围/指标切换 | `{ metal: string, type: string, value: string }` |

### 1.3 dev-tools-nav 站点额外事件

| 事件名 | 中文描述 | 触发时机 | 事件属性 |
|--------|---------|---------|---------|
| `category_click` | 分类筛选 | 点击分类 Tab/筛选 | `{ category, 描述 }` |
| `search_use` | 搜索使用 | 使用搜索功能 | `{ query, results, 描述 }` |
| `external_link` | 外部链接 | 点击外部链接 | `{ url, label, 描述 }` |
| `tool_used` | 工具使用 | 在线工具内执行操作 | `{ 工具, 操作, 描述 }`（中文属性） |

> **Umami 后台展示**：`js/umami-labels.js` 将事件名映射为中文（如 `tool_used` → **工具使用**），属性键亦为中文（`工具`、`操作`、`描述`）。请使用 `window.umamiTrack()` 上报，勿直接 `umami.track('tool_used')`。Goals 需按中文事件名重新配置。

**JSON 工具 `action` 取值**（代码内英文键，`umami-labels.js` 会转为中文「操作」）：

| action | 触发操作 |
|--------|----------|
| `format` | 点击「格式化」 |
| `minify` | 点击「压缩」 |
| `repair` | 点击「修复」（去注释/尾逗号等） |
| `validate` | 点击「校验」 |

> **Umami 后台查看**：每条自定义事件会自动附带 `描述` 字段（中文），在 Events → 点开事件 → Properties 中可见。事件名对照表见 `js/umami-labels.js`。

### 1.4 dev-tools-nav 已启用的 Umami 平台能力

| 能力 | 实现位置 | 后台查看位置 | 说明 |
|------|---------|-------------|------|
| **PV / UV** | `js/base.js` 自动 pageview | Overview → Pageviews / Visitors | UV 靠 `distinct_id` + IP/UA 去重 |
| **访客识别** | `localStorage` 存 `umami.visitor-id`，`umami.identify()` | Sessions → 搜索 Distinct ID | 跨访问识别同一浏览器 |
| **Session Data** | identify 附带 `主题/区域/回访/首访/嵌入` | Sessions → 点开会话 → Properties | 无需登录即可画像 |
| **Tag 分组** | 按路径自动打标 `home/ai/tools/blog` | 可按 tag 筛选事件 | 等同官方 `data-tag` |
| **Performance** | Core Web Vitals（LCP/INP/CLS/FCP/TTFB） | Performance 标签页 | `type: performance`，非自定义事件 |
| **Goals** | 后台手动配置 | Settings → Goals | 见 §4.1 |
| **Funnels** | 后台手动配置 | Reports → Funnel | 见 §4.2 |
| **声明式埋点** | `data-umami-event="事件名"` | Events | 可选 `data-umami-event-foo="bar"` |
| **JS 错误** | `error` + `unhandledrejection` | Events → `js_error` | 含 Promise 未捕获拒绝 |
| **滚动深度** | `scroll_depth` 25/50/75/100% | Events | 参与度辅助指标 |
| **页面停留** | `page_exit` 离开时上报 | Events | `duration` 毫秒 |
| **DNT 尊重** | 检测 `navigator.doNotTrack` | — | 用户开启 DNT 时不采集 |
| **禁用开关** | `localStorage.setItem('umami.disabled','1')` | — | 调试用 |

**PV vs UV 说明**：

- **PV**：每次 pageview 请求计 1（`website_event` 无 `event_name` 的记录）
- **UV（Visitors）**：独立 `session`；启用 `umami.visitor-id` 后可在 Sessions 按 Distinct ID 聚合跨天回访
- **Visits**：约 30 分钟无活动后新开 visit（Umami 服务端 JWT 管理）

**声明式埋点示例**（HTML 无需写 JS）：

```html
<button data-umami-event="cta_action"
        data-umami-event-action="demo"
        data-umami-event-target="hero">
  立即体验
</button>
```

---

## 二、站点 A：au_message（au.songyuankun.top）

### 2.1 技术背景

- **技术栈**：Flask + Jinja2 服务端渲染
- **Umami 状态**：3 个模板已有基础 script 标签：
  ```html
  <script defer src="https://umami.songyuankun.top/script.js"
          data-website-id="0a0f5b9f-b2ca-41a5-a1d0-4ef7a6bbaad3"></script>
  ```
- **已知 data 属性**（已存在于 HTML 中）：
  - `data-page` — 导航页标识
  - `data-au-unit` — 当前单位（cny/gram 或 usd/oz）
  - `data-calc-type` — 计算器金属类型 tab
  - `data-calc-mode` — 计算器模式（diff/pnl/breakeven/dca）
  - `data-alert-type` — 提醒类型 tab
  - `data-metal` — 当前选中金属
  - `data-range` — 图表时间范围
  - `data-ind` — 图表技术指标

### 2.2 创建 umami-helper.js

在 `static/js/umami-helper.js`（相对于 Flask 项目根目录）创建：

```javascript
/**
 * au_message — Umami 自定义事件埋点
 * 零依赖，事件委托模式，不侵入业务代码
 */
(function () {
  'use strict';

  /** 安全调用 umami.track，脚本未加载时静默 */
  function track(name, props) {
    try {
      if (typeof umami !== 'undefined' && typeof umami.track === 'function') {
        umami.track(name, props);
      }
    } catch (e) { /* 静默 */ }
  }

  /** 从元素或祖先链读取属性 */
  function attr(el, name) {
    if (!el) return '';
    return el.getAttribute(name) || '';
  }

  // ==================== 1. 导航点击 ====================
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[data-page]');
    if (link) {
      track('nav_click', {
        page: attr(link, 'data-page'),
        label: link.textContent.trim().slice(0, 50)
      });
    }
  });

  // ==================== 2. 单位切换 ====================
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-au-unit]');
    if (btn) {
      var active = document.querySelector('[data-au-unit].active');
      var from = active ? attr(active, 'data-au-unit') : '';
      var to = attr(btn, 'data-au-unit');
      if (from && to && from !== to) {
        track('unit_switch', { from: from, to: to });
      }
    }
  });

  // ==================== 3. 计算器使用 ====================
  document.addEventListener('click', function (e) {
    // 计算器模式切换
    var modeBtn = e.target.closest('[data-calc-mode]');
    if (modeBtn) {
      var metalTab = document.querySelector('.calc-mode-panel .type-tab.active');
      track('calc_use', {
        tool: attr(modeBtn, 'data-calc-mode'),
        metal: metalTab ? metalTab.textContent.trim().replace(/\s+/g, '') : ''
      });
    }
    // 定投计算按钮
    if (e.target.closest('#btnDcaCalc')) {
      var metalTab2 = document.querySelector('.calc-mode-panel .type-tab.active');
      track('calc_use', {
        tool: 'dca_calculate',
        metal: metalTab2 ? metalTab2.textContent.trim().replace(/\s+/g, '') : ''
      });
    }
  });

  // ==================== 4. 价格提醒 ====================
  document.addEventListener('click', function (e) {
    var action = null;
    if (e.target.closest('#btnSubscribe')) action = 'subscribe';
    if (e.target.closest('#btnUnsubscribe')) action = 'unsubscribe';
    if (action) {
      var metalTab = document.querySelector('[data-alert-type].active');
      track('alert_action', {
        action: action,
        metal: metalTab ? metalTab.textContent.trim().replace(/\s+/g, '') : ''
      });
    }
  });

  // ==================== 5. 图表交互 ====================
  document.addEventListener('click', function (e) {
    // 时间范围切换
    var rangeTab = e.target.closest('.range-tab');
    if (rangeTab) {
      track('chart_interact', {
        metal: (document.querySelector('[data-metal].active') || {}).textContent || '',
        type: 'range',
        value: rangeTab.textContent.trim()
      });
    }
    // 技术指标切换
    var indBtn = e.target.closest('[data-ind]');
    if (indBtn) {
      track('chart_interact', {
        metal: (document.querySelector('[data-metal].active') || {}).textContent || '',
        type: 'indicator',
        value: attr(indBtn, 'data-ind')
      });
    }
  });

  // ==================== 6. 主题切换 ====================
  document.addEventListener('click', function (e) {
    if (e.target.closest('#themeToggle')) {
      var current = document.documentElement.getAttribute('data-theme') || 'dark';
      var next = current === 'dark' ? 'light' : 'dark';
      track('theme_toggle', { from: current, to: next });
    }
  });

})();
```

### 2.3 修改模板文件

在以下 3 个 Jinja2 模板的 `</body>` 前，Umami script 标签之后，添加：

```html
<script defer src="/static/js/umami-helper.js"></script>
```

需要修改的模板文件（请根据项目实际路径调整）：
- `templates/index.html`
- `templates/history.html`
- `templates/analysis.html`

修改后的完整 script 区域：
```html
<script defer src="https://umami.songyuankun.top/script.js"
        data-website-id="0a0f5b9f-b2ca-41a5-a1d0-4ef7a6bbaad3"></script>
<script defer src="/static/js/umami-helper.js"></script>
```

---

## 三、站点 B：dev-tools-nav（tools.songyuankun.top）

### 3.1 技术背景

- **技术栈**：纯静态 HTML + CSS + JS
- **当前无任何分析脚本**
- **Umami website-id**：需新创建，或与 au_message 共用同一个（推荐共用，通过 hostname 区分）
- **JS 文件**：`js/base.js`（全站加载），`js/footer.js`
- **页面结构**：首页 + `pages/ai/`（5 页）+ `pages/tools` + `pages/blog` + `tools/`（6 个工具子页面）

### 3.2 在 Umami 后台新增网站

如果还没有 tools.songyuankun.top 的 website-id：

1. 登录 `umami.songyuankun.top`（admin 账户）
2. Settings → Websites → Add website
3. Domain 填 `tools.songyuankun.top`
4. 记录生成的 **website-id**（格式：`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`）

### 3.3 创建 umami-helper.js

在 `js/umami-helper.js`（相对于站点根目录）创建：

```javascript
/**
 * dev-tools-nav — Umami 自定义事件埋点
 * 零依赖，事件委托模式
 */
(function () {
  'use strict';

  function track(name, props) {
    try {
      if (typeof umami !== 'undefined' && typeof umami.track === 'function') {
        umami.track(name, props);
      }
    } catch (e) { /* 静默 */ }
  }

  function attr(el, name) {
    if (!el) return '';
    return el.getAttribute(name) || '';
  }

  // ==================== 1. 导航点击 ====================
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a');
    if (!link) return;

    var href = attr(link, 'href') || '';
    var text = link.textContent.trim().slice(0, 50);

    // 分类 Tab 点击
    var catLink = link.closest('.category-tabs, .tab-nav, [data-category]');
    if (catLink) {
      track('category_click', {
        category: text
      });
      return;
    }

    // 外部链接
    if (href.startsWith('http') && !href.includes(location.hostname)) {
      track('external_link', {
        url: href.slice(0, 200),
        label: text
      });
      return;
    }

    // 站内导航
    if (link.closest('nav, .navbar, .sidebar, .header, .menu')) {
      track('nav_click', {
        page: href,
        label: text
      });
      return;
    }

    // 工具/卡片链接
    var card = link.closest('.card, .tool-card, .tool-item, .resource-item, [class*="card"], [class*="item"]');
    if (card) {
      track('tool_click', {
        name: text,
        category: card.getAttribute('data-category') || card.closest('[data-category]')?.getAttribute('data-category') || ''
      });
    }
  });

  // ==================== 2. 搜索使用（如存在） ====================
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      var input = e.target.closest('input[type="search"], input[placeholder*="搜索"], input[placeholder*="Search"]');
      if (input) {
        track('search_use', {
          query: input.value.trim().slice(0, 100),
          results: 0
        });
      }
    }
  });

  // ==================== 3. 主题切换（如存在） ====================
  document.addEventListener('click', function (e) {
    if (e.target.closest('#themeToggle, [data-theme-toggle], .theme-switch')) {
      var current = document.documentElement.getAttribute('data-theme') || 'dark';
      var next = current === 'dark' ? 'light' : 'dark';
      track('theme_toggle', { from: current, to: next });
    }
  });

})();
```

### 3.4 修改 js/base.js

在 `js/base.js` 文件末尾追加以下代码（通过动态注入 script 标签加载 Umami SDK 和 helper）：

```javascript
// ==================== Umami Analytics ====================
(function () {
  var websiteId = 'PASTE_YOUR_WEBSITE_ID_HERE'; // ← 替换为 tools.songyuankun.top 的 website-id

  var script = document.createElement('script');
  script.defer = true;
  script.src = 'https://umami.songyuankun.top/script.js';
  script.setAttribute('data-website-id', websiteId);
  document.head.appendChild(script);

  var helper = document.createElement('script');
  helper.defer = true;
  helper.src = '/js/umami-helper.js';
  document.head.appendChild(helper);
})();
```

> **注意**：也可以选择在每个 HTML 页面的 `</body>` 前直接加两个 `<script defer>` 标签，效果一样。但改 `base.js` 是最省事的方式——全站自动覆盖，不用逐页面改。

---

## 四、Umami 后台配置（Goals + Funnels）

### 4.1 创建 Goals

登录 Umami → 对应网站 → Settings → Goals → Add Goal

**au_message 站点的 Goals：**

| Goal 名称 | 事件类型 | 事件名 | 附加条件（可选） |
|-----------|---------|--------|----------------|
| 使用计算器 | event | `calc_use` | — |
| 订阅价格提醒 | event | `alert_action` | action = subscribe |
| 切换单位 | event | `unit_switch` | — |
| 图表交互 | event | `chart_interact` | — |

**dev-tools-nav 站点的 Goals（已重建，事件名为中文）：**

| Goal 名称 | 类型 | 匹配值 |
|-----------|------|--------|
| 点击工具 | event | `工具点击` |
| 使用搜索 | event | `搜索使用` |
| 外部链接点击 | event | `外部链接` |
| CTA 转化 | event | `按钮点击` |
| 工具实际使用 | event | `工具使用` |
| 主题切换 | event | `主题切换` |
| 滚动深度 | event | `滚动深度` |
| JS 错误 | event | `JS 错误` |
| 导航点击 | event | `导航点击` |
| 分类筛选 | event | `分类筛选` |
| 收藏切换 | event | `收藏切换` |
| 彩蛋解锁 | event | `彩蛋解锁` |
| AI 专题导航 | event | `AI 专题导航` |
| 访问在线工具 | path | `/tools/` |
| 使用 JSON 工具 | path | `/tools/json/` |

服务器重建脚本：`scripts/rebuild-umami-goals.sql`（直接更新 Umami PostgreSQL `report` 表）。

### 4.2 创建 Funnels

**au_message 深度浏览漏斗：**

| Step 1 | Step 2 | Step 3 |
|--------|--------|--------|
| `/` | `/history` | `/analysis` |

**dev-tools-nav 深度浏览漏斗（已更新）：**

| Step 1 | Step 2 | Step 3 |
|--------|--------|--------|
| `/` | `/pages/ai` | `/tools/` |

**dev-tools-nav 工具使用漏斗（已更新）：**

| Step 1 | Step 2 | Step 3 |
|--------|--------|--------|
| `/` | `/tools/` | `/tools/json/` |

---

## 五、验证步骤

部署完成后，按以下步骤验证：

1. **打开浏览器 DevTools → Network 标签**
2. **访问 au.songyuankun.top**，点击导航链接、切换单位、使用计算器
3. **在 Network 中过滤 `collect` 请求**，检查是否有自定义事件数据
4. **打开 Umami Dashboard** → Events 标签页，确认事件已出现
5. **重复以上步骤验证 tools.songyuankun.top**

---

## 六、文件清单

| 文件路径（au_message 项目） | 操作 |
|---------------------------|------|
| `static/js/umami-helper.js` | **新建** |
| `templates/index.html` | 修改（加 1 行 script 引用） |
| `templates/history.html` | 修改（加 1 行 script 引用） |
| `templates/analysis.html` | 修改（加 1 行 script 引用） |

| 文件路径（dev-tools-nav 项目） | 操作 |
|-------------------------------|------|
| `js/umami-helper.js` | **新建** |
| `js/base.js` | 修改（末尾追加 Umami SDK + helper 加载代码） |

---

## 七、注意事项

1. **umami-helper.js 使用 `defer` 加载**，会在 DOM 解析完成后执行，不会阻塞页面渲染
2. **事件委托模式**：所有事件监听挂在 `document` 上，不需要在每个元素上绑定
3. **安全调用**：如果 Umami 脚本加载失败（CDN 不可达等），`umami.track` 调用会被静默捕获，不影响网站正常运行
4. **不需要任何额外的 data 属性**：代码复用 HTML 中已有的 data 属性，零改动现有 HTML 结构
5. **两个站点的 helper.js 是独立的**，因为事件类型和 DOM 结构不同
