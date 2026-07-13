# Sitemap Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate one truthful, deterministic Sitemap for both deployment targets without date-only working-tree drift.

**Architecture:** URL discovery remains in `scripts/generate-sitemap.mjs`, but URL-to-source mapping is separated from last-modified resolution and XML rendering. A Git-backed resolver supplies trustworthy dates, missing dates are omitted, and both deployment workflows run the same generator before publishing.

**Tech Stack:** Node.js 24 ESM, `node:test`, Git CLI, GitHub Actions YAML.

## Global Constraints

- The same Git commit must generate byte-identical `sitemap.xml` output on repeated runs.
- `lastmod` must come from the mapped content source's last Git commit date; never use the execution date or filesystem `mtime`.
- Missing or invalid Git dates must omit `<lastmod>` without dropping the URL.
- Preserve canonical URL discovery, template exclusions, XML escaping, sorting, and deduplication.
- Both GitHub Pages and 1Panel must run `node scripts/generate-sitemap.mjs` before publishing.
- Keep `sitemap.xml` tracked and commit one deterministic baseline containing 112 URLs.
- Do not modify URL structure, canonical hostname, `changefreq`, `priority`, or Phase 2 content architecture.

---

### Task 1: Deterministic Git-backed Sitemap dates

**Files:**
- Modify: `scripts/generate-sitemap.mjs`
- Modify: `scripts/generate-sitemap.test.mjs`

**Interfaces:**
- Produces: `resolveGitLastmod(root: string, relativeSourcePath: string): string | undefined`
- Produces: `collectStaticUrls(root: string, options?: { resolveLastmod?: (relativeSourcePath: string) => string | undefined }): SitemapUrl[]`
- Produces: `renderSitemap(urls: SitemapUrl[]): string`
- Preserves: `generateSitemap(root?: string, options?: object): string`
- `SitemapUrl` contains `loc`, optional `lastmod`, `changefreq`, and numeric `priority`; `sourcePath` is internal and must not appear in XML.

- [ ] **Step 1: Write failing source-mapping and invalid-date tests**

Add the following tests using the existing `collectStaticUrls` and `generateSitemap` imports:

```js
test("collectStaticUrls resolves lastmod from each URL's content source", () => {
  const resolved = new Map();
  const urls = collectStaticUrls(process.cwd(), {
    resolveLastmod(sourcePath) {
      resolved.set(sourcePath, "2025-01-02");
      return "2025-01-02";
    },
  });

  assert.equal(urls.find((url) => url.loc.endsWith("/"))?.lastmod, "2025-01-02");
  assert.ok(resolved.has("index.html"));
  assert.ok(resolved.has("tools/json/index.html"));
  assert.ok(resolved.has("pages/ai/index.html"));
  assert.ok(resolved.has("data/tools.js"));
});

test("generateSitemap omits missing and invalid lastmod values", () => {
  const missing = generateSitemap(process.cwd(), { resolveLastmod: () => undefined });
  const invalid = generateSitemap(process.cwd(), { resolveLastmod: () => "today" });

  assert.doesNotMatch(missing, /<lastmod>/);
  assert.doesNotMatch(invalid, /<lastmod>/);
  assert.match(missing, /<loc>https:\/\/tools\.songyuankun\.top\/<\/loc>/);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
node --test scripts/generate-sitemap.test.mjs
```

Expected: FAIL because the current second argument is a `Date`, no content-source resolver is called, and invalid dates are still emitted or rejected incorrectly.

- [ ] **Step 3: Implement content-source mapping and optional dates**

In `scripts/generate-sitemap.mjs`, add `const LASTMOD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;` and replace date-based URL insertion with source-based insertion. This first GREEN uses an empty default resolver; the Git-backed default is introduced only after its own failing test in Step 5:

```js
export function collectStaticUrls(root, options = {}) {
  const resolveLastmod = options.resolveLastmod
    ?? (() => undefined);
  const urls = [];

  const addUrl = (pathname, sourcePath) => {
    const candidate = resolveLastmod(sourcePath);
    const lastmod = LASTMOD_PATTERN.test(candidate ?? "") ? candidate : undefined;
    const meta = pageMeta(pathname);
    urls.push({
      loc: `${BASE_URL}${pathname}`,
      ...(lastmod ? { lastmod } : {}),
      ...meta,
    });
  };

  addUrl("/", "index.html");
  for (const entry of walkHtml(root)) {
    const pathname = pathnameFor(entry.path);
    if (pathname !== "/") addUrl(pathname, entry.path);
  }
  for (const id of collectTemplateIds(root)) {
    addUrl(`/pages/template.html?id=${id}`, "data/tools.js");
  }

  return [...new Map(urls.map((url) => [url.loc, url])).values()]
    .sort((a, b) => a.loc.localeCompare(b.loc));
}
```

Remove the unused `mtime` field from `walkHtml()`. Render `<lastmod>` conditionally:

```js
export function renderSitemap(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url>
    <loc>${xmlEscape(url.loc)}</loc>
${url.lastmod ? `    <lastmod>${xmlEscape(url.lastmod)}</lastmod>\n` : ""}    <changefreq>${xmlEscape(url.changefreq)}</changefreq>
    <priority>${xmlEscape(url.priority.toFixed(1))}</priority>
  </url>`).join("\n")}
</urlset>`;
}

export function generateSitemap(root = DEFAULT_ROOT, options = {}) {
  return renderSitemap(collectStaticUrls(root, options));
}
```

The CLI must call `collectStaticUrls(DEFAULT_ROOT)` once, pass that array to `renderSitemap()`, write the result, and report `urls.length`.

- [ ] **Step 4: Verify GREEN for source mapping and optional dates**

Run:

```bash
node --test scripts/generate-sitemap.test.mjs
```

Expected: all focused tests PASS.

- [ ] **Step 5: Add a failing real-Git resolver test**

Add imports for `execFileSync`, `mkdtempSync`, `rmSync`, `writeFileSync`, `tmpdir`, and `join`; add `resolveGitLastmod` to the module imports. Create a temporary Git repository, commit a page with a fixed date, and clean it in `finally`:

```js
test("resolveGitLastmod returns the content source commit date", () => {
  const root = mkdtempSync(join(tmpdir(), "sitemap-git-"));
  try {
    writeFileSync(join(root, "index.html"), "<h1>fixture</h1>");
    execFileSync("git", ["init"], { cwd: root });
    execFileSync("git", ["config", "user.name", "Sitemap Test"], { cwd: root });
    execFileSync("git", ["config", "user.email", "sitemap@example.test"], { cwd: root });
    execFileSync("git", ["add", "index.html"], { cwd: root });
    execFileSync("git", ["commit", "-m", "fixture"], {
      cwd: root,
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: "2024-03-04T12:00:00Z",
        GIT_COMMITTER_DATE: "2024-03-04T12:00:00Z",
      },
    });

    assert.equal(resolveGitLastmod(root, "index.html"), "2024-03-04");
    assert.equal(resolveGitLastmod(root, "missing.html"), undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 6: Verify RED, then make the minimal resolver implementation pass**

Run the focused test before adding `resolveGitLastmod()` and observe FAIL because the export is missing. Then import `execFileSync` in production, add the resolver, and make it the default:

```js
import { execFileSync } from "node:child_process";

export function resolveGitLastmod(root, relativeSourcePath) {
  try {
    const value = execFileSync(
      "git",
      ["log", "-1", "--format=%cs", "--", relativeSourcePath],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    return LASTMOD_PATTERN.test(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

// Inside collectStaticUrls:
const resolveLastmod = options.resolveLastmod
  ?? ((sourcePath) => resolveGitLastmod(root, sourcePath));
```

Rerun:

```bash
node --test scripts/generate-sitemap.test.mjs
```

Expected: all focused tests PASS with the fixed date `2024-03-04`.

- [ ] **Step 7: Add and verify deterministic output coverage**

Add:

```js
test("generateSitemap is deterministic for the same Git commit", () => {
  const first = generateSitemap(process.cwd());
  const second = generateSitemap(process.cwd());
  assert.equal(second, first);
});
```

Run:

```bash
node --test scripts/generate-sitemap.test.mjs
npm test
```

Expected: focused tests and the full suite PASS.

- [ ] **Step 8: Commit the deterministic generator**

```bash
git add scripts/generate-sitemap.mjs scripts/generate-sitemap.test.mjs
git commit -m "fix: generate truthful sitemap dates"
```

---

### Task 2: Align deployment workflows and tracked Sitemap

**Files:**
- Modify: `.github/workflows/deploy-1panel-ssh.yml`
- Modify: `scripts/generate-sitemap.test.mjs`
- Modify: `sitemap.xml`

**Interfaces:**
- Consumes: deterministic `node scripts/generate-sitemap.mjs` CLI from Task 1.
- Produces: both deployment workflows generate the Sitemap before their publish/assembly step.
- Produces: a tracked 112-URL deterministic Sitemap baseline.

- [ ] **Step 1: Write the failing deployment workflow test**

Add:

```js
test("both deployment workflows generate sitemap before publishing", () => {
  const pages = readFileSync(".github/workflows/deploy-pages.yml", "utf8");
  const onePanel = readFileSync(".github/workflows/deploy-1panel-ssh.yml", "utf8");
  const command = "node scripts/generate-sitemap.mjs";

  assert.ok(pages.includes(command));
  assert.ok(onePanel.includes(command));
  assert.ok(pages.indexOf(command) < pages.indexOf("Assemble site"));
  assert.ok(onePanel.indexOf(command) < onePanel.indexOf("Sync site to temp dir"));
});
```

Add `readFileSync` to the test imports.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test scripts/generate-sitemap.test.mjs
```

Expected: FAIL because `.github/workflows/deploy-1panel-ssh.yml` does not contain the generation command.

- [ ] **Step 3: Generate Sitemap before 1Panel publishing**

Insert this step after checkout and before deploy configuration / rsync:

```yaml
      - name: Generate dynamic sitemap
        run: node scripts/generate-sitemap.mjs
```

The existing checkout keeps `fetch-depth: 0`, which is required for trustworthy per-file Git history.

- [ ] **Step 4: Verify GREEN and regenerate the tracked baseline**

Run:

```bash
node --test scripts/generate-sitemap.test.mjs
npm run build
cp sitemap.xml /tmp/sitemap-first.xml
npm run build
cmp /tmp/sitemap-first.xml sitemap.xml
```

Expected: tests PASS, both builds report `112 URLs`, and `cmp` exits 0.

- [ ] **Step 5: Verify the generated file contract**

Run:

```bash
test "$(rg -c '<url>' sitemap.xml)" -eq 112
expected="$(git log -1 --format=%cs -- index.html)"
actual="$(awk '/<loc>https:\/\/tools.songyuankun.top\/<\/loc>/{root=1; next} root && /<lastmod>/{gsub(/.*<lastmod>|<\/lastmod>.*/, ""); print; exit}' sitemap.xml)"
test "$actual" = "$expected"
git diff --check
```

Expected: 112 URL records, the root URL date equals the last `index.html` commit date, and no whitespace errors.

- [ ] **Step 6: Run full project verification**

Run:

```bash
npm test
npm run audit:tools
npm run build
git diff --check origin/main...HEAD
```

Expected: all tests PASS; audit reports 73 total, 10 self-built, 11 `online-tools`, and no errors; build reports 112 URLs.

- [ ] **Step 7: Commit deployment parity and deterministic artifact**

```bash
git add .github/workflows/deploy-1panel-ssh.yml scripts/generate-sitemap.test.mjs sitemap.xml
git commit -m "fix: publish deterministic sitemap on both hosts"
```

---

### Task 3: Integrate safely and clean the obsolete local drift

**Files:**
- Preserve all files in `/home/kun/vs_code/dev-tools-nav` except the verified date-only `sitemap.xml` drift.

**Interfaces:**
- Consumes: Tasks 1–2 passing commits.
- Produces: `origin/main` at the verified feature HEAD and a clean original worktree without losing unrelated user changes.

- [ ] **Step 1: Re-fetch and prove the push is fast-forwardable**

```bash
git fetch origin main
git merge-base --is-ancestor origin/main HEAD
git status --short
```

Expected: the ancestry command exits 0 and only expected generated/plan changes are present before their commits; if remote automation advanced, merge `origin/main`, rerun Task 2 Step 6, and recheck.

- [ ] **Step 2: Push without force and verify the remote SHA**

```bash
git push origin HEAD:main
git fetch origin main
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"
```

Expected: non-force push succeeds and the SHAs match.

- [ ] **Step 3: Clean only the obsolete original Sitemap drift**

First prove the original worktree still has no other modification:

```bash
git -C /home/kun/vs_code/dev-tools-nav status --short
git -C /home/kun/vs_code/dev-tools-nav diff -- sitemap.xml
```

Expected: only `M sitemap.xml`, with changes limited to old generated dates. Then restore that one generated artifact and verify:

```bash
git -C /home/kun/vs_code/dev-tools-nav restore -- sitemap.xml
test -z "$(git -C /home/kun/vs_code/dev-tools-nav status --porcelain)"
```

If any unrelated change appears, stop and preserve it rather than cleaning the worktree.

- [ ] **Step 4: Record the next roadmap checkpoint**

Do not modify screenshot status based only on local results. Inspect the post-push `Update assets screenshots` Actions run (or trigger it when explicitly authorized); mark the roadmap item `done` only after the real workflow succeeds with all three PNG artifacts.
