import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

test("consistency checks the current dashboard and rejects matching pages without a feedback link", () => {
  const directory = mkdtempSync(join(tmpdir(), "nav-site-comparison-"));
  try {
    writeFileSync(join(directory, "curl"), `#!/usr/bin/env bash
case " $* " in
  *" -w "*) printf 200 ;;
  *)
    url=\${!#}
    case "$url" in
      */search-console.html) cat "$DASHBOARD_FIXTURE" ;;
      *) cat ".\${url#*://fixture.invalid}" ;;
    esac
    ;;
esac
`, { mode: 0o755 });
    const dashboard = readFileSync("search-console.html", "utf8");
    const fixture = join(directory, "dashboard.html");
    const env = {
      ...process.env,
      PATH: directory + ":" + process.env.PATH,
      GTR_BASE: "https://fixture.invalid",
      PAGES_BASE: "https://fixture.invalid",
      DASHBOARD_FIXTURE: fixture,
    };

    writeFileSync(fixture, dashboard);
    const valid = spawnSync("bash", [SCRIPT], { encoding: "utf8", env });
    assert.equal(valid.status, 0, valid.stderr || valid.stdout);
    assert.match(valid.stdout, /RESULT: ALL GREEN/);

    writeFileSync(fixture, dashboard.replace("template=search-gap.yml", "template=other.yml"));
    const invalid = spawnSync("bash", [SCRIPT], { encoding: "utf8", env });
    assert.equal(invalid.status, 1, invalid.stderr || invalid.stdout);
    assert.match(invalid.stdout, /PASS  search-console SHA match/);
    assert.match(invalid.stdout, /FAIL  search-console dashboard sections or feedback link missing/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
