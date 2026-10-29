import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

function bootJwt(extraIds = {}) {
  const jwtInput = { value: "", listeners: new Map(), addEventListener(name, cb) { this.listeners.set(name, cb); } };
  const statusEl = { className: "", innerHTML: "" };
  const auditState = { textContent: "" };
  const auditList = { innerHTML: "", textContent: "" };
  const payloadClaims = { innerHTML: "" };
  const headerSummary = { innerHTML: "" };
  const headerJson = { textContent: "" };
  const signatureBody = { innerHTML: "" };
  const skew = { value: "60", addEventListener() {} };
  const ids = new Map(Object.entries({
    jwtInput,
    jwtGlobalStatus: statusEl,
    jwtAuditState: auditState,
    jwtAuditList: auditList,
    payloadClaims,
    headerSummary,
    headerJson,
    signatureBody,
    sectionHeader: { hidden: true },
    sectionPayload: { hidden: true, querySelector() { return null; }, appendChild() {} },
    sectionSignature: { hidden: true },
    jwtClockSkew: skew,
    jwtVerifyOut: { textContent: "" },
    jwtVerifyState: { textContent: "" },
    jwtGenOutput: { value: "" },
    ...extraIds,
  }));
  const tabs = ["decode", "generate", "verify"].map((name) => ({
    getAttribute: () => name,
    setAttribute() {},
    classList: { toggle() {} },
    addEventListener() {},
  }));
  tabs.forEach((tab, index) => {
    tab.getAttribute = () => ["decode", "generate", "verify"][index];
    Object.defineProperty(tab, "attributes", { value: { "data-jwt-tab": ["decode", "generate", "verify"][index] } });
  });
  const panels = ["decode", "generate", "verify"].map((name) => ({
    getAttribute: () => name,
    hidden: name !== "decode",
  }));
  panels.forEach((panel, index) => {
    panel.getAttribute = (key) => (key === "data-jwt-panel" ? ["decode", "generate", "verify"][index] : null);
  });
  const document = {
    readyState: "complete",
    getElementById: (id) => ids.get(id) || null,
    querySelector: (sel) => (sel === "[data-jwt-tab]" ? tabs[0] : null),
    querySelectorAll: (sel) => {
      if (sel === "[data-jwt-tab]") return tabs;
      if (sel === "[data-jwt-panel]") return panels;
      return [];
    },
    createElement: () => ({
      className: "",
      style: { cssText: "" },
      innerHTML: "",
      querySelector() { return { addEventListener() {} }; },
      addEventListener() {},
    }),
    addEventListener() {},
  };
  const notices = [];
  const context = {
    window: {
      ToolChrome: {
        ready: (fn) => fn(),
        showToast: (msg) => notices.push(msg),
        copyText: async () => {},
        html: null,
      },
      umamiTrack() {},
      top: null,
    },
    document,
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    atob,
    btoa,
    TextDecoder,
    TextEncoder,
    URL,
    setTimeout,
    clearTimeout,
    Math,
    Date,
    JSON,
    Number,
    String,
    Object,
    Array,
    isFinite,
  };
  context.window.top = context.window;
  return { context, ids, notices, jwtInput, auditList, statusEl, run: async () => {
    vm.runInNewContext(await readFile(new URL("../js/jwt-tool.js", import.meta.url), "utf8"), context);
  } };
}

test("JWT decode warns on alg=none and surfaces clock-skew aware expiry copy", async () => {
  const harness = bootJwt();
  await harness.run();
  const noneToken =
    "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0." +
    btoa(JSON.stringify({ sub: "demo", exp: Math.floor(Date.now() / 1000) - 10 }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "") +
    ".";
  harness.jwtInput.value = noneToken;
  harness.jwtInput.listeners.get("input")();
  assert.match(harness.auditList.innerHTML, /alg=none/);
  assert.match(harness.statusEl.innerHTML, /alg=none|已过期|边界过期|时钟/);
});

test("JWT tool documents browser-only JWKS failure mode", async () => {
  const source = await readFile(new URL("../js/jwt-tool.js", import.meta.url), "utf8");
  assert.match(source, /CORS/);
  assert.match(source, /fetchJwksAndPickKey/);
  assert.match(source, /readSkewSeconds/);
  const html = await readFile(new URL("../pages/tools/jwt.html", import.meta.url), "utf8");
  assert.match(html, /jwtJwksUrl/);
  assert.match(html, /jwtClockSkew/);
  assert.match(html, /btnJwtFetchJwks/);
});
