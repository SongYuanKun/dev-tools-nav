import { basicSetup, EditorView } from "codemirror";
import { Compartment, EditorState } from "@codemirror/state";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter } from "@codemirror/lint";

const lintCompartment = new Compartment();

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

export function mountJsonWorkbench(mount) {
  const statusNode = document.querySelector("[data-json-selection-status]");
  const state = EditorState.create({
    doc: mount.dataset.initialValue ?? "",
    extensions: [
      basicSetup,
      json(),
      lintCompartment.of(linter(jsonParseLinter())),
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
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountAvailableEditors, { once: true });
} else {
  mountAvailableEditors();
}
