import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const BASE_JS = readFileSync("js/base.js", "utf-8");

function createClassList() {
  return {
    add() {},
    remove() {},
    toggle() {},
  };
}

function createDocument() {
  return {
    body: { classList: createClassList() },
    documentElement: {
      classList: createClassList(),
      getAttribute() {
        return "";
      },
      setAttribute() {},
    },
    head: {
      appendChild() {},
    },
    title: "Online Tool",
    referrer: "",
    readyState: "complete",
    addEventListener() {},
    createElement() {
      return {};
    },
    getElementById() {
      return null;
    },
    getElementsByTagName(name) {
      return name === "script"
        ? [{ src: "https://tools.songyuankun.top/js/base.js" }]
        : [];
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  };
}

function loadBaseScript(initialUrl) {
  const sent = [];
  const timers = [];
  const location = new URL(initialUrl);
  const document = createDocument();

  const history = {
    pushState(_state, _title, url) {
      if (url) location.href = new URL(url, location.href).href;
    },
    replaceState(_state, _title, url) {
      if (url) location.href = new URL(url, location.href).href;
    },
  };

  const window = {
    document,
    history,
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {},
    },
    location,
    navigator: { language: "zh-CN" },
    screen: { width: 1440, height: 900 },
    addEventListener() {},
  };

  const sandbox = {
    URL,
    URLSearchParams,
    document,
    fetch(_url, options) {
      sent.push(JSON.parse(options.body));
      return Promise.resolve({ json: () => Promise.resolve({ cache: "cache-id" }) });
    },
    history,
    localStorage: window.localStorage,
    location,
    navigator: window.navigator,
    screen: window.screen,
    setTimeout(callback) {
      timers.push(callback);
      return timers.length;
    },
    window,
  };

  vm.runInNewContext(BASE_JS, sandbox, { filename: "js/base.js" });

  return {
    sent,
    window,
    runTimers() {
      while (timers.length) timers.shift()();
    },
  };
}

test("Umami pageviews strip sensitive query parameters from reported URLs", () => {
  const secret = encodeURIComponent(JSON.stringify({ token: "super-secret-token" }));
  const { sent } = loadBaseScript(`https://tools.songyuankun.top/pages/tools/json.html?q=${secret}`);

  assert.equal(sent.length, 1);
  assert.equal(sent[0].payload.url, "/pages/tools/json.html");
  assert.doesNotMatch(JSON.stringify(sent[0]), /super-secret-token|%7B|q=/);
});

test("Umami SPA navigation and custom events keep analytics URLs query-free", () => {
  const { sent, window, runTimers } = loadBaseScript(
    "https://tools.songyuankun.top/pages/tools/json.html?q=initial-secret",
  );

  window.history.pushState(
    {},
    "",
    "/pages/tools/base64.html?text=another-secret&mode=decode",
  );
  runTimers();
  window.umami.track("tool_used", { tool: "base64" });

  assert.equal(sent.length, 3);
  assert.deepEqual(
    sent.map((item) => item.payload.url),
    [
      "/pages/tools/json.html",
      "/pages/tools/base64.html",
      "/pages/tools/base64.html",
    ],
  );
  assert.equal(sent[1].payload.referrer, "/pages/tools/json.html");
  assert.doesNotMatch(JSON.stringify(sent), /initial-secret|another-secret|text=|mode=|q=/);
});
