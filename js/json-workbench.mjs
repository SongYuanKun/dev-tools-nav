import { basicSetup, EditorView } from "codemirror";
import { Compartment, EditorState } from "@codemirror/state";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter } from "@codemirror/lint";

const lintCompartment = new Compartment();
const parseJsonLint = jsonParseLinter();

function lintJson(view) {
  if (view.state.doc.length === 0) return [];
  return parseJsonLint(view);
}

function updateSelectionStatus(view, statusNode) {
  if (!statusNode) return;
  const selection = view.state.selection.main;
  const selected = Math.abs(selection.to - selection.from);
  const line = view.state.doc.lineAt(selection.head);
  const column = selection.head - line.from + 1;
  statusNode.textContent = selected > 0
    ? `第 ${line.number} 行，第 ${column} 列 · 已选 ${selected} 字符`
    : `第 ${line.number} 行，第 ${column} 列`;
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

export function mountJsonWorkbench(mount) {
  const statusNode = document.querySelector("[data-json-selection-status]");
  const state = EditorState.create({
    doc: mount.dataset.initialValue ?? "",
    extensions: [
      basicSetup,
      json(),
      lintCompartment.of(linter(lintJson)),
      EditorView.updateListener.of((update) => {
        if (update.docChanged || update.selectionSet) {
          updateSelectionStatus(update.view, statusNode);
        }
      }),
    ],
  });
  const view = new EditorView({ state, parent: mount });
  updateSelectionStatus(view, statusNode);
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
