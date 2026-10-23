import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const SCRIPT = "scripts/consistency-gtr-x-ghpages.sh";

test("GTR×Pages consistency script exists and is executable shell", () => {
  assert.equal(existsSync(SCRIPT), true);
  chmodSync(SCRIPT, 0o755);
  const source = readFileSync(SCRIPT, "utf8");
  assert.match(source, /^#!/);
  assert.match(source, /GTR_BASE/);
  assert.match(source, /PAGES_BASE/);
  assert.match(source, /search-console/);
  assert.match(source, /RESULT: ALL GREEN/);

  const syntax = spawnSync("bash", ["-n", SCRIPT], { encoding: "utf8" });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);
});

test("consistency script checks PWA assets, self-built tools, and keyword rows", () => {
  const source = readFileSync(SCRIPT, "utf8");
  const routesBlock = source.split("ROUTES=(")[1]?.split(")")[0] ?? "";
  const routes = [...routesBlock.matchAll(/^\s+(\/[^\s]*)\s*$/gm)].map((m) => m[1]);
  assert.ok(routes.length >= 24, `expected ≥24 routes, got ${routes.length}: ${routes.join(",")}`);
  for (const path of ["/manifest.webmanifest", "/sw.js", "/offline.html", "/tools/hash/", "/tools/url-encode/", "/tools/qrcode/"]) {
    assert.ok(routes.includes(path), `missing route ${path}`);
  }

  const toolBlock = source.split("TOOL_KEYWORDS=(")[1]?.split(")")[0] ?? "";
  const tools = [...toolBlock.matchAll(/\[("\/pages\/tools\/[^"]+\.html")\]/g)].map((m) => m[1].slice(1, -1));
  assert.ok(tools.length >= 11, `expected ≥11 tool keyword rows, got ${tools.length}`);
  for (const path of ["/pages/tools/hash.html", "/pages/tools/url-encode.html", "/pages/tools/qrcode.html"]) {
    assert.ok(tools.includes(path), `missing keyword row ${path}`);
  }

  assert.match(source, /ROUTE_TOTAL=\$\{\#ROUTES\[@\]\}/);
  assert.match(source, /TOOL_TOTAL=\$\{\#TOOL_KEYWORD_PATHS\[@\]\}/);
});
