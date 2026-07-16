# JSON Workbench Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to execute this plan task-by-task, and use `superpowers:test-driven-development` for every behavior change.

**Goal:** Replace the iframe-based JSON tool with a direct, polished, privacy-preserving CodeMirror workbench at `/tools/json/`.

**Architecture:** A DOM-free `json-core.mjs` owns all transformations and validation. A CodeMirror-based `json-workbench.mjs` owns ephemeral UI state and five explicit modes. Rollup produces one tracked browser bundle, the canonical page loads it directly, and the legacy page only redirects.

**Tech Stack:** HTML/CSS, modern JavaScript ESM, CodeMirror 6, `yaml`, Rollup, Node.js 24 `node:test`, Playwright.

## Global Constraints

- `/tools/json/` must never contain an iframe or load `/pages/tools/json.html`.
- The primary JSON text is the sole source of truth; mode changes never mutate it implicitly.
- User content must not enter `localStorage`, analytics properties, logs, or network requests.
- Existing Umami action keys `format`, `minify`, `repair`, `validate`, and `diff` remain stable.
- Failed parsing or conversion must not overwrite either source or target content.
- Generated bundles are tracked and checked for build drift; both deployment workflows run the full build.
- Preserve unrelated worktree changes and do not alter other tools' iframe architecture.

---

### Task 1: Introduce the tested JSON domain core

**Files:**
- Create: `js/json-core.mjs`
- Create: `scripts/json-core.test.mjs`
- Reference: `js/json-tool.js`

**Interfaces:**
- `parseJson(text, { relaxed?: boolean }): { ok: true, value: unknown } | { ok: false, error: JsonError }`
- `formatJson(text, options): OperationResult`
- `minifyJson(text, options): OperationResult`
- `repairJson(text): OperationResult`
- `sortJsonKeys(value): unknown`
- `queryJsonPath(value, path): JsonPathResult`
- `jsonToYaml(value): string`
- `yamlToJson(text): OperationResult`
- `diffJson(left, right): DiffResult`
- `jsonStats(value): JsonStats`
- `escapeUnicode(text): string`
- `unescapeUnicode(text): OperationResult`

- [ ] **Step 1: Write failing strict/relaxed parsing tests**

Cover valid primitives/objects, comments outside strings, comment markers inside strings, trailing commas, invalid single quotes, and line/column/offset extraction. Assert relaxed mode only removes comments and trailing commas.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
node --test scripts/json-core.test.mjs
```

Expected: FAIL because `js/json-core.mjs` does not exist.

- [ ] **Step 3: Extract the minimal parser and atomic operations**

Move and harden parser helpers from `js/json-tool.js`. All mutation-producing functions return `{ ok, text, value? }` or `{ ok: false, error }`; they never mutate caller state.

- [ ] **Step 4: Add failing transformation tests, then implement**

Test two/four/tab indentation, minification, recursive stable Key sorting, Unicode round-trip, malformed escape rejection, stats, and failed-operation input preservation. Implement only after observing RED.

- [ ] **Step 5: Add failing JSONPath tests, then implement**

Cover `$`, dotted keys, bracketed numeric indexes, quoted bracket keys, missing paths, malformed expressions, and prototype-pollution keys. Querying `__proto__`, `prototype`, or `constructor` must fail safely.

- [ ] **Step 6: Add `yaml` and test YAML conversion**

```bash
npm install yaml
```

Add RED tests for nested objects/arrays, quoted scalars, null/boolean/number handling, multi-document rejection, aliases disabled or bounded, and failed conversion preservation. Implement with the library's safe document API.

- [ ] **Step 7: Add failing structural Diff tests, then implement**

Cover identical data and added/removed/changed nested properties. Diff output must contain typed paths and safe values rather than pre-rendered HTML.

- [ ] **Step 8: Verify and commit**

```bash
node --test scripts/json-core.test.mjs
npm test
git add js/json-core.mjs scripts/json-core.test.mjs package.json package-lock.json
git commit -m "feat: add tested JSON workbench core"
```

---

### Task 2: Establish the CodeMirror build pipeline

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `rollup.config.mjs`
- Create: `js/json-workbench.mjs`
- Generate: `js/json-workbench.bundle.js`
- Create: `scripts/json-build.test.mjs`
- Modify: `.github/workflows/test.yml`
- Modify: `.github/workflows/deploy-pages.yml`
- Modify: `.github/workflows/deploy-1panel-ssh.yml`
- Modify: `.github/workflows/update-screenshots.yml`
- Modify: `scripts/workflows.test.mjs`

- [ ] **Step 1: Write failing build-contract tests**

Assert `build:json`, `build`, and `check:generated` scripts exist; the bundle exists and is at most 750 KiB; each CI/deploy/screenshot workflow runs `npm ci` and the appropriate full build/check before consuming the site.

- [ ] **Step 2: Verify RED**

```bash
node --test scripts/json-build.test.mjs scripts/workflows.test.mjs
```

- [ ] **Step 3: Install editor/build dependencies**

```bash
npm install codemirror @codemirror/lang-json @codemirror/lint @codemirror/merge
npm install --save-dev rollup @rollup/plugin-node-resolve @rollup/plugin-terser
```

- [ ] **Step 4: Add the minimal editor entry and Rollup configuration**

Create an editor that mounts into `[data-json-editor]`, supports JSON syntax, line numbers, history, folding, search, selection status, and a lint compartment. Produce a deterministic IIFE or ESM bundle with tree-shaking and terser comments disabled.

- [ ] **Step 5: Add full build and generated-drift commands**

`npm run build` runs `build:json`, the existing blog build, then Sitemap generation. `check:generated` rebuilds and fails on `git diff --exit-code -- js/json-workbench.bundle.js` plus other generated artifacts already covered by the project.

- [ ] **Step 6: Update workflows and make tests GREEN**

CI runs the full test/build drift gate. Both deploy workflows and screenshot workflow build before serving or syncing. Update workflow tests first, observe RED, then update YAML.

- [ ] **Step 7: Verify and commit**

```bash
npm run build:json
node --test scripts/json-build.test.mjs scripts/workflows.test.mjs
npm test
git diff --check
git add package.json package-lock.json rollup.config.mjs js/json-workbench.mjs js/json-workbench.bundle.js scripts/json-build.test.mjs scripts/workflows.test.mjs .github/workflows
git commit -m "build: bundle CodeMirror JSON workbench"
```

---

### Task 3: Build the direct canonical workbench shell

**Files:**
- Rewrite: `tools/json/index.html`
- Create: `css/json-workbench.css`
- Create: `scripts/json-page.test.mjs`
- Modify: `js/json-workbench.mjs`
- Generate: `js/json-workbench.bundle.js`

- [ ] **Step 1: Write failing canonical-page tests**

Assert the canonical page contains no iframe, loads the workbench stylesheet and bundle, exposes five labeled tabs and the required actions, contains one primary editor mount, has visible tutorial/FAQ text, and has matching SoftwareApplication/HowTo/FAQPage JSON-LD.

- [ ] **Step 2: Verify RED**

```bash
node --test scripts/json-page.test.mjs
```

- [ ] **Step 3: Rewrite the page semantic structure**

Build the direct page with the existing site header/footer conventions, skip link, concise hero, privacy badge, tablist, primary/secondary command groups, error banner, mode panels, status bar, tutorial, FAQ, and related tools. Do not copy the old duplicate output layout.

- [ ] **Step 4: Implement the visual system**

Use a restrained dark-first developer workbench with a strong editor surface, one accent color, clear hierarchy, responsive command wrapping, sticky-on-desktop controls, 44 px touch targets, high-contrast focus rings, reduced-motion handling, and no viewport overflow at 390 px.

- [ ] **Step 5: Wire theme and site chrome without iframe assumptions**

Retain existing `base.js`, `theme-mini.js`, `tool-chrome.js`, footer, Umami helper/labels, catalog navigation and favorite behavior where compatible. The JSON module owns only its workbench.

- [ ] **Step 6: Verify, build, and commit**

```bash
npm run build:json
node --test scripts/json-page.test.mjs
npm test
git diff --check
git add tools/json/index.html css/json-workbench.css js/json-workbench.mjs js/json-workbench.bundle.js scripts/json-page.test.mjs
git commit -m "feat: add direct JSON workbench page"
```

---

### Task 4: Implement editor commands, diagnostics, and settings

**Files:**
- Modify: `js/json-workbench.mjs`
- Generate: `js/json-workbench.bundle.js`
- Create: `scripts/json-workbench.browser.test.mjs`

- [ ] **Step 1: Add a reusable browser-test server and RED core-flow tests**

Launch the repo over local HTTP and collect `pageerror`, failed requests, and console errors. Test sample loading, editing, format, minify, undo, copy, clear, keyboard shortcuts, and status counts.

- [ ] **Step 2: Implement atomic editor commands**

Commands read the current document, call `json-core`, and replace the whole document in one CodeMirror transaction only on success. Each successful effective action emits the stable Umami key; no event property includes document content.

- [ ] **Step 3: Add RED diagnostic-location tests**

Enter multiline malformed JSON, assert a banner with line/column and editor lint markers, activate “定位”, and assert selection/focus reaches the reported offset.

- [ ] **Step 4: Implement debounced diagnostics and repair preview**

Use a lint source backed by `parseJson`. Inputs over 1 MiB disable automatic heavy views. “尝试修复” shows an accessible confirmation dialog with a safe text diff summary before applying.

- [ ] **Step 5: Add RED settings/privacy/file tests**

Test indent/relaxed/escape preference persistence, absence of content keys in `localStorage`, 5 MiB upload rejection, valid upload, deterministic download name/MIME, menu Escape/focus return, and page reload starting without prior content.

- [ ] **Step 6: Implement settings and local file flows**

Persist only an allowlisted preference object. Read files with size/type checks. Create downloads through Blob/ObjectURL and revoke them. Add clear user feedback for clipboard and browser capability failures.

- [ ] **Step 7: Verify and commit**

```bash
npm run build:json
node --test scripts/json-workbench.browser.test.mjs
npm test
git add js/json-workbench.mjs js/json-workbench.bundle.js scripts/json-workbench.browser.test.mjs
git commit -m "feat: add JSON editor commands and diagnostics"
```

---

### Task 5: Implement tree, JSONPath, YAML, and Diff modes

**Files:**
- Modify: `js/json-workbench.mjs`
- Modify: `css/json-workbench.css`
- Generate: `js/json-workbench.bundle.js`
- Modify: `scripts/json-workbench.browser.test.mjs`

- [ ] **Step 1: Write RED mode-state tests**

Switch through all five modes after entering a sentinel document and assert every mode returns to the identical main JSON text. Verify tab selection and focus behavior.

- [ ] **Step 2: Implement tree mode**

Render safe text nodes with expand/collapse, value type labels, item counts, copyable JSONPath, expand/collapse all, and a clear invalid-input state. Add RED/GREEN browser coverage.

- [ ] **Step 3: Implement JSONPath mode**

Add query history only in memory, Enter-to-run, match count, path plus JSON result, copy action, and precise unsupported-expression feedback. Add RED/GREEN coverage.

- [ ] **Step 4: Implement YAML mode**

Mount a YAML editor only when needed. Explicit `JSON → YAML` refreshes YAML; `应用为 JSON` validates YAML and atomically updates the main JSON. Test invalid YAML and multi-document rejection before implementation.

- [ ] **Step 5: Implement Diff mode with CodeMirror MergeView**

Initialize left from main JSON once per explicit reset, preserve the right side while switching modes, and show structural summary counts alongside textual differences. Do not mutate main JSON without an explicit “应用左侧/右侧” action. Test added, removed, changed and identical states.

- [ ] **Step 6: Verify responsive mode layouts and commit**

```bash
npm run build:json
node --test scripts/json-core.test.mjs scripts/json-workbench.browser.test.mjs
npm test
git diff --check
git add js/json-workbench.mjs js/json-workbench.bundle.js css/json-workbench.css scripts/json-workbench.browser.test.mjs
git commit -m "feat: add JSON workbench analysis modes"
```

---

### Task 6: Cut over legacy routing and screenshots

**Files:**
- Rewrite: `pages/tools/json.html`
- Delete: `js/json-tool.js`
- Modify: `css/tools.css`
- Modify: `scripts/capture-screenshots.mjs`
- Modify: `scripts/capture-screenshots.test.mjs`
- Modify: `scripts/json-page.test.mjs`
- Regenerate: `assets/screenshot-json-tool.png`

- [ ] **Step 1: Add RED compatibility tests**

Assert the legacy page is `noindex`, uses `location.replace` to `/tools/json/`, preserves non-embed query parameters, removes `embed`, and contains no workbench implementation. Assert no repository HTML references `json-tool.js` or `?embed=1` for JSON.

- [ ] **Step 2: Rewrite the compatibility page and remove legacy code**

Use a minimal script plus fallback link. Delete `js/json-tool.js`. Remove only CSS selectors proven to be JSON/iframe specific; keep shared selectors used by other tools.

- [ ] **Step 3: Update screenshot contract first, then implementation**

The target becomes `/tools/json/`; preparation clicks the new sample action and waits for CodeMirror content. Add a test that rejects the legacy path and old textarea selectors.

- [ ] **Step 4: Capture and visually inspect desktop and mobile**

```bash
npm run build
python3 -m http.server 8765
BASE_URL=http://127.0.0.1:8765 npm run capture-screenshots
```

Inspect `assets/screenshot-json-tool.png` plus explicit 390×844 and 1440×900 screenshots. Check overflow, hierarchy, editor readability, mode controls, light/dark contrast and below-fold content.

- [ ] **Step 5: Verify and commit**

```bash
npm test
npm run audit:tools
npm run build
git diff --check
git add pages/tools/json.html css/tools.css scripts/capture-screenshots.mjs scripts/capture-screenshots.test.mjs scripts/json-page.test.mjs assets/screenshot-json-tool.png
git add -u js/json-tool.js
git commit -m "refactor: cut over canonical JSON workbench"
```

---

### Task 7: Accessibility, performance, and regression hardening

**Files:**
- Modify as required: `tools/json/index.html`
- Modify as required: `css/json-workbench.css`
- Modify as required: `js/json-workbench.mjs`
- Generate as required: `js/json-workbench.bundle.js`
- Modify: `scripts/json-workbench.browser.test.mjs`
- Modify: `scripts/json-build.test.mjs`

- [ ] **Step 1: Add desktop/mobile regression matrix**

Test 1440×900 and 390×844 in light/dark schemes. Assert no document-level horizontal overflow, no nested page/editor scroll trap, minimum primary touch-target dimensions, and visible focus for every interactive control.

- [ ] **Step 2: Add automated accessibility assertions**

Verify landmark and heading order, unique IDs, accessible names, tab/tabpanel relationships, live regions, dialog focus trap/return, keyboard-only core flows, and reduced-motion CSS. Fix every reproducible violation.

- [ ] **Step 3: Add performance and privacy assertions**

Assert bundle size budget, no user-input network payloads, no content persistence, 1 MiB heavy-view guard, and usable formatting of a representative large JSON fixture. Record timing as diagnostic output without a flaky wall-clock failure threshold.

- [ ] **Step 4: Run focused and full verification**

```bash
npm run build
node --test scripts/json-core.test.mjs scripts/json-build.test.mjs scripts/json-page.test.mjs scripts/json-workbench.browser.test.mjs
npm test
npm run audit:tools
npm run check:generated
git diff --check
```

- [ ] **Step 5: Commit hardening changes**

```bash
git add tools/json/index.html css/json-workbench.css js/json-workbench.mjs js/json-workbench.bundle.js scripts/json-workbench.browser.test.mjs scripts/json-build.test.mjs
git commit -m "test: harden JSON workbench experience"
```

---

### Task 8: Review, integrate, and verify production delivery

**Files:**
- Modify: `docs/roadmap.md`
- Modify if evidence requires: `README.md`, `docs/README.md`

- [ ] **Step 1: Request independent specification and code-quality reviews**

Use fresh reviewer agents. Resolve critical and important findings with TDD, then rerun focused tests. Do not mark roadmap work done before evidence exists.

- [ ] **Step 2: Perform final clean-tree verification**

```bash
npm ci
npm test
npm run audit:tools
npm run build
npm run check:generated
git status --short
```

Expected: all commands pass and status is clean after committing deterministic generated outputs.

- [ ] **Step 3: Update roadmap evidence and commit**

Record the canonical no-iframe page, browser coverage, build gate, screenshot and commit evidence. Do not invent live analytics outcomes.

```bash
git add docs/roadmap.md README.md docs/README.md
git commit -m "docs: record JSON workbench delivery"
```

- [ ] **Step 4: Sync and update `main` safely**

Fetch `origin/main`, inspect remote-only changes, rebase or merge without force, rerun the final verification, fast-forward local `main`, and push `main`.

- [ ] **Step 5: Verify GitHub Actions and live canonical page**

Wait for test, deploy and screenshot runs associated with the pushed commit. Confirm `/tools/json/` serves the direct workbench and `/pages/tools/json.html` redirects. If deployment fails, diagnose and fix before declaring completion.

- [ ] **Step 6: Return to the active Markdown pipeline objective**

Resume the approved Markdown single-source plan: finish its acceptance section, write the implementation plan, and execute it under the existing goal constraints.
