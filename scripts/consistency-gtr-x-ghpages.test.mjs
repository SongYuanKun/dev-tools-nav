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

test("consistency script checks 18 routes and 8 tool keyword rows", () => {
  const source = readFileSync(SCRIPT, "utf8");
  const routesBlock = source.split("ROUTES=(")[1]?.split(")")[0] ?? "";
  const routes = [...routesBlock.matchAll(/^\s+(\/[^\s]*)\s*$/gm)].map((m) => m[1]);
  assert.equal(routes.length, 18, `expected 18 routes, got ${routes.length}: ${routes.join(",")}`);

  const toolBlock = source.split("TOOL_KEYWORDS=(")[1]?.split(")")[0] ?? "";
  const tools = [...toolBlock.matchAll(/\[("\/pages\/tools\/[^"]+\.html")\]/g)];
  assert.equal(tools.length, 8, `expected 8 tool keyword rows, got ${tools.length}`);
});
