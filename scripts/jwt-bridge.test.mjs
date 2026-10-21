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
    this.children = [];
    this.value = "";
    this.hidden = false;
    this.style = {};
    this.innerHTML = "";
    this.textContent = "";
  }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  removeChild(child) { this.children.splice(this.children.indexOf(child), 1); child.parentNode = null; }
  querySelector(selector) {
    if (selector === "a") return this.anchor ??= new Element("cta-anchor");
    return null;
  }
  click() { this.listeners.get("click")?.(); }
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

test("JWT decode preserves the signature heading and navigates an iframe CTA at top level", async () => {
  const jwtInput = new Element("jwtInput");
  const sample = new Element("btnSample");
  const signatureSection = new Element("sectionSignature");
  const signatureHeading = new Element("signature-heading");
  signatureHeading.textContent = "Signature（签名）";
  signatureSection.appendChild(signatureHeading);
  const signatureBody = new Element("signatureBody");
  const payloadSection = new Element("sectionPayload");
  const ids = new Map([
    ["jwtInput", jwtInput], ["btnSample", sample], ["sectionHeader", new Element("sectionHeader")], ["sectionPayload", payloadSection], ["sectionSignature", signatureSection], ["signatureBody", signatureBody], ["headerSummary", new Element("headerSummary")], ["headerJson", new Element("headerJson")], ["payloadClaims", new Element("payloadClaims")], ["jwtGlobalStatus", new Element("jwtGlobalStatus")],
  ]);
  const tabs = ["decode", "generate", "verify"].map((name) => new Element(`tab-${name}`, { "data-jwt-tab": name }));
  const panels = ["decode", "generate", "verify"].map((name) => new Element(`panel-${name}`, { "data-jwt-panel": name }));
  const document = {
    readyState: "complete",
    getElementById: (id) => ids.get(id),
    createElement: (name) => new Element(name),
    querySelector: (selector) => selector === "[data-jwt-tab]" ? tabs[0] : null,
    querySelectorAll: (selector) => selector === "[data-jwt-tab]" ? tabs : selector === "[data-jwt-panel]" ? panels : [],
  };
  const top = { location: { href: "" } };
  const frame = { location: { href: "https://tools.songyuankun.top/pages/tools/jwt.html?embed=1" }, top, ToolChrome: { ready: (callback) => callback(), showToast() {} } };
  const context = { window: frame, document, sessionStorage: { setItem() {} }, navigator: { clipboard: { writeText: async () => {} } }, URL, atob, TextDecoder, setTimeout, clearTimeout };
  vm.runInNewContext(await readFile(new URL("../js/jwt-tool.js", import.meta.url), "utf8"), context);
  sample.click();
  assert.equal(signatureSection.children[0], signatureHeading);
  assert.match(signatureBody.innerHTML, /原始签名段/, ids.get("jwtGlobalStatus").innerHTML);
  const cta = payloadSection.children.at(-1).querySelector("a");
  cta.click();
  assert.equal(top.location.href, "https://tools.songyuankun.top/tools/json/?from_jwt=1");
  assert.equal(frame.location.href, "https://tools.songyuankun.top/pages/tools/jwt.html?embed=1");
});
