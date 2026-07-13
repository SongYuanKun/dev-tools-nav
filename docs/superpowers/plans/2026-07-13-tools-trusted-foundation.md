# Tools Trusted Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore a reproducible test baseline, make screenshot automation reliable, enforce tool-catalog invariants, separate Umami reporting by hostname, and correct the active project documentation.

**Architecture:** Keep the existing static Vanilla HTML/CSS/JavaScript application. Extract testable pure functions from build and screenshot scripts, add a small catalog audit module, keep both production hostnames on the existing Umami website ID, and make hostname normalization an explicit SQL reporting layer. Documentation is then updated from those executable contracts instead of defining its own counts.

**Tech Stack:** Node.js 24 in GitHub Actions, Node built-in test runner, Playwright Chromium, Vanilla JavaScript, PostgreSQL SQL, GitHub Actions, Markdown.

## Global Constraints

- Use `origin/main` through the isolated branch `codex/tools-foundation`; do not touch the original worktree's modified `sitemap.xml`.
- Keep Vanilla HTML, CSS, and JavaScript; do not introduce Astro, Tailwind, a frontend framework, or a backend.
- Keep both `tools.songyuankun.top` and `songyuankun.github.io/dev-tools-nav/` on Umami website ID `99e14cad-6300-4f3c-83d2-b3b71c7d6a25`.
- Every production analytics query must output or filter `hostname` and normalize the GitHub Pages `/dev-tools-nav` prefix before cross-host aggregation.
- Define the north-star event as the existing translated Umami event `工具使用`; ordinary pageviews and clicks do not count as effective tool use.
- Keep KMS and JRebel out of featured, advertising, affiliate, and commercial conversion metrics.
- Current catalog contract: 73 total directory entries, 10 self-built browser tools, and 11 `online-tools` category entries.
- Do not display ads, add commercial UI, deploy, restart services, or push production in this plan.
- Use test-first development for behavior changes. Do not change production code until the relevant new or existing test has been observed failing for the expected reason.

---

## File Responsibility Map

- `scripts/generate-sitemap.mjs`: pure URL collection/XML escaping plus CLI file generation.
- `scripts/generate-sitemap.test.mjs`: sitemap behavior contract.
- `.github/workflows/test.yml`: push/PR unit-test gate.
- `scripts/capture-screenshots.mjs`: screenshot targets and exported JSON sample preparation.
- `scripts/capture-screenshots.test.mjs`: deterministic interaction-order contract for the hidden JSON menu.
- `.github/workflows/update-screenshots.yml`: Playwright environment and reliable server cleanup.
- `scripts/audit-tools.mjs`: catalog parser and invariant checker.
- `scripts/audit-tools.test.mjs`: catalog counts, IDs, canonical paths, and README contract.
- `package.json`: exposes `audit:tools` and keeps `npm test` as the single unit-test entry point.
- `scripts/umami-operations-report.sql`: hostname-aware 7/30-day operations report.
- `scripts/umami-operations-report.test.mjs`: static contract that prevents hostname-free production reporting from returning.
- `README.md`, `manual.md`, `docs/README.md`, `docs/deploy-1panel.md`, `docs/sdlc-project-delivery-kit.md`, `docs/chatdev-p1p2-prompt.md`: current-state documentation corrections.
- `docs/roadmap.md`: single active product roadmap.
- `docs/analytics-insights.md`: dated, reproducible hostname-aware analytics snapshot and refresh instructions.
- `docs/umami-integration-spec.md`: current tools analytics architecture and event contract; no longer a pre-install draft for another project.

---

### Task 1: Restore the Sitemap Test Contract

**Files:**
- Modify: `scripts/generate-sitemap.mjs:7-127`
- Modify: `scripts/generate-sitemap.test.mjs:1-26`

**Interfaces:**
- Produces: `xmlEscape(value: unknown): string`.
- Produces: `collectStaticUrls(root: string, now?: Date): Array<{loc: string, lastmod: string, priority: number, changefreq: string}>`.
- Produces: `generateSitemap(root?: string, now?: Date): string`, used only by the CLI and tests.

- [ ] **Step 1: Extend the failing test to specify the full sitemap contract**

Replace `scripts/generate-sitemap.test.mjs` with:

```js
import test from "node:test";
import assert from "node:assert/strict";

import { collectStaticUrls, generateSitemap, xmlEscape } from "./generate-sitemap.mjs";

test("xmlEscape escapes unsafe xml chars", () => {
  assert.equal(
    xmlEscape("a&b<c>d\"e'f"),
    "a&amp;b&lt;c&gt;d&quot;e&apos;f",
  );
});

test("collectStaticUrls excludes templates and returns sorted unique locations", () => {
  const urls = collectStaticUrls(process.cwd(), new Date("2026-07-13T00:00:00Z"));
  const locations = urls.map((item) => item.loc);

  assert.ok(!locations.some((loc) => loc.endsWith("/pages/blog/post.html")));
  assert.ok(!locations.some((loc) => loc.endsWith("/pages/template.html")));
  assert.equal(new Set(locations).size, locations.length);
  assert.deepEqual(locations, [...locations].sort());
});

test("collectStaticUrls includes all ten canonical self-built tools", () => {
  const locations = collectStaticUrls(process.cwd()).map((item) => item.loc);
  const expected = [
    "base64", "color", "cron", "diff", "json",
    "jwt", "regex", "sql-formatter", "timestamp", "uuid",
  ].map((slug) => `https://tools.songyuankun.top/tools/${slug}/`);

  for (const location of expected) assert.ok(locations.includes(location), location);
});

test("generateSitemap XML-escapes query URLs", () => {
  const xml = generateSitemap(process.cwd(), new Date("2026-07-13T00:00:00Z"));
  assert.match(xml, /template\.html\?id=/);
  assert.doesNotMatch(xml, /<loc>[^<]*&[^a][^m][^p][^;]/);
  assert.match(xml, /&amp;/);
});
```

- [ ] **Step 2: Run the sitemap test and observe the expected RED state**

Run: `node --test scripts/generate-sitemap.test.mjs`

Expected: FAIL during module import because `collectStaticUrls`, `generateSitemap`, and `xmlEscape` are not exported.

- [ ] **Step 3: Refactor the generator into pure exported functions**

Implement these exact boundaries in `scripts/generate-sitemap.mjs`:

```js
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const MODULE_DIR = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_ROOT = join(MODULE_DIR, "..");
const BASE_URL = "https://tools.songyuankun.top";
const EXCLUDED_NAMES = new Set(["node_modules", ".git", ".github", "docs"]);
const EXCLUDED_FILES = new Set(["template.html", "post.html"]);

export function xmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function shouldExclude(name) {
  return EXCLUDED_NAMES.has(name) || /_bak|\.bak$|README\.md$/.test(name);
}

function pageMeta(pathname) {
  if (pathname === "/") return { priority: 1, changefreq: "daily" };
  if (pathname.startsWith("/pages/blog/")) return { priority: 0.9, changefreq: "weekly" };
  if (pathname.startsWith("/pages/ai/")) return { priority: 0.85, changefreq: "weekly" };
  if (pathname.startsWith("/pages/") || pathname.startsWith("/tools/")) {
    return { priority: 0.7, changefreq: "weekly" };
  }
  return { priority: 0.5, changefreq: "monthly" };
}
```

Keep a recursive `walkHtml(root, relativePath)` helper that sorts every `readdirSync()` result, skips `EXCLUDED_FILES`, and maps directory `index.html` under `tools/` to a trailing-slash URL. Implement `collectStaticUrls(root, now)` so it returns absolute `loc` values, includes `/`, includes tool template query URLs, de-duplicates by `loc`, and sorts by `loc`. Implement `generateSitemap(root, now)` by mapping every field through `xmlEscape()` where required. Guard the CLI write with:

```js
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const xml = generateSitemap(DEFAULT_ROOT);
  writeFileSync(join(DEFAULT_ROOT, "sitemap.xml"), xml, "utf-8");
  console.log(`sitemap.xml generated — ${collectStaticUrls(DEFAULT_ROOT).length} URLs`);
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test scripts/generate-sitemap.test.mjs`

Expected: 4 tests pass, 0 fail.

- [ ] **Step 5: Run the generator without modifying the committed sitemap**

Run:

```bash
cp sitemap.xml /tmp/dev-tools-nav-sitemap.xml
npm run generate-sitemap
node -e 'const fs=require("fs"); const s=fs.readFileSync("sitemap.xml","utf8"); if (!s.includes("&amp;")) process.exit(1)'
mv /tmp/dev-tools-nav-sitemap.xml sitemap.xml
```

Expected: generator exits 0; the generated XML contains `&amp;`; `git status --short sitemap.xml` is empty afterward.

- [ ] **Step 6: Commit the sitemap repair**

```bash
git add scripts/generate-sitemap.mjs scripts/generate-sitemap.test.mjs
git commit -m "fix: restore sitemap generator test contract"
```

---

### Task 2: Add a Dedicated Test Gate

**Files:**
- Create: `.github/workflows/test.yml`

**Interfaces:**
- Consumes: repository `package-lock.json` and `npm test`.
- Produces: GitHub Actions workflow `Test` with job `unit` for pushes and pull requests.

- [ ] **Step 1: Add a failing workflow contract check**

Create `scripts/workflows.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("test workflow gates pushes and pull requests with npm ci and npm test", () => {
  const workflow = readFileSync(".github/workflows/test.yml", "utf-8");
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /push:/);
  assert.match(workflow, /node-version: ["']24["']/);
  assert.match(workflow, /run: npm ci/);
  assert.match(workflow, /run: npm test/);
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run: `node --test scripts/workflows.test.mjs`

Expected: FAIL with `ENOENT` for `.github/workflows/test.yml`.

- [ ] **Step 3: Create the minimal test workflow**

Create `.github/workflows/test.yml`:

```yaml
name: Test

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

concurrency:
  group: test-${{ github.ref }}
  cancel-in-progress: true

env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: npm
      - run: npm ci
      - run: npm test
```

- [ ] **Step 4: Verify the focused and complete unit suites**

Run: `node --test scripts/workflows.test.mjs && npm test`

Expected: workflow test passes; complete suite passes with 0 failures.

- [ ] **Step 5: Commit the CI gate**

```bash
git add .github/workflows/test.yml scripts/workflows.test.mjs
git commit -m "ci: run tests on pushes and pull requests"
```

---

### Task 3: Make Screenshot Capture Deterministic

**Files:**
- Modify: `scripts/capture-screenshots.mjs:18-75`
- Create: `scripts/capture-screenshots.test.mjs`
- Modify: `.github/workflows/update-screenshots.yml:36-42`

**Interfaces:**
- Produces: `prepareJsonSample(page): Promise<void>`.
- Produces: `TARGETS`, an exported frozen target list used by `main()`.
- Consumes: Playwright `Page` methods `locator()`, `click()`, and `waitForFunction()`.

- [ ] **Step 1: Write the failing interaction-order test**

Create `scripts/capture-screenshots.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";

import { prepareJsonSample } from "./capture-screenshots.mjs";

test("prepareJsonSample opens the hidden menu before clicking the sample", async () => {
  const calls = [];
  const page = {
    locator(selector) {
      return {
        async click() { calls.push(["click", selector]); },
        async waitFor(options) { calls.push(["waitFor", selector, options.state]); },
      };
    },
    async waitForFunction(_fn, expected) { calls.push(["content", expected]); },
  };

  await prepareJsonSample(page);

  assert.deepEqual(calls, [
    ["click", ".json-more > summary"],
    ["waitFor", "#btnSample", "visible"],
    ["click", "#btnSample"],
    ["content", "Koen Tools"],
  ]);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test scripts/capture-screenshots.test.mjs`

Expected: FAIL because `prepareJsonSample` is not exported.

- [ ] **Step 3: Export the preparation function and prevent imports from running the CLI**

Add this function to `scripts/capture-screenshots.mjs` and use it in the JSON target:

```js
export async function prepareJsonSample(page) {
  await page.locator(".json-more > summary").click();
  await page.locator("#btnSample").waitFor({ state: "visible" });
  await page.locator("#btnSample").click();
  await page.waitForFunction(
    (expected) => document.querySelector("#jsonInput")?.value.includes(expected),
    "Koen Tools",
  );
}

export const TARGETS = Object.freeze([
  { path: "/index.html", file: "screenshot.png", fullPage: false },
  { path: "/pages/blog/index.html", file: "screenshot-blog.png", fullPage: false },
  {
    path: "/pages/tools/json.html?embed=1",
    file: "screenshot-json-tool.png",
    fullPage: false,
    prepare: prepareJsonSample,
  },
]);
```

Export `main()` and invoke it only when `import.meta.url === pathToFileURL(process.argv[1]).href`. Wrap browser use in `try/finally` so `browser.close()` always executes. Prefix thrown errors with the target filename and URL:

```js
throw new Error(`Screenshot ${t.file} failed for ${url}: ${error.message}`, { cause: error });
```

- [ ] **Step 4: Verify the unit test is GREEN**

Run: `node --test scripts/capture-screenshots.test.mjs`

Expected: 1 test passes, 0 fail.

- [ ] **Step 5: Make workflow server cleanup unconditional**

Replace the screenshot workflow shell block with:

```yaml
      - name: Capture screenshots
        shell: bash
        run: |
          set -euo pipefail
          python3 -m http.server 8765 --directory . &
          SERVER_PID=$!
          trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT
          for attempt in {1..20}; do
            curl --fail --silent http://127.0.0.1:8765/index.html >/dev/null && break
            sleep 0.25
          done
          curl --fail --silent http://127.0.0.1:8765/index.html >/dev/null
          BASE_URL=http://127.0.0.1:8765 npm run capture-screenshots
```

- [ ] **Step 6: Run the real screenshot smoke test**

Run:

```bash
python3 -m http.server 8765 --directory . >/tmp/dev-tools-nav-http.log 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT
BASE_URL=http://127.0.0.1:8765 npm run capture-screenshots
file assets/screenshot.png assets/screenshot-blog.png assets/screenshot-json-tool.png
```

Expected: three `OK ...png` lines; `file` reports all three as PNG images; no 30-second selector timeout.

- [ ] **Step 7: Revert generated screenshot bytes before committing code**

Run:

```bash
git restore assets/screenshot.png assets/screenshot-blog.png assets/screenshot-json-tool.png
git status --short
```

Expected: only the screenshot script, test, and workflow remain modified.

- [ ] **Step 8: Commit the screenshot repair**

```bash
git add scripts/capture-screenshots.mjs scripts/capture-screenshots.test.mjs .github/workflows/update-screenshots.yml
git commit -m "fix: stabilize automated screenshots"
```

---

### Task 4: Enforce the Tool Catalog Contract

**Files:**
- Create: `scripts/audit-tools.mjs`
- Create: `scripts/audit-tools.test.mjs`
- Modify: `package.json:4-9`
- Modify: `README.md:1-101`

**Interfaces:**
- Produces: `auditTools(root: string): {total: number, selfBuilt: string[], categoryCounts: Record<string, number>, duplicateIds: string[], missingCanonical: string[]}`.
- Produces: CLI `npm run audit:tools`, exiting non-zero on invariant failure.

- [ ] **Step 1: Write the failing catalog tests**

Create `scripts/audit-tools.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";

import { auditTools } from "./audit-tools.mjs";

test("catalog has the approved counts and unique IDs", () => {
  const result = auditTools(process.cwd());
  assert.equal(result.total, 73);
  assert.equal(result.categoryCounts["online-tools"], 11);
  assert.deepEqual(result.duplicateIds, []);
});

test("all ten self-built tools have canonical shells", () => {
  const result = auditTools(process.cwd());
  assert.deepEqual(result.selfBuilt, [
    "base64", "color", "cron", "diff", "json",
    "jwt", "regex", "sql-formatter", "timestamp", "uuid",
  ]);
  assert.deepEqual(result.missingCanonical, []);
});

test("README states all three catalog counts and canonical URL policy", () => {
  const result = auditTools(process.cwd());
  assert.deepEqual(result.readmeCounts, { total: 73, selfBuilt: 10, onlineTools: 11 });
  assert.equal(result.readmeUsesCanonicalToolsPath, true);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test scripts/audit-tools.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `audit-tools.mjs`.

- [ ] **Step 3: Implement the audit module without executing application JS**

Implement `scripts/audit-tools.mjs` with Node `fs` only. Parse `data/tools.js` objects using the existing `id`, `category`, and `url` literal patterns; do not use `eval` or `vm`. Define the exact self-built slugs as:

```js
export const SELF_BUILT_TOOLS = Object.freeze([
  "base64", "color", "cron", "diff", "json",
  "jwt", "regex", "sql-formatter", "timestamp", "uuid",
]);
```

For each slug, require `tools/<slug>/index.html`. Extract README counts only from these machine-readable comments added near the first paragraph:

```md
<!-- catalog-total: 73 -->
<!-- catalog-self-built: 10 -->
<!-- catalog-online-tools: 11 -->
```

The CLI must print a JSON summary and set `process.exitCode = 1` when counts, duplicates, or canonical shells fail.

- [ ] **Step 4: Update README to the exact current catalog contract**

Make these content changes:

- Opening statement: “目录收录 73 条开发与建站资源，其中 10 款为浏览器内自研工具；`online-tools` 数据分类包含 11 条记录。”
- Add the three machine-readable comments above.
- Replace the online tool table paths with `/tools/json/`, `/tools/timestamp/`, `/tools/cron/`, `/tools/base64/`, `/tools/jwt/`, `/tools/sql-formatter/`, `/tools/regex/`, `/tools/uuid/`, `/tools/diff/`, and `/tools/color/`.
- Explain that `pages/tools/*.html` are implementation/embed/compatibility pages, not public canonical URLs.
- Update the category table to the observed counts and make clear that hidden activation records are excluded from commercial reporting, not silently removed from catalog totals.
- Add the missing CSDN and open-source-radar sync workflows to the file tree.
- Change screenshot wording from “每周自动刷新” to “每周计划运行；成功状态以 GitHub Actions 为准”.

- [ ] **Step 5: Add the package command**

Add to `package.json` scripts:

```json
"audit:tools": "node scripts/audit-tools.mjs"
```

- [ ] **Step 6: Verify catalog and complete tests**

Run: `npm run audit:tools && node --test scripts/audit-tools.test.mjs && npm test`

Expected: audit exits 0 and reports total 73/self-built 10/online-tools 11; all tests pass.

- [ ] **Step 7: Commit the executable catalog contract**

```bash
git add scripts/audit-tools.mjs scripts/audit-tools.test.mjs package.json README.md
git commit -m "test: enforce tool catalog invariants"
```

---

### Task 5: Add Hostname-Aware Operations Reporting

**Files:**
- Create: `scripts/umami-operations-report.sql`
- Create: `scripts/umami-operations-report.test.mjs`
- Rewrite: `docs/analytics-insights.md`
- Rewrite: `docs/umami-integration-spec.md`

**Interfaces:**
- Produces: psql variable `website_id`, defaulted by invocation to `99e14cad-6300-4f3c-83d2-b3b71c7d6a25`.
- Produces: report columns `period`, `hostname`, `normalized_path`, `pv`, `sessions`, `visitors`, `effective_uses`, `effective_users`.
- Defines commercial exclusion: translated event `工具使用` with translated property `工具` in `('kms', 'jrebel')` is excluded from commercial effective-use totals.

- [ ] **Step 1: Write the failing SQL contract test**

Create `scripts/umami-operations-report.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("operations SQL separates hostnames and normalizes GitHub Pages paths", () => {
  const sql = readFileSync("scripts/umami-operations-report.sql", "utf-8");
  assert.match(sql, /hostname/gi);
  assert.match(sql, /songyuankun\.github\.io/);
  assert.match(sql, /tools\.songyuankun\.top/);
  assert.match(sql, /\/dev-tools-nav/);
  assert.match(sql, /normalized_path/);
  assert.match(sql, /COUNT\(DISTINCT[^)]*session_id/si);
});

test("operations SQL defines effective use and excludes activation tools commercially", () => {
  const sql = readFileSync("scripts/umami-operations-report.sql", "utf-8");
  assert.match(sql, /工具使用/);
  assert.match(sql, /effective_uses/);
  assert.match(sql, /effective_users/);
  assert.match(sql, /kms/);
  assert.match(sql, /jrebel/);
});
```

- [ ] **Step 2: Run the SQL contract test and verify RED**

Run: `node --test scripts/umami-operations-report.test.mjs`

Expected: FAIL with `ENOENT` for `scripts/umami-operations-report.sql`.

- [ ] **Step 3: Create the reproducible SQL report**

Create `scripts/umami-operations-report.sql` with these CTE boundaries:

```sql
\set ON_ERROR_STOP on

WITH target_hosts(hostname) AS (
  VALUES ('tools.songyuankun.top'), ('songyuankun.github.io')
), periods(period, start_at, end_at) AS (
  VALUES
    ('last_7_days', NOW() - INTERVAL '7 days', NOW()),
    ('last_30_days', NOW() - INTERVAL '30 days', NOW()),
    ('previous_30_days', NOW() - INTERVAL '60 days', NOW() - INTERVAL '30 days')
), normalized_events AS (
  SELECT
    e.*,
    CASE
      WHEN e.hostname = 'songyuankun.github.io'
        THEN regexp_replace(e.url_path, '^/dev-tools-nav(?=/|$)', '')
      ELSE e.url_path
    END AS normalized_path
  FROM website_event e
  JOIN target_hosts h USING (hostname)
  WHERE e.website_id = :'website_id'::uuid
), pageviews AS (
  SELECT p.period, e.hostname, e.normalized_path,
         COUNT(*) AS pv,
         COUNT(DISTINCT e.session_id) AS sessions,
         COUNT(DISTINCT s.distinct_id) AS visitors
  FROM periods p
  JOIN normalized_events e ON e.created_at >= p.start_at AND e.created_at < p.end_at
  LEFT JOIN session s USING (session_id)
  WHERE e.event_type = 1 AND e.event_name IS NULL
  GROUP BY p.period, e.hostname, e.normalized_path
), effective_use AS (
  SELECT p.period, e.hostname, e.normalized_path,
         COUNT(*) FILTER (
           WHERE COALESCE(d.string_value, '') NOT IN ('kms', 'jrebel')
         ) AS effective_uses,
         COUNT(DISTINCT e.session_id) FILTER (
           WHERE COALESCE(d.string_value, '') NOT IN ('kms', 'jrebel')
         ) AS effective_users
  FROM periods p
  JOIN normalized_events e ON e.created_at >= p.start_at AND e.created_at < p.end_at
  LEFT JOIN event_data d ON d.event_id = e.event_id AND d.data_key = '工具'
  WHERE e.event_name = '工具使用'
  GROUP BY p.period, e.hostname, e.normalized_path
)
SELECT pv.period, pv.hostname, pv.normalized_path, pv.pv, pv.sessions, pv.visitors,
       COALESCE(eu.effective_uses, 0) AS effective_uses,
       COALESCE(eu.effective_users, 0) AS effective_users
FROM pageviews pv
LEFT JOIN effective_use eu USING (period, hostname, normalized_path)
ORDER BY pv.period, pv.hostname, pv.pv DESC, pv.normalized_path;
```

Before finalizing, inspect the live `event_data` schema read-only. If value columns differ from `string_value`, change only that column reference and record the verified schema in `docs/umami-integration-spec.md`.

- [ ] **Step 4: Validate the SQL contract and execute it read-only against Umami**

Run:

```bash
node --test scripts/umami-operations-report.test.mjs
docker exec -i 1Panel-postgresql-emsf sh -lc \
  'psql -X -v ON_ERROR_STOP=1 -v website_id=99e14cad-6300-4f3c-83d2-b3b71c7d6a25 -U "$POSTGRES_USER" -d umami_wk4zs4 -P pager=off' \
  < scripts/umami-operations-report.sql
```

Expected: test passes; SQL exits 0; output contains only `tools.songyuankun.top` and `songyuankun.github.io`, with separate rows and normalized paths lacking `/dev-tools-nav`.

- [ ] **Step 5: Rewrite analytics documentation around the executable query**

Replace `docs/analytics-insights.md` with these sections:

1. `# Umami 运营快照与复盘`.
2. Metadata: website ID, snapshot date `2026-07-13`, timezone `Asia/Shanghai`, windows 7/30/previous-30 days.
3. “可信口径”: two target hostnames, path normalization, effective-use definition, KMS/JRebel exclusion.
4. “刷新命令”: the exact Docker/psql command from Step 4 without embedding a password.
5. “2026-07-13 基线”: official-domain 30-day 119 PV/25 sessions, previous 30-day 386 PV/25 sessions, latest 7-day 8 PV/7 sessions; label these as the read-only audit snapshot, not permanent values.
6. “数据限制”: old mixed-host reports and suspected low-quality GitHub Pages radar traffic.
7. “Monthly review”: effective users, effective uses, Search Console clicks, and 30-day return rate.

- [ ] **Step 6: Rewrite the Umami specification as current-state documentation**

Replace `docs/umami-integration-spec.md` with these sections:

1. Current architecture: `js/base.js`, `js/umami-helper.js`, `js/umami-labels.js`, shared website ID, two target hostnames.
2. Event contract table: internal key, translated event name, required translated properties, trigger.
3. Effective-use actions for all ten self-built tools based on current `js/*-tool.js` calls.
4. Hostname and path reporting rules.
5. DNT/disable behavior and error isolation.
6. Goals/Funnels reference to `scripts/rebuild-umami-goals.sql`.
7. Browser verification and SQL verification.
8. Explicit exclusion of KMS/JRebel from commercial metrics.

Delete the obsolete instructions claiming no analytics exists, that a website ID must be created, or that helper files need to be added.

- [ ] **Step 7: Verify tests and documentation terminology**

Run:

```bash
npm test
rg -n "当前无任何分析脚本|PASTE_YOUR_WEBSITE_ID_HERE|category_switch|推荐共用" docs/umami-integration-spec.md docs/analytics-insights.md
```

Expected: all tests pass; `rg` returns no matches.

- [ ] **Step 8: Commit hostname-aware reporting**

```bash
git add scripts/umami-operations-report.sql scripts/umami-operations-report.test.mjs docs/analytics-insights.md docs/umami-integration-spec.md
git commit -m "feat: add hostname-aware operations reporting"
```

---

### Task 6: Establish the Active Documentation Source of Truth

**Files:**
- Create: `docs/roadmap.md`
- Modify: `manual.md:1-116`
- Modify: `docs/README.md:1-26`
- Modify: `docs/deploy-1panel.md:1-52`
- Modify: `docs/sdlc-project-delivery-kit.md:214-350`
- Modify: `docs/chatdev-p1p2-prompt.md:1-131`

**Interfaces:**
- Consumes: approved design `docs/superpowers/specs/2026-07-13-tools-foundation-and-growth-design.md`.
- Produces: `docs/roadmap.md` as the only active product roadmap.

- [ ] **Step 1: Add a failing documentation consistency test**

Extend `scripts/audit-tools.test.mjs` with:

```js
import { readFileSync } from "node:fs";

test("active docs have one roadmap and archive the ChatDev prompt", () => {
  const manual = readFileSync("manual.md", "utf-8");
  const docsIndex = readFileSync("docs/README.md", "utf-8");
  const roadmap = readFileSync("docs/roadmap.md", "utf-8");
  const chatdev = readFileSync("docs/chatdev-p1p2-prompt.md", "utf-8");

  assert.doesNotMatch(manual, /93% 用户|98\.6%|0 回头客/);
  assert.match(docsIndex, /roadmap\.md/);
  assert.match(roadmap, /北极星指标：有效工具使用次数/);
  assert.match(chatdev, /历史归档/);
  assert.match(chatdev, /不得作为当前实施依据/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test scripts/audit-tools.test.mjs`

Expected: FAIL because `docs/roadmap.md` does not exist and active docs still contain stale metrics.

- [ ] **Step 3: Create the single active roadmap**

Create `docs/roadmap.md` with:

- metadata `last_verified: 2026-07-13`;
- north-star metric “有效工具使用次数”;
- Phase 1 trusted foundation tasks and acceptance criteria from the approved design;
- Phase 2 core tools JSON/JWT/SQL/Regex/Cron/Timestamp and Markdown single-source pipeline;
- Phase 3 affiliate → sponsorship → display-ad sequence and 1,000/5,000 effective-user thresholds;
- fixed decisions: Vanilla for now, both hostnames retained, no ads now, activation content commercially isolated;
- status values limited to `planned`, `in_progress`, `done`, `blocked` and an evidence link for every `done` item.

- [ ] **Step 4: Make manual and docs index current-state only**

In `manual.md`, delete the embedded June traffic statistics and replace the roadmap tables with a link to `docs/roadmap.md`. Keep only usage, local execution, screenshot commands, deployment pointers, and stability notes. State that screenshot freshness is verified in Actions rather than guaranteed weekly.

In `docs/README.md`, add `roadmap.md`, mark `chatdev-p1p2-prompt.md` as historical, and remove links to any Markdown files absent from `origin/main`. Describe `analytics-insights.md` as dated snapshots rather than an automatically current dashboard.

- [ ] **Step 5: Correct deployment documentation**

In `docs/deploy-1panel.md`:

- state that `deploy.sh` is executed from the repository and is excluded from the deployed site;
- list the actual exclusions from `deploy.sh`;
- explain that Pages, local `deploy.sh`, and SSH workflow have separate manifests and are not byte-identical;
- keep the two-site coexistence policy;
- remove roadmap duplication and link to `docs/roadmap.md`.

- [ ] **Step 6: Correct SDLC and archive historical prompt**

In `docs/sdlc-project-delivery-kit.md`, replace “no tests” with “Node built-in tests under `scripts/*.test.mjs`; no browser UI unit-test coverage metric yet”, move SQL formatter to completed capability, and link active iteration status to `docs/roadmap.md`.

At the top of `docs/chatdev-p1p2-prompt.md`, add:

```md
> **历史归档（不得作为当前实施依据）**
>
> 本文件保留早期 ChatDev 提示词，仅用于追溯。品牌色、页面范围、路线状态和测试现状均可能过时；当前决策以 `README.md`、`docs/roadmap.md` 和已批准设计文档为准。任何虚构推荐语均不得上线。
```

- [ ] **Step 7: Run documentation consistency and broken-link checks**

Run:

```bash
node --test scripts/audit-tools.test.mjs
rg -n "93% 用户|98\.6%|0 回头客|当前无任何分析脚本|PASTE_YOUR_WEBSITE_ID_HERE" README.md manual.md docs
node - <<'NODE'
const fs = require('fs');
const path = require('path');
for (const file of ['README.md', 'manual.md', 'docs/README.md', 'docs/roadmap.md']) {
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(/\[[^\]]+\]\((?!https?:|#)([^)]+\.md)(?:#[^)]+)?\)/g)) {
    const target = path.resolve(path.dirname(file), match[1]);
    if (!fs.existsSync(target)) throw new Error(`${file}: missing ${match[1]}`);
  }
}
NODE
```

Expected: focused tests pass; stale-string `rg` returns no matches in active docs except the explicitly quoted archive warning where applicable; Markdown link checker exits 0.

- [ ] **Step 8: Commit the documentation source of truth**

```bash
git add docs/roadmap.md manual.md docs/README.md docs/deploy-1panel.md docs/sdlc-project-delivery-kit.md docs/chatdev-p1p2-prompt.md scripts/audit-tools.test.mjs
git commit -m "docs: establish current project source of truth"
```

---

### Task 7: Full Verification and Handoff

**Files:**
- Verify only; do not add generated screenshots or sitemap unless their content is intentionally part of an earlier task.

**Interfaces:**
- Consumes: all Task 1–6 deliverables.
- Produces: verification evidence for review; no production deployment.

- [ ] **Step 1: Run all unit and audit checks from a clean process**

Run:

```bash
npm ci
npm test
npm run audit:tools
npm run build
```

Expected: every command exits 0; Node test output has 0 failures; catalog audit reports 73/10/11.

- [ ] **Step 2: Run screenshot smoke verification**

Run:

```bash
python3 -m http.server 8765 --directory . >/tmp/dev-tools-nav-http.log 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT
BASE_URL=http://127.0.0.1:8765 npm run capture-screenshots
file assets/screenshot.png assets/screenshot-blog.png assets/screenshot-json-tool.png
```

Expected: three successful PNG captures, including JSON sample content, with no hidden-selector timeout.

- [ ] **Step 3: Restore generated assets and sitemap, then verify the diff**

Run:

```bash
git restore assets/screenshot.png assets/screenshot-blog.png assets/screenshot-json-tool.png sitemap.xml
git status --short
git diff --check origin/main...HEAD
git log --oneline --decorate origin/main..HEAD
```

Expected: no generated asset or sitemap modifications; diff check exits 0; commit list contains the design and the six implementation commits.

- [ ] **Step 4: Review requirements line by line**

Confirm in the final handoff:

- both hostnames remain tracked;
- reports separate hostname and normalize paths;
- effective-use metric exists and excludes KMS/JRebel commercially;
- tests and screenshot automation pass;
- catalog counts are executable invariants;
- active docs no longer carry known stale facts;
- no ads, framework migration, deployment, or production push occurred.

- [ ] **Step 5: Request code review before integration**

Invoke `superpowers:requesting-code-review` and address any correctness findings before presenting branch integration options. Do not merge or push without user authorization.
