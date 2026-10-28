import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  ASSET_VERSION_PLACEHOLDER,
  findAssetVersionPlaceholders,
  resolveAssetVersion,
  shouldVersionUrl,
  stampMarkupAssetUrls,
  stampServiceWorker,
  stampText,
  stampTree,
  withAssetVersion,
} from "./stamp-asset-version.mjs";

test("withAssetVersion sets and replaces v= while preserving other query params and hash", () => {
  assert.equal(withAssetVersion("css/style.css", "abc"), "css/style.css?v=abc");
  assert.equal(withAssetVersion("../js/base.js?v=old", "new"), "../js/base.js?v=new");
  assert.equal(
    withAssetVersion("data/tools.js?x=1#top", "sha"),
    "data/tools.js?x=1&v=sha#top",
  );
});

test("shouldVersionUrl only matches relative css/js", () => {
  assert.equal(shouldVersionUrl("css/style.css"), true);
  assert.equal(shouldVersionUrl("../../js/base.js"), true);
  assert.equal(shouldVersionUrl("https://fonts.googleapis.com/css2?family=Geist"), false);
  assert.equal(shouldVersionUrl("//cdn.example/x.js"), false);
  assert.equal(shouldVersionUrl("assets/logo.svg"), false);
});

test("stampMarkupAssetUrls versions local assets and leaves externals alone", () => {
  const html = `
<link rel="stylesheet" href="css/style.css" />
<link href="https://fonts.googleapis.com/css2?family=Geist" rel="stylesheet" />
<script defer src="js/base.js"></script>
<script src="https://cloud.umami.is/script.js"></script>
`;
  const out = stampMarkupAssetUrls(html, "deadbeef");
  assert.match(out, /href="css\/style\.css\?v=deadbeef"/);
  assert.match(out, /src="js\/base\.js\?v=deadbeef"/);
  assert.match(out, /fonts\.googleapis\.com\/css2\?family=Geist/);
  assert.match(out, /cloud\.umami\.is\/script\.js"/);
  assert.doesNotMatch(out, /umami\.is\/script\.js\?v=/);
});

test("stampServiceWorker bumps VERSION and precache queries", () => {
  const sw = `
const VERSION = "pwa-v1";
const PRECACHE_URLS = [
  "./",
  "./css/style.css",
  "./js/base.js",
  "./data/tools.js",
];
`;
  const out = stampServiceWorker(sw, "c0ffee");
  assert.match(out, /const VERSION = "pwa-c0ffee"/);
  assert.match(out, /\.\/css\/style\.css\?v=c0ffee/);
  assert.match(out, /\.\/js\/base\.js\?v=c0ffee/);
  assert.match(out, /\.\/data\/tools\.js\?v=c0ffee/);
  assert.match(out, /\.\/"/); // bare shell entry untouched shape
});

test("stampText replaces placeholder after URL rewrite", () => {
  const html = `<link rel="stylesheet" href="css/style.css?v=${ASSET_VERSION_PLACEHOLDER}" />`;
  const out = stampText(html, "abc123", { kind: "html" });
  assert.equal(out, '<link rel="stylesheet" href="css/style.css?v=abc123" />');
});

test("resolveAssetVersion prefers ASSET_VERSION then short GITHUB_SHA", () => {
  assert.equal(resolveAssetVersion({ env: { ASSET_VERSION: "manual-1" } }), "manual-1");
  assert.equal(
    resolveAssetVersion({ env: { GITHUB_SHA: "abcdef0123456789" } }),
    "abcdef012345",
  );
});

test("stampTree writes HTML and sw.js under a publish root", () => {
  const root = mkdtempSync(join(tmpdir(), "stamp-assets-"));
  try {
    mkdirSync(join(root, "css"), { recursive: true });
    writeFileSync(
      join(root, "index.html"),
      `<link rel="stylesheet" href="css/style.css" />\n<script src="js/base.js"></script>\n`,
    );
    writeFileSync(
      join(root, "sw.js"),
      `const VERSION = "pwa-v1";\nconst PRECACHE_URLS = ["./css/style.css", "./js/base.js"];\n`,
    );
    const result = stampTree(root, "ship1");
    assert.equal(result.version, "ship1");
    assert.ok(result.files.includes("index.html"));
    assert.ok(result.files.includes("sw.js"));
    const html = readFileSync(join(root, "index.html"), "utf8");
    const sw = readFileSync(join(root, "sw.js"), "utf8");
    assert.match(html, /style\.css\?v=ship1/);
    assert.match(html, /base\.js\?v=ship1/);
    assert.match(sw, /VERSION = "pwa-ship1"/);
    assert.match(sw, /style\.css\?v=ship1/);
    assert.deepEqual(findAssetVersionPlaceholders(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("findAssetVersionPlaceholders reports leftover HTML and sw.js placeholders", () => {
  const root = mkdtempSync(join(tmpdir(), "stamp-leftover-"));
  try {
    writeFileSync(
      join(root, "index.html"),
      `<link href="css/style.css?v=${ASSET_VERSION_PLACEHOLDER}" />\n`,
    );
    writeFileSync(join(root, "sw.js"), `const VERSION = "pwa-${ASSET_VERSION_PLACEHOLDER}";\n`);
    writeFileSync(join(root, "ok.html"), `<link href="css/style.css?v=ok" />\n`);
    assert.deepEqual(findAssetVersionPlaceholders(root).sort(), ["index.html", "sw.js"]);
    stampTree(root, "fixed");
    assert.deepEqual(findAssetVersionPlaceholders(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
