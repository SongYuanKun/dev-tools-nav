import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const BASE_JS = readFileSync(join(process.cwd(), "js/base.js"), "utf8");

function runBaseScript({ readyState = "interactive", pathname = "/index.html" } = {}) {
  const docListeners = new Map();
  const nav = { innerHTML: "" };
  const buttonListeners = [];
  const attrs = { "data-theme": "light" };
  const storage = new Map();

  const documentElement = {
    classList: { add() {} },
    getAttribute(name) {
      return attrs[name] ?? null;
    },
    setAttribute(name, value) {
      attrs[name] = String(value);
    },
  };

  const themeButton = {
    textContent: "",
    attrs: {},
    addEventListener(type, callback, options) {
      buttonListeners.push({ type, callback, options });
    },
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
  };

  const document = {
    readyState,
    referrer: "",
    title: "Test",
    documentElement,
    querySelector(selector) {
      return selector === "nav.navbar" ? nav : null;
    },
    getElementById(id) {
      return id === "themeToggle" ? themeButton : null;
    },
    addEventListener(type, callback) {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(callback);
    },
  };

  const localStorage = {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
  };

  const history = {
    pushState() {},
    replaceState() {},
  };

  const window = {
    screen: { width: 1280, height: 720 },
    navigator: { language: "zh-CN" },
    location: {
      pathname,
      search: "",
      hostname: "localhost",
      origin: "https://example.test",
    },
    document,
    ThemeManager: {
      applied: [],
      apply(theme) {
        this.applied.push(theme);
        documentElement.setAttribute("data-theme", theme);
      },
    },
    addEventListener() {},
  };

  vm.runInNewContext(BASE_JS, {
    URLSearchParams,
    document,
    fetch() {
      return Promise.resolve({ json: () => Promise.resolve({}) });
    },
    history,
    localStorage,
    setTimeout,
    window,
  });

  return {
    attrs,
    buttonListeners,
    docListeners,
    nav,
    storage,
    themeButton,
    window,
  };
}

test("shared nav is injected immediately once the parsed DOM is available", () => {
  const { docListeners, nav, window } = runBaseScript();

  assert.equal(window.__sharedNavReady, true);
  assert.match(nav.innerHTML, /id="searchInput"/);
  assert.match(nav.innerHTML, /href="pages\/ai\/index\.html"/);
  assert.equal(docListeners.get("DOMContentLoaded"), undefined);
});

test("shared nav waits for DOMContentLoaded only while the document is loading", () => {
  const { docListeners, nav, window } = runBaseScript({ readyState: "loading" });

  assert.equal(nav.innerHTML, "");
  assert.equal(window.__sharedNavReady, undefined);

  const domReadyListeners = docListeners.get("DOMContentLoaded");
  assert.equal(domReadyListeners.length, 1);
  domReadyListeners[0]();

  assert.equal(window.__sharedNavReady, true);
  assert.match(nav.innerHTML, /id="searchInput"/);
});

test("shared nav computes deep relative links before page initializers run", () => {
  const { nav } = runBaseScript({ pathname: "/pages/tools/json.html" });

  assert.match(nav.innerHTML, /href="\.\.\/\.\.\/index\.html"/);
  assert.match(nav.innerHTML, /href="\.\.\/\.\.\/pages\/ai\/index\.html"/);
  assert.doesNotMatch(nav.innerHTML, /id="searchInput"/);
});

test("shared theme handler owns one click even if page scripts add later handlers", () => {
  const { attrs, buttonListeners, storage, window } = runBaseScript();
  const clickListener = buttonListeners.find((listener) => listener.type === "click");
  const event = {
    stopped: false,
    stopImmediatePropagation() {
      this.stopped = true;
    },
  };

  assert.equal(clickListener.options, true);
  clickListener.callback(event);

  assert.equal(event.stopped, true);
  assert.equal(attrs["data-theme"], "dark");
  assert.equal(storage.get("dev-tools-theme"), "dark");
  assert.deepEqual(window.ThemeManager.applied, ["dark"]);
});
