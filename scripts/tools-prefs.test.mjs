import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../js/tools-prefs.js", import.meta.url), "utf8");

function loadToolsPrefs(localStorage) {
  const sandbox = {
    window: {},
    localStorage,
  };
  vm.runInNewContext(source, sandbox);
  return sandbox.window.ToolsPrefs;
}

function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("ToolsPrefs falls back to memory when storage reads throw", () => {
  const prefs = loadToolsPrefs({
    getItem() {
      throw new Error("storage blocked");
    },
    setItem() {
      throw new Error("storage blocked");
    },
  });

  assert.deepEqual(toPlain(prefs.load()), { favorites: [], recent: [], lastFilters: {} });
  assert.equal(prefs.hasFavorite("json"), false);

  assert.equal(prefs.toggleFavorite("json").added, true);
  assert.equal(prefs.hasFavorite("json"), true);

  prefs.addRecent("json");
  assert.deepEqual(toPlain(prefs.load().recent), ["json"]);

  prefs.setLastFilters({ q: "jwt" });
  assert.deepEqual(toPlain(prefs.load().lastFilters), { q: "jwt" });
});

test("ToolsPrefs keeps session state when storage writes throw", () => {
  const prefs = loadToolsPrefs({
    getItem() {
      return null;
    },
    setItem() {
      throw new Error("quota exceeded");
    },
  });

  assert.equal(prefs.toggleFavorite("regex").added, true);
  assert.equal(prefs.hasFavorite("regex"), true);

  prefs.addRecent("regex");
  assert.deepEqual(toPlain(prefs.load().recent), ["regex"]);
});
