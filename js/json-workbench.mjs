import { basicSetup, EditorView } from "codemirror";
import { isolateHistory } from "@codemirror/commands";
import { Compartment, EditorState } from "@codemirror/state";
import { json } from "@codemirror/lang-json";
import { forceLinting, linter } from "@codemirror/lint";
import {
  escapeUnicode,
  formatJson,
  minifyJson,
  parseJson,
  repairJson,
  sortJsonKeys,
  unescapeUnicode,
} from "./json-core.mjs";

const AUTO_DIAGNOSTIC_LIMIT = 1024 * 1024;
const UPLOAD_LIMIT = 5 * 1024 * 1024;
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
