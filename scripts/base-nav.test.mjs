import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const baseJs = readFileSync(new URL("../js/base.js", import.meta.url), "utf8");

function renderNav(pathname) {
  const listeners = {};
  const nav = { innerHTML: "" };
  const documentElement = {
    attrs: {},
    classList: { add() {} },
    getAttribute(name) {
      return this.attrs[name] || "";
    },
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
  };
  const document = {
    readyState: "loading",
    referrer: "",
    title: "Test page",
    documentElement,
    querySelector(selector) {
      return selector === "nav.navbar" ? nav : null;
    },
    getElementById() {
      return null;
    },
    addEventListener(name, handler) {
      listeners[name] = handler;
    },
  };
  const location = {
    pathname,
    search: "",
    origin: "https://songyuankun.github.io",
    hostname: "songyuankun.github.io",
  };
  const localStorage = {
    getItem() {
      return null;
    },
    setItem() {},
  };
  const history = {
    pushState() {},
    replaceState() {},
  };
  const window = {
    document,
    location,
    localStorage,
    history,
    screen: { width: 1280, height: 720 },
    navigator: { language: "zh-CN" },
    addEventListener() {},
  };
  const context = {
    window,
    document,
    location,
    localStorage,
    history,
    URLSearchParams,
    PerformanceObserver: undefined,
    setTimeout() {},
    fetch() {
      return Promise.resolve({ json: () => Promise.resolve({}) });
    },
  };

  vm.runInNewContext(baseJs, context, { filename: "js/base.js" });
  listeners.DOMContentLoaded();
  return nav.innerHTML;
}

test("nav links stay inside GitHub Pages project root on homepage", () => {
  const html = renderNav("/dev-tools-nav/");

  assert.ok(html.includes('href="index.html"'));
  assert.ok(html.includes('src="assets/logo.svg"'));
  assert.ok(!html.includes('href="../index.html"'));
});

test("nav prefix ignores GitHub Pages project segment on nested pages", () => {
  const html = renderNav("/dev-tools-nav/pages/ai/prompts.html");

  assert.ok(html.includes('href="../../index.html"'));
  assert.ok(html.includes('src="../../assets/logo.svg"'));
  assert.ok(!html.includes('href="../../../index.html"'));
});

test("nav prefix still handles root-domain nested pages", () => {
  const html = renderNav("/pages/about.html");

  assert.ok(html.includes('href="../index.html"'));
  assert.ok(html.includes('src="../assets/logo.svg"'));
});
