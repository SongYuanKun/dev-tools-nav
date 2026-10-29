import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

test("regex tool ships named-group templates and multi-language snippet generators", async () => {
  const source = await readFile(new URL("../js/regex-tool.js", import.meta.url), "utf8");
  assert.match(source, /\(\?<user>/);
  assert.match(source, /toPythonNamedPattern/);
  assert.match(source, /JavaScript/);
  assert.match(source, /# Python/);
  assert.match(source, /\/\/ Go/);
  assert.match(source, /\/\/ Java/);
  assert.match(source, /\<\?php/);
  assert.match(source, /previewReplace/);
  assert.match(source, /命名组/);

  function el(extra = {}) {
    const node = {
      value: "",
      textContent: "",
      innerHTML: "",
      className: "",
      title: "",
      type: "",
      style: {},
      children: [],
      listeners: new Map(),
      addEventListener(name, cb) { this.listeners.set(name, cb); },
      appendChild(child) { this.children.push(child); child.parentNode = this; return child; },
      ...extra,
    };
    return node;
  }

  const patternEl = el({ value: "(?<year>\\d{4})-(?<month>\\d{2})" });
  const flagsEl = el({ value: "g" });
  const testInput = el({ value: "2024-01" });
  const replaceWith = el({ value: "$<year>/$<month>" });
  const codeOut = el();
  const replaceOut = el();
  const highlightBox = el();
  const matchStats = el();
  const matchList = el();
  const matchDetailSection = el({ style: { display: "none" } });
  const previewMeta = el();
  const templateGrid = el();
  const patternError = el({ style: { display: "none" } });
  const ids = new Map([
    ["regexPattern", patternEl],
    ["regexFlags", flagsEl],
    ["testInput", testInput],
    ["replaceWith", replaceWith],
    ["regexCodeOut", codeOut],
    ["replaceOutput", replaceOut],
    ["highlightBox", highlightBox],
    ["matchStats", matchStats],
    ["matchList", matchList],
    ["matchDetailSection", matchDetailSection],
    ["replacePreviewMeta", previewMeta],
    ["templateGrid", templateGrid],
    ["patternError", patternError],
  ]);

  const document = {
    readyState: "complete",
    getElementById: (id) => ids.get(id) || null,
    querySelector: (sel) => (sel === ".regex-flags-help" ? el() : null),
    createElement: () => el(),
    addEventListener() {},
  };

  const context = {
    window: { ToolChrome: { ready: (fn) => fn(), html: null, copyText: async () => {} } },
    document,
    RegExp,
    Array,
    Object,
    String,
    JSON,
    setTimeout,
    clearTimeout,
  };
  vm.runInNewContext(source, context);

  assert.ok(templateGrid.children.length >= 28);
  assert.match(codeOut.textContent, /JavaScript/);
  assert.match(codeOut.textContent, /# Python/);
  assert.match(codeOut.textContent, /\(\?P<year>/);
  assert.equal(replaceOut.textContent, "2024/01");
  assert.match(matchStats.textContent, /命名组/);
});
