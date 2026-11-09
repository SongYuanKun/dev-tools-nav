/**
 * Umami 流量质量口径（纯函数）
 * 与 scripts/umami-operations-report.sql / docs 保持同步；不读写数据库。
 *
 * 原则：
 * - 原始总量与筛选队列并列输出，不把 distinct_id 当成真人身份
 * - 疑似自动化用复合指纹，禁止仅按国家或仅按分辨率排除
 * - 自测依赖显式可逆标记，历史未标记样本保持 uncertain
 */

export const TARGET_HOSTS = Object.freeze([
  "tools.songyuankun.top",
  "songyuankun.github.io",
]);

/** 复合指纹：Chrome + Windows 10 + 1280x1200 + en-US（SG/CN 均出现过） */
export const SUSPECTED_AUTOMATION_FINGERPRINT = Object.freeze({
  browser: "Chrome",
  os: "Windows 10",
  screen: "1280x1200",
  language: "en-US",
});

/** 有效工具中文标签（fail-closed；含 QR/哈希/URL，修复白名单漂移） */
export const EFFECTIVE_TOOL_LABELS = Object.freeze([
  "JSON 格式化",
  "时间戳转换",
  "Base64",
  "正则表达式",
  "Cron 表达式",
  "JWT 解码",
  "SQL 格式化",
  "diff",
  "uuid",
  "颜色转换",
  "URL 编解码",
  "哈希生成器",
  "二维码生成器",
]);

/**
 * 核心成功动作（中文「操作」）。加载示例/清空/失败点击不计入北极星。
 * 与 js/umami-labels.js 映射结果对齐。
 */
export const EFFECTIVE_ACTION_LABELS_BY_TOOL = Object.freeze({
  "JSON 格式化": ["格式化", "压缩", "修复", "校验", "结构对比"],
  "时间戳转换": ["时间戳转日期", "日期转时间戳", "批量转换", "时间差计算"],
  Base64: ["编码", "解码", "哈希", "转 JSON"],
  "正则表达式": ["模板", "替换"],
  "Cron 表达式": ["解析", "应用", "复制"],
  "JWT 解码": ["验签", "生成", "解码"],
  "SQL 格式化": ["格式化", "压缩", "分析"],
  diff: ["运行"],
  uuid: ["生成"],
  "颜色转换": ["对比度", "复制 CSS 变量", "取色"],
  "URL 编解码": [
    "encode-component",
    "decode-component",
    "encode-uri",
    "decode-uri",
    "encode-form",
    "decode-form",
  ],
  "哈希生成器": ["摘要"],
  "二维码生成器": ["生成"],
});

export const ENTRY_CLASSES = Object.freeze({
  home: "首页",
  handbook: "手册",
  tour: "引导",
  jwt: "JWT",
  base64: "Base64",
  direct: "直达",
  unknown: "未知",
});

export const COHORTS = Object.freeze([
  "raw",
  "suspected_automation",
  "selftest",
  "filtered_external",
]);

export function normalizeGithubPagesPath(hostname, urlPath) {
  const path = urlPath || "/";
  if (hostname !== "songyuankun.github.io") return path || "/";
  const stripped = path.replace(/^\/dev-tools-nav(?=\/|$)/, "");
  return stripped === "" ? "/" : stripped;
}

/** 别名与尾斜杠归一；不做路径级 unique 北极星 */
export function normalizeRoutePath(hostname, urlPath) {
  let path = normalizeGithubPagesPath(hostname, urlPath);
  if (!path.startsWith("/")) path = `/${path}`;
  const legacy = path.match(/^\/pages\/tools\/([^/]+?)(?:\.html)?\/?$/i);
  if (legacy) return `/tools/${legacy[1].toLowerCase()}/`;
  if (/^\/tools\/[^/]+$/i.test(path)) return `${path}/`;
  if (path.length > 1 && path.endsWith("/") === false && /\.[a-z0-9]+$/i.test(path) === false) {
    // keep file-like paths; directories already handled
  }
  if (/^\/pages\/template(\.html)?/i.test(path) || /^\/template(\.html)?/i.test(path)) {
    return "/pages/template.html";
  }
  return path;
}

export function isTemplateOnlyPath(normalizedPath) {
  return /^\/pages\/template\.html$|^\/template/i.test(normalizedPath || "");
}

export function isRedirectAliasPath(urlPath) {
  return /^\/pages\/tools\//i.test(urlPath || "");
}

export function matchesSuspectedAutomationFingerprint(session = {}) {
  const browser = String(session.browser || "");
  const os = String(session.os || "");
  const screen = String(session.screen || "");
  const language = String(session.language || "");
  const fp = SUSPECTED_AUTOMATION_FINGERPRINT;
  return (
    browser.toLowerCase().startsWith(fp.browser.toLowerCase())
    && os.toLowerCase().startsWith(fp.os.toLowerCase())
    && screen === fp.screen
    && language.toLowerCase().startsWith(fp.language.toLowerCase())
  );
}

/** 地理字段单独命中不得判定自动化 */
export function countryAloneIsNotAutomation(session = {}) {
  const country = String(session.country || "").toUpperCase();
  if (!country) return true;
  const onlyCountry = matchesSuspectedAutomationFingerprint({
    ...SUSPECTED_AUTOMATION_FINGERPRINT,
    browser: "Safari",
    country,
  }) === false;
  return onlyCountry;
}

export function isSelftestEvent(event = {}, session = {}) {
  const mark = event.标记 ?? event.tag_mark ?? event.selftest;
  if (mark === "自测" || mark === "selftest" || mark === true || mark === "1") return true;
  const sessionFlag = session.自测 ?? session.selftest;
  return sessionFlag === "是" || sessionFlag === "selftest" || sessionFlag === true || sessionFlag === "1";
}

export function classifyCohort(event, session) {
  if (isSelftestEvent(event, session)) return "selftest";
  if (matchesSuspectedAutomationFingerprint(session)) return "suspected_automation";
  return "filtered_external";
}

export function eventBelongsToCohort(cohort, event, session) {
  if (cohort === "raw") return true;
  const classified = classifyCohort(event, session);
  if (cohort === "selftest") return classified === "selftest";
  if (cohort === "suspected_automation") return classified === "suspected_automation";
  if (cohort === "filtered_external") {
    return classified === "filtered_external";
  }
  return false;
}

export function isEffectiveUse(toolLabel, actionLabel) {
  if (!EFFECTIVE_TOOL_LABELS.includes(toolLabel)) return false;
  const actions = EFFECTIVE_ACTION_LABELS_BY_TOOL[toolLabel] || [];
  return actions.includes(actionLabel);
}

/**
 * 会话/访问口径：
 * - session_id 可跨天复用，禁止把窗口内 (max-min) created_at 当停留时长
 * - visit_id 存在时用于 visits；缺失时回退 session_id（近似，需在报表注明）
 * - distinct_id 近似浏览器，不是人数
 */
export function resolveVisitKey(event = {}) {
  return event.visit_id || event.session_id || null;
}

export function resolveIdentityKey(event = {}, session = {}) {
  return session.distinct_id || event.distinct_id || (event.session_id != null ? String(event.session_id) : null);
}

export function isThinAutomatedCheck(events = []) {
  const pageviews = events.filter((e) => e.event_type === 1 && !e.event_name);
  const effective = events.filter((e) => e.event_name === "工具使用" && isEffectiveUse(e.工具, e.操作));
  const paths = new Set(pageviews.map((e) => e.normalized_path));
  return pageviews.length <= 1 && effective.length === 0 && paths.size <= 1;
}

export function parseEntryClass(raw) {
  const key = String(raw || "").trim().toLowerCase();
  if (key === "home" || key === "首页") return "home";
  if (key === "handbook" || key === "手册") return "handbook";
  if (key === "tour" || key === "引导") return "tour";
  if (key === "jwt") return "jwt";
  if (key === "base64") return "base64";
  if (key === "direct" || key === "直达") return "direct";
  if (!key) return "direct";
  return "unknown";
}

export function entryClassLabel(raw) {
  return ENTRY_CLASSES[parseEntryClass(raw)] || ENTRY_CLASSES.unknown;
}

/** 回归夹具：覆盖 CN/SG 同指纹、仅国家/分辨率重合的普通人、标签覆盖、自测、去重 */
export const FIXTURES = Object.freeze({
  botCn: {
    id: "bot-cn",
    session: {
      browser: "Chrome",
      os: "Windows 10",
      screen: "1280x1200",
      language: "en-US",
      country: "CN",
      distinct_id: "bot-cn-1",
    },
    expectCohort: "suspected_automation",
  },
  botSg: {
    id: "bot-sg",
    session: {
      browser: "Chrome",
      os: "Windows 10",
      screen: "1280x1200",
      language: "en-US",
      country: "SG",
      distinct_id: "bot-sg-1",
    },
    expectCohort: "suspected_automation",
  },
  humanSameScreenCn: {
    id: "human-screen-cn",
    session: {
      browser: "Chrome",
      os: "Windows 11",
      screen: "1280x1200",
      language: "zh-CN",
      country: "CN",
      distinct_id: "human-1",
    },
    expectCohort: "filtered_external",
  },
  humanSameCountryOnly: {
    id: "human-country-only",
    session: {
      browser: "Safari",
      os: "Mac OS X",
      screen: "1440x900",
      language: "zh-CN",
      country: "CN",
      distinct_id: "human-2",
    },
    expectCohort: "filtered_external",
  },
  selftestOwner: {
    id: "selftest",
    session: {
      browser: "Chrome",
      os: "Windows 10",
      screen: "1280x1200",
      language: "en-US",
      country: "CN",
      distinct_id: "owner-1",
      自测: "是",
    },
    event: { 标记: "自测" },
    expectCohort: "selftest",
  },
  labelHash: { tool: "哈希生成器", action: "摘要", effective: true },
  labelQr: { tool: "二维码生成器", action: "生成", effective: true },
  labelSampleExcluded: { tool: "JSON 格式化", action: "加载示例", effective: false },
  labelUnknownExcluded: { tool: "KMS 激活", action: "生成", effective: false },
  dedupeHosts: {
    events: [
      { hostname: "tools.songyuankun.top", url_path: "/tools/json/", session_id: "s1", visit_id: "v1" },
      { hostname: "songyuankun.github.io", url_path: "/dev-tools-nav/tools/json/", session_id: "s1", visit_id: "v1" },
      { hostname: "songyuankun.github.io", url_path: "/dev-tools-nav/pages/tools/json.html", session_id: "s2", visit_id: "v2" },
    ],
  },
});
