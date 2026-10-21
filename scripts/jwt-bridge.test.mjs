import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

class Element {
  constructor(id, attributes = {}) {
    this.id = id;
    this.attributes = new Map(Object.entries(attributes));
    this.classList = { toggle() {} };
    this.listeners = new Map();
    this.value = "";
    this.hidden = false;
  }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
}

async function boot(payload) {
  const payloadField = new Element("jwtGenPayload");
  const tabs = ["decode", "generate", "verify"].map((name) => new Element(`tab-${name}`, { "data-jwt-tab": name }));
  const panels = ["decode", "generate", "verify"].map((name) => new Element(`panel-${name}`, { "data-jwt-panel": name }));
  const ids = new Map([["jwtGenPayload", payloadField]]);
  const storage = new Map([["jwt_encode_payload_v1", payload]]);
  const notices = [];
  const document = {
    readyState: "complete",
    getElementById: (id) => ids.get(id),
    querySelector: (selector) => selector === "[data-jwt-tab]" ? tabs[0] : undefined,
    querySelectorAll: (selector) => selector === "[data-jwt-tab]" ? tabs : selector === "[data-jwt-panel]" ? panels : [],
  };
  const window = { ToolChrome: { showToast: (message) => notices.push(message) } };
  window.top = window;
  const context = {
    window,
    document,
    sessionStorage: { getItem: (key) => storage.get(key) ?? null, removeItem: (key) => storage.delete(key) },
    alert: (message) => notices.push(message),
    navigator: { clipboard: { writeText: async () => {} } },
    setTimeout,
    clearTimeout,
  };
  vm.runInNewContext(await readFile(new URL("../js/jwt-tool.js", import.meta.url), "utf8"), context);
  return { payloadField, panels, storage, notices };
}

test("JWT generator consumes one validated JSON payload from the workbench", async () => {
  const payload = '{\n  "sub": "bridge",\n  "roles": ["reader"]\n}';
  const result = await boot(payload);
  assert.equal(result.payloadField.value, payload);
  assert.equal(result.panels.find((panel) => panel.getAttribute("data-jwt-panel") === "generate").hidden, false);
  assert.equal(result.storage.has("jwt_encode_payload_v1"), false);
});

test("JWT generator discards an invalid transferred payload after one read", async () => {
  const result = await boot('{"sub":');
  assert.equal(result.payloadField.value, "");
  assert.equal(result.storage.has("jwt_encode_payload_v1"), false);
  assert.match(result.notices[0], /Payload 无效/);
});
