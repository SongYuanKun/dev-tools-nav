import { basicSetup, EditorView } from "codemirror";
import { isolateHistory } from "@codemirror/commands";
import { Compartment, EditorState } from "@codemirror/state";
import { json } from "@codemirror/lang-json";
import { forceLinting, linter } from "@codemirror/lint";
import { MergeView } from "@codemirror/merge";
import {
  diffJson,
  escapeUnicode,
  formatJson,
  jsonToYaml,
  minifyJson,
  parseJson,
  queryJsonPath,
  repairJson,
  sortJsonKeys,
  unescapeUnicode,
  yamlToJson,
} from "./json-core.mjs";

const AUTO_DIAGNOSTIC_LIMIT = 1024 * 1024;
const UPLOAD_LIMIT = 5 * 1024 * 1024;
const TREE_NODE_LIMIT = 2_000;
const PREFS_KEY = "json-workbench-prefs-v1";
const SAMPLE = JSON.stringify({ project: "JSON 工作台", private: true, features: ["格式化", "校验", "本地处理"] });
const DEFAULT_PREFS = Object.freeze({ indent: 2, relaxed: false, escapeUnicode: false });
const ACTION_KEYS = new Set(["format", "minify", "copy", "clear", "sample", "upload", "download", "repair", "sort", "unicode", "validate", "diff"]);
const lintCompartment = new Compartment();

function safePreferences() {
  try {
    const value = JSON.parse(localStorage.getItem(PREFS_KEY));
    return {
      indent: value?.indent === 4 ? 4 : 2,
      relaxed: value?.relaxed === true,
      escapeUnicode: value?.escapeUnicode === true,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function savePreferences(preferences) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({
      indent: preferences.indent === 4 ? 4 : 2,
      relaxed: preferences.relaxed === true,
      escapeUnicode: preferences.escapeUnicode === true,
    }));
  } catch {
    // Preferences are optional; storage failures must not affect the editor.
  }
}

function track(action) {
  if (!ACTION_KEYS.has(action)) return;
  const properties = { tool: "json", action };
  try {
    if (typeof window.umamiTrack === "function") window.umamiTrack("tool_used", properties);
    else window.umami?.track?.("tool_used", properties);
  } catch {
    // Analytics is optional and receives no document-derived properties.
  }
}

function initializeToolPreferences() {
  if (!window.ToolsPrefs) return;
  try {
    window.ToolsPrefs.addRecent("json");
    const favorite = document.querySelector("[data-json-favorite]");
    if (!favorite) return;
    const label = favorite.querySelector("[data-json-favorite-label]");
    const render = () => {
      const active = window.ToolsPrefs.hasFavorite("json");
      favorite.setAttribute("aria-pressed", String(active));
      if (label) label.textContent = active ? "已收藏" : "收藏这个工具";
    };
    favorite.addEventListener("click", () => {
      try {
        window.ToolsPrefs.toggleFavorite("json");
        render();
      } catch {
        // Storage can be unavailable in privacy-hardened browsers.
      }
    });
    render();
  } catch {
    // Preferences are optional and must never block the editor.
  }
}

function initializeModeTabs() {
  const tablist = document.querySelector('[role="tablist"][aria-label="JSON 工作模式"]');
  if (!tablist || tablist.dataset.ready === "true") return;
  const tabs = [...tablist.querySelectorAll('[role="tab"][data-json-mode]')];
  const panels = [...document.querySelectorAll('[role="tabpanel"][data-json-panel]')];
  const activate = (tab, focus = false) => {
    const mode = tab.dataset.jsonMode;
    for (const candidate of tabs) {
      const active = candidate === tab;
      candidate.setAttribute("aria-selected", String(active));
      candidate.tabIndex = active ? 0 : -1;
    }
    for (const panel of panels) {
      const active = panel.dataset.jsonPanel === mode;
      panel.hidden = !active;
    }
    document.dispatchEvent(new CustomEvent("json-mode-change", { detail: { mode } }));
    if (focus) tab.focus();
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activate(tab));
    tab.addEventListener("keydown", (event) => {
      let nextIndex = null;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = tabs.length - 1;
      if (nextIndex === null) return;
      event.preventDefault();
      activate(tabs[nextIndex], true);
    });
  });
  tablist.dataset.ready = "true";
}

function jsonPathFor(parent, key) {
  if (parent === "$" && typeof key === "number") return `$[${key}]`;
  if (typeof key === "number") return `${parent}[${key}]`;
  if (/^[A-Za-z_$][\w$]*$/.test(key)) return `${parent}.${key}`;
  return `${parent}[${JSON.stringify(key)}]`;
}

function valueType(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function renderTreePanel(panel, text, preferences, announce, force = false) {
  panel.replaceChildren();
  if (!force && bytes(text) > AUTO_DIAGNOSTIC_LIMIT) {
    const empty = document.createElement("div");
    empty.className = "json-empty-state";
    const heading = document.createElement("h2");
    heading.textContent = "数据超过 1 MiB";
    const message = document.createElement("p");
    message.textContent = "为避免页面卡顿，树视图需要手动生成。";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "json-button json-button-primary";
    button.textContent = "仍然生成树";
    button.addEventListener("click", () => renderTreePanel(panel, text, preferences, announce, true));
    empty.append(heading, message, button);
    panel.append(empty);
    return;
  }
  const parsed = parseJson(text, { relaxed: preferences.relaxed });
  if (!parsed.ok) {
    const empty = document.createElement("div");
    empty.className = "json-empty-state";
    const heading = document.createElement("h2");
    heading.textContent = "无法生成树";
    const message = document.createElement("p");
    message.textContent = `JSON 无效：${parsed.error.message}`;
    empty.append(heading, message);
    panel.append(empty);
    return;
  }

  const setTreeExpanded = (toggle, group, expanded) => {
    const path = toggle.dataset.jsonTreePath ?? "$";
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.textContent = expanded ? "▾" : "▸";
    toggle.setAttribute("aria-label", `${expanded ? "折叠" : "展开"} ${path}`);
    group.hidden = !expanded;
  };
  const toolbar = document.createElement("div");
  toolbar.className = "json-mode-toolbar";
  for (const [label, expanded] of [["全部展开", true], ["全部折叠", false]]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "json-button";
    button.textContent = label;
    button.addEventListener("click", () => {
      panel.querySelectorAll(".json-tree-toggle").forEach((toggle) => {
        const group = document.getElementById(toggle.getAttribute("aria-controls"));
        if (group) setTreeExpanded(toggle, group, expanded);
      });
    });
    toolbar.append(button);
  }

  const tree = document.createElement("div");
  tree.className = "json-tree";
  tree.setAttribute("role", "tree");
  tree.setAttribute("aria-label", "JSON 数据树");
  let nodeId = 0;
  let renderedNodes = 0;
  let treeTruncated = false;
  const makeNode = (key, value, path, root = false) => {
    renderedNodes += 1;
    const item = document.createElement("div");
    item.className = "json-tree-item";
    item.setAttribute("role", "treeitem");
    const row = document.createElement("div");
    row.className = "json-tree-row";
    const type = valueType(value);
    const container = type === "object" || type === "array";
    let group;
    if (container) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "json-tree-toggle";
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", `折叠 ${path}`);
      toggle.dataset.jsonTreePath = path;
      const id = `json-tree-group-${nodeId += 1}`;
      toggle.setAttribute("aria-controls", id);
      toggle.textContent = "▾";
      toggle.addEventListener("click", () => {
        const next = toggle.getAttribute("aria-expanded") !== "true";
        setTreeExpanded(toggle, group, next);
      });
      row.append(toggle);
      group = document.createElement("div");
      group.id = id;
      group.className = "json-tree-group";
      group.setAttribute("role", "group");
    }
    const keyNode = document.createElement("span");
    keyNode.className = "json-tree-key";
    keyNode.textContent = root ? "$" : String(key);
    const typeNode = document.createElement("span");
    typeNode.className = `json-tree-type json-tree-type-${type}`;
    const count = container ? ` · ${Object.keys(value).length} 项` : "";
    typeNode.textContent = `${type}${count}`;
    row.append(keyNode, typeNode);
    if (!container) {
      const valueNode = document.createElement("span");
      valueNode.className = "json-tree-value";
      valueNode.textContent = typeof value === "string" ? JSON.stringify(value) : String(value);
      row.append(valueNode);
    }
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "json-tree-copy";
    copy.setAttribute("aria-label", `复制路径 ${path}`);
    copy.textContent = path;
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(path);
        announce(`已复制路径 ${path}`);
      } catch {
        announce("复制路径失败，请检查剪贴板权限。", true);
      }
    });
    row.append(copy);
    item.append(row);
    if (container) {
      const keys = Object.keys(value);
      for (const childKey of keys) {
        if (renderedNodes >= TREE_NODE_LIMIT) {
          if (!treeTruncated) {
            const notice = document.createElement("p");
            notice.className = "json-mode-hint";
            notice.setAttribute("role", "status");
            notice.textContent = `为保证流畅，仅显示前 ${TREE_NODE_LIMIT} 个节点。`;
            group.append(notice);
            treeTruncated = true;
          }
          break;
        }
        const normalizedKey = Array.isArray(value) ? Number(childKey) : childKey;
        group.append(makeNode(normalizedKey, value[childKey], jsonPathFor(path, normalizedKey)));
      }
      item.append(group);
    }
    return item;
  };
  tree.append(makeNode("$", parsed.value, "$", true));
  panel.append(toolbar, tree);
}

function initializeJsonPathPanel(panel, source, preferences, announce) {
  if (panel.dataset.ready === "true") return;
  panel.replaceChildren();
  panel.dataset.ready = "true";
  const layout = document.createElement("div");
  layout.className = "json-mode-layout jsonpath-layout";
  const controls = document.createElement("div");
  const label = document.createElement("label");
  label.htmlFor = "jsonPathInput";
  label.textContent = "JSONPath 表达式";
  const input = document.createElement("input");
  input.id = "jsonPathInput";
  input.dataset.jsonpathInput = "";
  input.value = "$";
  input.autocomplete = "off";
  const hint = document.createElement("p");
  hint.className = "json-mode-hint";
  hint.textContent = "支持对象键、数组下标和带引号的属性名；按 Enter 查询。";
  const history = document.createElement("div");
  history.className = "jsonpath-history";
  history.setAttribute("aria-label", "本次会话查询历史");
  controls.append(label, input, hint, history);

  const output = document.createElement("div");
  const heading = document.createElement("div");
  heading.className = "json-mode-result-heading";
  const count = document.createElement("strong");
  count.dataset.jsonpathCount = "";
  count.textContent = "尚未查询";
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "json-button";
  copy.textContent = "复制结果";
  copy.setAttribute("aria-label", "复制 JSONPath 结果");
  copy.disabled = true;
  heading.append(count, copy);
  const error = document.createElement("p");
  error.className = "json-mode-error";
  error.dataset.jsonpathError = "";
  error.setAttribute("role", "alert");
  const results = document.createElement("pre");
  results.dataset.jsonpathResults = "";
  results.tabIndex = 0;
  output.append(heading, error, results);
  layout.append(controls, output);
  panel.append(layout);

  let resultText = "";
  const queries = [];
  const renderHistory = () => {
    history.replaceChildren();
    for (const query of queries) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "json-history-chip";
      button.textContent = query;
      button.setAttribute("aria-label", `历史：${query}`);
      button.addEventListener("click", () => {
        input.value = query;
        input.focus();
      });
      history.append(button);
    }
  };
  const run = () => {
    const rawQuery = input.value;
    const query = rawQuery.trim();
    if (query && !queries.includes(query)) {
      queries.unshift(query);
      if (queries.length > 8) queries.pop();
      renderHistory();
    }
    results.textContent = "";
    resultText = "";
    copy.disabled = true;
    const parsed = parseJson(source(), { relaxed: preferences.relaxed });
    if (!parsed.ok) {
      count.textContent = "0 个匹配";
      error.textContent = `主 JSON 无效：${parsed.error.message}`;
      return;
    }
    const result = queryJsonPath(parsed.value, rawQuery);
    if (!result.ok) {
      count.textContent = "0 个匹配";
      const position = typeof result.error.offset === "number" ? `（位置 ${result.error.offset + 1}）` : "";
      error.textContent = `${result.error.message}${position}`;
      return;
    }
    error.textContent = "";
    resultText = JSON.stringify(result.value, null, 2);
    count.textContent = "1 个匹配";
    results.textContent = `${query}\n${resultText}`;
    copy.disabled = false;
  };
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    run();
  });
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(resultText);
      announce("已复制 JSONPath 结果");
    } catch {
      announce("复制结果失败，请检查剪贴板权限。", true);
    }
  });
}

function initializeYamlPanel(panel, source, replaceDocument, preferences, announce) {
  if (panel.dataset.ready === "true") return;
  panel.replaceChildren();
  panel.dataset.ready = "true";
  const toolbar = document.createElement("div");
  toolbar.className = "json-mode-toolbar";
  const refresh = document.createElement("button");
  refresh.type = "button";
  refresh.className = "json-button json-button-primary";
  refresh.textContent = "JSON → YAML";
  refresh.setAttribute("aria-label", "JSON 转为 YAML");
  const apply = document.createElement("button");
  apply.type = "button";
  apply.className = "json-button";
  apply.textContent = "应用为 JSON";
  apply.setAttribute("aria-label", "应用 YAML 为 JSON");
  toolbar.append(refresh, apply);
  const error = document.createElement("p");
  error.className = "json-mode-error";
  error.dataset.yamlError = "";
  error.setAttribute("role", "alert");
  const mount = document.createElement("div");
  mount.className = "json-secondary-editor";
  mount.dataset.yamlEditor = "";
  panel.append(toolbar, error, mount);
  const yamlView = new EditorView({
    state: EditorState.create({
      doc: "",
      extensions: [basicSetup, EditorView.contentAttributes.of({ "aria-label": "YAML 编辑器" })],
    }),
    parent: mount,
  });
  const yamlSource = () => yamlView.state.doc.toString();
  const replaceYaml = (text) => yamlView.dispatch({
    changes: { from: 0, to: yamlView.state.doc.length, insert: text },
    selection: { anchor: 0 },
  });
  refresh.addEventListener("click", () => {
    const parsed = parseJson(source(), { relaxed: preferences.relaxed });
    if (!parsed.ok) {
      error.textContent = `JSON 转换失败：${parsed.error.message}`;
      return;
    }
    replaceYaml(jsonToYaml(parsed.value));
    error.textContent = "";
    announce("已从主 JSON 刷新 YAML");
  });
  apply.addEventListener("click", () => {
    const result = yamlToJson(yamlSource());
    if (!result.ok) {
      error.textContent = `YAML 转换失败：${result.error.message}`;
      return;
    }
    replaceDocument(JSON.stringify(result.value, null, preferences.indent));
    error.textContent = "";
    announce("已将 YAML 应用为主 JSON");
  });
}

function initializeDiffPanel(panel, source, replaceDocument, preferences, announce, force = false) {
  if (panel.dataset.ready === "true") return;
  panel.replaceChildren();
  const initialSource = source();
  if (!force && bytes(initialSource) > AUTO_DIAGNOSTIC_LIMIT) {
    const empty = document.createElement("div");
    empty.className = "json-empty-state";
    const heading = document.createElement("h2");
    heading.textContent = "数据超过 1 MiB";
    const message = document.createElement("p");
    message.textContent = "为避免页面卡顿，Diff 需要手动打开。";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "json-button json-button-primary";
    button.textContent = "仍然打开对比";
    button.addEventListener("click", () => initializeDiffPanel(panel, source, replaceDocument, preferences, announce, true));
    empty.append(heading, message, button);
    panel.append(empty);
    return;
  }
  panel.dataset.ready = "true";
  const toolbar = document.createElement("div");
  toolbar.className = "json-mode-toolbar json-diff-toolbar";
  const controls = [
    ["以主 JSON 重置左侧", "重置左侧"],
    ["应用左侧为主 JSON", "应用左侧"],
    ["应用右侧为主 JSON", "应用右侧"],
    ["更新结构差异汇总", "更新汇总"],
  ].map(([label, text]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `json-button${label.startsWith("以主") ? " json-button-primary" : ""}`;
    button.setAttribute("aria-label", label);
    button.textContent = text;
    toolbar.append(button);
    return button;
  });
  const summary = document.createElement("p");
  summary.className = "json-diff-summary";
  summary.dataset.diffSummary = "";
  summary.setAttribute("role", "status");
  const error = document.createElement("p");
  error.className = "json-mode-error";
  error.dataset.diffError = "";
  error.setAttribute("role", "alert");
  const mount = document.createElement("div");
  mount.className = "json-merge-shell";
  mount.dataset.diffMerge = "";
  panel.append(toolbar, summary, error, mount);
  let merge;
  let diffTracked = false;
  let summaryTimer;
  const renderSummary = (forceSummary = false) => {
    if (!merge) return;
    const left = merge.a.state.doc.toString();
    const right = merge.b.state.doc.toString();
    if (!right.trim()) {
      summary.textContent = "在右侧输入 JSON 后显示结构差异";
      return;
    }
    if (!forceSummary && bytes(left) + bytes(right) > AUTO_DIAGNOSTIC_LIMIT) {
      summary.textContent = "内容超过 1 MiB，已暂停自动结构汇总；可手动更新。";
      return;
    }
    const leftParsed = parseJson(left, { relaxed: preferences.relaxed });
    const rightParsed = parseJson(right, { relaxed: preferences.relaxed });
    if (!leftParsed.ok || !rightParsed.ok) {
      summary.textContent = "等待两侧有效 JSON";
      return;
    }
    if (right.trim() && !diffTracked) {
      track("diff");
      diffTracked = true;
    }
    const changes = diffJson(leftParsed.value, rightParsed.value).changes;
    if (changes.length === 0) {
      summary.textContent = "无结构差异";
      return;
    }
    const counts = { added: 0, removed: 0, changed: 0 };
    changes.forEach((change) => { counts[change.type] += 1; });
    summary.textContent = `新增 ${counts.added} · 删除 ${counts.removed} · 修改 ${counts.changed}`;
  };
  const scheduleSummary = () => {
    clearTimeout(summaryTimer);
    summaryTimer = setTimeout(renderSummary, 220);
  };
  const updateSummary = EditorView.updateListener.of((update) => {
    if (update.docChanged) scheduleSummary();
  });
  merge = new MergeView({
    a: {
      doc: initialSource,
      extensions: [basicSetup, json(), updateSummary, EditorView.contentAttributes.of({ "aria-label": "Diff 左侧 JSON 编辑器" })],
    },
    b: {
      doc: "",
      extensions: [basicSetup, json(), updateSummary, EditorView.contentAttributes.of({ "aria-label": "Diff 右侧 JSON 编辑器" })],
    },
    parent: mount,
    orientation: "a-b",
    gutter: true,
    highlightChanges: true,
    diffConfig: { scanLimit: 500, timeout: 100 },
  });
  merge.a.dom.dataset.diffLeft = "";
  merge.b.dom.dataset.diffRight = "";
  renderSummary();
  const replaceSide = (view, text) => view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
    selection: { anchor: 0 },
  });
  controls[0].addEventListener("click", () => {
    replaceSide(merge.a, source());
    error.textContent = "";
    announce("左侧已重置为当前主 JSON");
  });
  const applySide = (side, label) => {
    const text = side.state.doc.toString();
    const parsed = parseJson(text, { relaxed: preferences.relaxed });
    if (!parsed.ok) {
      error.textContent = `${label} JSON 无效：${parsed.error.message}`;
      return;
    }
    replaceDocument(text);
    error.textContent = "";
    announce(`已应用${label}为主 JSON`);
  };
  controls[1].addEventListener("click", () => applySide(merge.a, "左侧"));
  controls[2].addEventListener("click", () => applySide(merge.b, "右侧"));
  controls[3].addEventListener("click", () => {
    clearTimeout(summaryTimer);
    renderSummary(true);
  });
}

function updateSelectionStatus(view, node) {
  if (!node) return;
  const selection = view.state.selection.main;
  const selected = Math.abs(selection.to - selection.from);
  const line = view.state.doc.lineAt(selection.head);
  const column = selection.head - line.from + 1;
  node.textContent = selected > 0
    ? `第 ${line.number} 行，第 ${column} 列 · 已选 ${selected} 字符`
    : `第 ${line.number} 行，第 ${column} 列`;
}

function bytes(text) {
  return new TextEncoder().encode(text).byteLength;
}

function differenceSummary(before, after) {
  let changed = Math.abs(before.length - after.length);
  const length = Math.min(before.length, after.length);
  for (let index = 0; index < length; index += 1) {
    if (before[index] !== after[index]) changed += 1;
  }
  return `将修改约 ${changed} 个字符；确认后才会覆盖编辑器内容。`;
}

export function mountJsonWorkbench(mount) {
  const statusNode = document.querySelector("[data-json-selection-status]");
  const countsNode = document.querySelector("[data-json-counts]");
  const validityNode = document.querySelector("[data-json-status]");
  const errorBanner = document.querySelector("[data-json-error]");
  const errorMessage = document.querySelector("[data-json-error-message]");
  const feedback = document.querySelector("[data-json-feedback]");
  const settingsDialog = document.querySelector("[data-json-settings-dialog]");
  const repairDialog = document.querySelector("[data-json-repair-dialog]");
  const preferences = safePreferences();
  let currentError = null;
  let diagnosticTimer;

  const announce = (message, error = false) => {
    if (!feedback) return;
    feedback.textContent = message;
    feedback.dataset.kind = error ? "error" : "success";
  };
  const source = () => view.state.doc.toString();
  const replaceDocument = (text) => view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
    selection: { anchor: 0 },
    scrollIntoView: true,
    annotations: isolateHistory.of("full"),
  });
  const renderDiagnostics = () => {
    const text = source();
    if (!text) {
      currentError = null;
      errorBanner.hidden = true;
      validityNode.innerHTML = '<i aria-hidden="true"></i>等待输入';
      delete validityNode.dataset.valid;
      return;
    }
    if (bytes(text) > AUTO_DIAGNOSTIC_LIMIT) {
      currentError = null;
      errorBanner.hidden = true;
      validityNode.innerHTML = '<i aria-hidden="true"></i>超过 1 MiB，已暂停自动校验';
      delete validityNode.dataset.valid;
      return;
    }
    const result = parseJson(text, { relaxed: preferences.relaxed });
    if (result.ok) {
      currentError = null;
      errorBanner.hidden = true;
      validityNode.innerHTML = '<i aria-hidden="true"></i>JSON 有效';
      validityNode.dataset.valid = "true";
      return;
    }
    currentError = result.error;
    errorMessage.textContent = `${result.error.message} · 第 ${result.error.line} 行，第 ${result.error.column} 列`;
    errorBanner.hidden = false;
    validityNode.innerHTML = '<i aria-hidden="true"></i>JSON 无效';
    validityNode.dataset.valid = "false";
  };
  const scheduleDiagnostics = () => {
    clearTimeout(diagnosticTimer);
    diagnosticTimer = setTimeout(renderDiagnostics, 220);
  };
  const diagnostics = (editor) => {
    if (editor.state.doc.length === 0) return [];
    const text = editor.state.doc.toString();
    if (bytes(text) > AUTO_DIAGNOSTIC_LIMIT) return [];
    const result = parseJson(text, { relaxed: preferences.relaxed });
    if (result.ok) return [];
    const from = Math.min(result.error.offset, editor.state.doc.length);
    return [{ from, to: Math.min(from + 1, editor.state.doc.length), severity: "error", message: result.error.message }];
  };
  const updateDocumentStatus = () => {
    const text = source();
    countsNode.textContent = `${text.length} 字符 · ${bytes(text)} B`;
    scheduleDiagnostics();
  };

  const state = EditorState.create({
    doc: mount.dataset.initialValue ?? "",
    extensions: [
      basicSetup,
      json(),
      lintCompartment.of(linter(diagnostics, { delay: 220 })),
      EditorView.updateListener.of((update) => {
        if (update.selectionSet || update.docChanged) updateSelectionStatus(update.view, statusNode);
        if (update.docChanged) updateDocumentStatus();
      }),
    ],
  });
  const view = new EditorView({ state, parent: mount });

  document.addEventListener("json-mode-change", (event) => {
    const mode = event.detail?.mode;
    const panel = document.querySelector(`[data-json-panel="${mode}"]`);
    if (mode === "tree" && panel) renderTreePanel(panel, source(), preferences, announce);
    if (mode === "jsonpath" && panel) initializeJsonPathPanel(panel, source, preferences, announce);
    if (mode === "yaml" && panel) initializeYamlPanel(panel, source, replaceDocument, preferences, announce);
    if (mode === "diff" && panel) initializeDiffPanel(panel, source, replaceDocument, preferences, announce);
  });

  const transform = (action) => {
    const result = action === "format"
      ? formatJson(source(), { relaxed: preferences.relaxed, indent: preferences.indent })
      : minifyJson(source(), { relaxed: preferences.relaxed });
    if (!result.ok) {
      renderDiagnostics();
      announce("操作失败，请先修正 JSON 语法。", true);
      return false;
    }
    const output = preferences.escapeUnicode ? escapeUnicode(result.text) : result.text;
    replaceDocument(output);
    track(action);
    announce(action === "format" ? "已格式化" : "已压缩");
    return true;
  };

  document.querySelectorAll("[data-json-action]").forEach((control) => {
    const action = control.dataset.jsonAction;
    if (action === "upload") {
      control.addEventListener("change", async () => {
        const file = control.files?.[0];
        if (!file) return;
        if (file.size > UPLOAD_LIMIT) {
          announce("文件不能超过 5 MiB。", true);
          control.value = "";
          return;
        }
        const allowed = /\.(?:json|ya?ml|txt)$/i.test(file.name)
          || ["application/json", "text/plain", "application/yaml", "text/yaml"].includes(file.type);
        if (!allowed) {
          announce("仅支持 JSON、YAML 或文本文件。", true);
          control.value = "";
          return;
        }
        try {
          replaceDocument(await file.text());
          const fileState = document.querySelector(".json-file-state");
          if (fileState) fileState.textContent = file.name;
          track("upload");
          announce("文件已载入，内容仍只在本地处理。");
        } catch {
          announce("无法读取该文件。", true);
        } finally {
          control.value = "";
        }
      });
      return;
    }
    control.addEventListener("click", async () => {
      if (action === "format" || action === "minify") transform(action);
      else if (action === "validate") {
        const result = parseJson(source(), { relaxed: preferences.relaxed });
        renderDiagnostics();
        forceLinting(view);
        if (result.ok) {
          track(action);
          announce("校验通过，JSON 语法有效。");
        } else {
          announce(`校验失败：${result.error.message}`, true);
        }
      } else if (action === "sort") {
        const result = parseJson(source(), { relaxed: preferences.relaxed });
        if (!result.ok) {
          renderDiagnostics();
          announce("排序失败，请先修正 JSON 语法。", true);
          return;
        }
        let output = JSON.stringify(sortJsonKeys(result.value), null, preferences.indent);
        if (preferences.escapeUnicode) output = escapeUnicode(output);
        replaceDocument(output);
        track(action);
        announce("已按键名递归排序");
      } else if (action === "unicode") {
        const parsed = parseJson(source(), { relaxed: preferences.relaxed });
        if (!parsed.ok) {
          renderDiagnostics();
          announce("Unicode 转换失败，请先修正 JSON 语法。", true);
          return;
        }
        const decoded = unescapeUnicode(source());
        const shouldDecode = decoded.ok && decoded.text !== source();
        let output = escapeUnicode(source());
        if (shouldDecode) {
          output = parseJson(decoded.text, { relaxed: preferences.relaxed }).ok
            ? decoded.text
            : JSON.stringify(parsed.value, null, preferences.indent);
        }
        replaceDocument(output);
        track(action);
        announce(shouldDecode ? "已还原 Unicode 字符" : "已转换为 Unicode 转义");
      } else if (action === "sample") {
        replaceDocument(SAMPLE);
        track(action);
        announce("示例已载入");
      } else if (action === "clear") {
        replaceDocument("");
        track(action);
        announce("已清空");
      } else if (action === "copy") {
        try {
          await navigator.clipboard.writeText(source());
          track(action);
          announce("已复制到剪贴板");
        } catch {
          announce("复制失败，请检查浏览器剪贴板权限。", true);
        }
      } else if (action === "download") {
        try {
          const url = URL.createObjectURL(new Blob([source()], { type: "application/json;charset=utf-8" }));
          const link = document.createElement("a");
          link.href = url;
          link.download = "formatted.json";
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 0);
          track(action);
          announce("下载已开始");
        } catch {
          announce("浏览器无法创建下载。", true);
        }
      } else if (action === "repair") {
        const result = repairJson(source());
        if (!result.ok) {
          announce(`修复失败：${result.error.message}`, true);
          return;
        }
        repairDialog.querySelector("[data-json-repair-summary]").textContent = differenceSummary(source(), result.text);
        repairDialog.dataset.repairedText = result.text;
        repairDialog.showModal();
      }
    });
  });

  document.querySelector("[data-json-locate]")?.addEventListener("click", () => {
    if (!currentError) return;
    const offset = Math.min(currentError.offset, view.state.doc.length);
    view.dispatch({ selection: { anchor: offset }, scrollIntoView: true });
    view.focus();
  });

  const settingsTrigger = document.querySelector("[data-json-settings]");
  settingsTrigger?.addEventListener("click", () => settingsDialog.showModal());
  settingsDialog?.addEventListener("close", () => settingsTrigger.focus());
  settingsDialog?.querySelectorAll("input").forEach((input) => {
    if (input.name === "indent") input.checked = Number(input.value) === preferences.indent;
    else input.checked = preferences[input.name] === true;
    input.addEventListener("change", () => {
      preferences.indent = Number(settingsDialog.querySelector('[name="indent"]:checked')?.value) === 4 ? 4 : 2;
      preferences.relaxed = settingsDialog.querySelector('[name="relaxed"]')?.checked === true;
      preferences.escapeUnicode = settingsDialog.querySelector('[name="escapeUnicode"]')?.checked === true;
      savePreferences(preferences);
      document.querySelector("[data-json-indent-status]").textContent = `缩进 ${preferences.indent} 空格`;
      renderDiagnostics();
      view.dispatch({ effects: lintCompartment.reconfigure(linter(diagnostics, { delay: 220 })) });
      forceLinting(view);
    });
  });
  settingsDialog?.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", () => settingsDialog.close()));
  repairDialog?.querySelector("[data-json-repair-apply]")?.addEventListener("click", () => {
    replaceDocument(repairDialog.dataset.repairedText ?? source());
    repairDialog.close();
    track("repair");
    announce("已应用安全修复");
  });
  repairDialog?.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", () => repairDialog.close()));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      transform("format");
    } else if (event.key.toLowerCase() === "m" && event.shiftKey && (event.metaKey || event.ctrlKey) && !event.altKey) {
      event.preventDefault();
      transform("minify");
    } else if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey) && !event.altKey) {
      event.preventDefault();
      const tab = document.querySelector('[role="tab"][data-json-mode="jsonpath"]');
      tab?.click();
      document.querySelector("[data-jsonpath-input]")?.focus();
    }
  });

  updateSelectionStatus(view, statusNode);
  updateDocumentStatus();
  document.querySelector("[data-json-indent-status]").textContent = `缩进 ${preferences.indent} 空格`;
  return view;
}

function mountAvailableEditors() {
  document.querySelectorAll("[data-json-editor]").forEach((mount) => {
    if (!mount.querySelector(".cm-editor")) mountJsonWorkbench(mount);
  });
  initializeModeTabs();
  initializeToolPreferences();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountAvailableEditors, { once: true });
} else {
  mountAvailableEditors();
}
