import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

class Element {
  constructor(tagName) { this.tagName = tagName; this.children = []; this.attributes = new Map(); this.listeners = new Map(); this.parentNode = null; this.textContent = ""; }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  removeChild(child) { this.children.splice(this.children.indexOf(child), 1); child.parentNode = null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(name, callback, options) { this.listeners.set(name, { callback, once: options?.once }); }
  click() { const listener = this.listeners.get("click"); if (!listener) return; if (listener.once) this.listeners.delete("click"); listener.callback(); }
}

function find(root, predicate) {
  if (predicate(root)) return root;
  for (const child of root.children) { const found = find(child, predicate); if (found) return found; }
  return null;
}

test("Toast renders, invokes its action once, tracks it, and removes itself", async () => {
  const body = new Element("body");
  const document = { body, createElement: (tagName) => new Element(tagName), getElementById: (id) => find(body, (node) => node.id === id) };
  const events = [];
  const context = { document, window: { umami: { track: (name, data) => events.push({ name, data }) } }, setTimeout, clearTimeout };
  vm.runInNewContext(await readFile(new URL("../js/toast.js", import.meta.url), "utf8"), context);
  let actionCalls = 0;
  const handle = context.window.Toast.show({ type: "error", title: "JSON 语法有误", msg: "缺少逗号", fixHint: "补上逗号", actionText: "查看教程", onAction: () => { actionCalls += 1; }, duration: 0, op: "OP-test" });
  const stack = document.getElementById("toastStack");
  const toast = stack.children[0];
  assert.equal(stack.getAttribute("aria-live"), "polite");
  assert.equal(toast.getAttribute("role"), "alert");
  const action = find(toast, (node) => node.className === "toast__action");
  action.click();
  action.click();
  assert.equal(actionCalls, 1);
  assert.equal(stack.children.length, 0);
  assert.deepEqual(events.map(({ name }) => name), ["toast_show", "toast_action_click"]);
  assert.equal(typeof handle.close, "function");
});
