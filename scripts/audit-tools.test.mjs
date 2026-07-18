import test from "node:test";
import assert from "node:assert/strict";
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import {
  SELF_BUILT_TOOLS,
  auditTools,
  parseToolCatalog,
  readmeUsesCanonicalToolsPath,
} from "./audit-tools.mjs";

const SELF_BUILT_RECORDS = [
  ["base64", "online-base64", "tools/base64/"],
  ["color", "online-color", "tools/color/"],
  ["cron", "online-cron", "tools/cron/"],
  ["diff", "online-diff", "tools/diff/"],
  ["json", "online-json", "tools/json/"],
  ["jwt", "online-jwt", "tools/jwt/"],
  ["regex", "online-regex", "tools/regex/"],
  ["sql-formatter", "online-sql", "tools/sql-formatter/"],
  ["timestamp", "online-timestamp", "tools/timestamp/"],
  ["uuid", "online-uuid", "tools/uuid/"],
];

function withCatalogFixture(records, callback) {
  const root = mkdtempSync(join(tmpdir(), "audit-tools-"));
  try {
    mkdirSync(join(root, "data"));
    writeFileSync(
      join(root, "data", "tools.js"),
      `const TOOLS_DATA = [\n${records.map(([, id, url, category = "online-tools"]) => `  {\n    id: "${id}",\n    category: "${category}",\n    url: "${url}",\n  },`).join("\n")}\n];\n`,
    );
    writeFileSync(join(root, "README.md"), "");
    for (const [slug] of SELF_BUILT_RECORDS) {
      mkdirSync(join(root, "tools", slug), { recursive: true });
      writeFileSync(join(root, "tools", slug, "index.html"), "");
    }
    callback(auditTools(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("parser counts only TOOLS_DATA top-level objects", () => {
  const source = `const CATEGORIES = [{ id: "not-a-tool" }];
const TOOLS_DATA = [
  {
    id: "alpha",
    category: "dev",
    url: "https://example.com",
    content: { id: "nested-id" },
  },
];`;

  assert.deepEqual(parseToolCatalog(source), {
    tools: [{ id: "alpha", category: "dev", url: "https://example.com" }],
    invalidTools: [],
  });
});

test("parser reports missing top-level required fields", () => {
  const source = `const TOOLS_DATA = [
  {
    id: "broken",
    category: "dev",
    content: { url: "https://nested.example.com" },
  },
];`;

  assert.deepEqual(parseToolCatalog(source).invalidTools, [
    { index: 0, missingFields: ["url"] },
  ]);
});

test("README canonical policy rejects legacy paths in the public table", () => {
  const paths = SELF_BUILT_TOOLS.map((slug) => `| tool | \`/tools/${slug}/\` | note |`).join("\n");
  const readme = `## 在线工具（\`/tools/\`）\n\n${paths}\n\n公开规范 URL 统一使用。`;

  assert.equal(readmeUsesCanonicalToolsPath(readme), true);
  assert.equal(readmeUsesCanonicalToolsPath(
    readme.replace("\n\n公开规范", "\n| legacy | \`pages/tools/legacy.html\` | note |\n\n公开规范"),
  ), false);
});

test("catalog has the approved counts and unique IDs", () => {
  const result = auditTools(process.cwd());
  assert.equal(result.total, 73);
  assert.equal(result.categoryCounts["online-tools"], 11);
  assert.deepEqual(result.duplicateIds, []);
  assert.deepEqual(result.invalidTools, []);
});

test("all ten self-built tools have canonical shells", () => {
  const result = auditTools(process.cwd());
  assert.deepEqual(result.selfBuilt, [
    "base64", "color", "cron", "diff", "json",
    "jwt", "regex", "sql-formatter", "timestamp", "uuid",
  ]);
  assert.deepEqual(result.missingCanonical, []);
});

test("audit reports a missing self-built catalog record", () => {
  withCatalogFixture(SELF_BUILT_RECORDS.slice(1), (result) => {
    assert.deepEqual(result.selfBuiltCatalogErrors, [
      { slug: "base64", issue: "missing catalog record" },
    ]);
  });
});

test("audit reports a self-built tool in the wrong category", () => {
  const records = SELF_BUILT_RECORDS.map((record) =>
    record[0] === "json" ? [...record, "dev"] : record
  );
  withCatalogFixture(records, (result) => {
    assert.deepEqual(result.selfBuiltCatalogErrors, [
      { slug: "json", issue: "category", expected: "online-tools", actual: "dev" },
    ]);
  });
});

test("audit reports a self-built tool with the wrong catalog URL", () => {
  const records = SELF_BUILT_RECORDS.map((record) =>
    record[0] === "uuid" ? [record[0], record[1], "pages/tools/uuid.html"] : record
  );
  withCatalogFixture(records, (result) => {
    assert.deepEqual(result.selfBuiltCatalogErrors, [
      { slug: "uuid", issue: "url", expected: "tools/uuid/", actual: "pages/tools/uuid.html" },
    ]);
  });
});

test("README states all three catalog counts and canonical URL policy", () => {
  const result = auditTools(process.cwd());
  assert.deepEqual(result.readmeCounts, { total: 73, selfBuilt: 10, onlineTools: 11 });
  assert.equal(result.readmeUsesCanonicalToolsPath, true);
});

test("README places KMS and JRebel in the hidden activate category", () => {
  const readme = readFileSync("README.md", "utf-8");
  const easterEggSection = readme.match(/^## 🎮 彩蛋系统\n([\s\S]*?)(?=^## |$(?![\s\S]))/m)?.[1] ?? "";

  assert.match(easterEggSection, /KMS \/ JRebel[^\n]*隐藏的 `activate` 数据分类/);
  assert.doesNotMatch(easterEggSection, /KMS \/ JRebel[^\n]*在线工具/);
});

test("README documents the actual Logo unlock timing and source", () => {
  const readme = readFileSync("README.md", "utf-8");
  const easterEggSection = readme.match(/^## 🎮 彩蛋系统\n([\s\S]*?)(?=^## |$(?![\s\S]))/m)?.[1] ?? "";

  assert.match(easterEggSection, /Logo 相邻点击间隔不超过1\.5秒，共7次/);
  assert.match(easterEggSection, /`js\/easter-egg\.js`/);
  assert.doesNotMatch(easterEggSection, /Logo 7 次（3 秒内）|`js\/main\.js`/);
});

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

test("README names only docs/roadmap.md as the active roadmap source", () => {
  const readme = readFileSync("README.md", "utf-8");

  assert.match(readme, /唯一活跃[^\n]*\[产品路线图\]\(docs\/roadmap\.md\)/);
  assert.doesNotMatch(readme, /产品设计源头|均基于以下战略文档仓库|Astro \+ Tailwind/);
});

test("README keeps AI capabilities without a second roadmap", () => {
  const readme = readFileSync("README.md", "utf-8");

  assert.match(readme, /^## AI 专题（当前能力）$/m);
  assert.doesNotMatch(readme, /^## AI 专题规划|^### 未完成 \/ 待办|^\*\*P[012].*\*\*|^\*\*下一阶段产品 TODO/m);
});

test("README summarizes outbound deployment and links the canonical runbook", () => {
  const readme = readFileSync("README.md", "utf-8");

  assert.doesNotMatch(readme, /与 `deploy\.sh` 排除规则一致/);
  assert.doesNotMatch(readme, /三套部署 manifest/);
  assert.match(readme, /GTR[^\n]*出站/);
  assert.match(readme, /精确 SHA Test/);
  assert.match(readme, /docs\/deploy-1panel\.md/);
});

test("deploy.sh fails fast when build fails and delegates to the atomic local deployer", () => {
  const root = mkdtempSync(join(tmpdir(), "deploy-wrapper-"));
  try {
    mkdirSync(join(root, "scripts"), { recursive: true });
    mkdirSync(join(root, "bin"), { recursive: true });
    cpSync("deploy.sh", join(root, "deploy.sh"));
    chmodSync(join(root, "deploy.sh"), 0o755);
    writeFileSync(join(root, "bin", "npm"), `#!/usr/bin/env bash
set -euo pipefail
printf 'npm:%s\\n' "$*" >> "$WRAPPER_LOG"
[[ "\${FAIL_BUILD:-0}" != 1 ]]
`);
    chmodSync(join(root, "bin", "npm"), 0o755);
    writeFileSync(join(root, "scripts", "deploy-1panel-local.sh"), `#!/usr/bin/env bash
set -euo pipefail
printf 'local\\n' >> "$WRAPPER_LOG"
`);
    chmodSync(join(root, "scripts", "deploy-1panel-local.sh"), 0o755);
    const env = {
      ...process.env,
      PATH: `${join(root, "bin")}:${process.env.PATH}`,
      WRAPPER_LOG: join(root, "wrapper.log"),
    };

    const success = spawnSync("bash", [join(root, "deploy.sh")], { cwd: "/", env, encoding: "utf8" });
    assert.equal(success.status, 0, success.stderr);
    assert.equal(readFileSync(env.WRAPPER_LOG, "utf8"), "npm:run build\nlocal\n");

    writeFileSync(env.WRAPPER_LOG, "");
    const failure = spawnSync("bash", [join(root, "deploy.sh")], {
      cwd: "/",
      env: { ...env, FAIL_BUILD: "1" },
      encoding: "utf8",
    });
    assert.notEqual(failure.status, 0);
    assert.equal(readFileSync(env.WRAPPER_LOG, "utf8"), "npm:run build\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("deploy.sh has fail-fast wrapper text without the legacy rsync target", () => {
  const wrapper = readFileSync("deploy.sh", "utf8");

  assert.match(wrapper, /set -euo pipefail/);
  assert.match(wrapper, /npm run build/);
  assert.doesNotMatch(wrapper, /npm run check:generated/);
  assert.match(wrapper, /exec .*scripts\/deploy-1panel-local\.sh/);
  assert.doesNotMatch(wrapper, /rsync|\/opt\/1panel\/www\/sites\/tools\.songyuankun\.top\/index/);
});

test("content docs record the delivered Markdown single-source pipeline", () => {
  const handbook = readFileSync("content/blog/ai-free-tokens-handbook.md", "utf-8");
  const contentReadme = readFileSync("content/blog/README.md", "utf-8");
  const roadmap = readFileSync("docs/roadmap.md", "utf-8");

  assert.match(handbook, /^slug: ai-free-tokens-handbook$/m);
  assert.match(contentReadme, /\[产品路线图\]\(\.\.\/\.\.\/docs\/roadmap\.md\)/);
  assert.match(contentReadme, /原创博客正文的唯一人工维护来源/);
  assert.match(contentReadme, /`npm run check:generated`/);
  assert.match(contentReadme, /`data\/blog-manifest\.json`/);
  assert.match(roadmap, /原创正文以 `content\/blog\/\*\.md` 为唯一来源/);
  assert.match(roadmap, /\| 建立 Markdown 单一来源流水线 \| done \|/);
  assert.match(roadmap, /\[Atom Feed\]\(\.\.\/feed\.xml\)/);
});

test("roadmap tables use approved statuses and evidence every done row", () => {
  const roadmap = readFileSync("docs/roadmap.md", "utf-8");
  const allowedStatuses = new Set(["planned", "in_progress", "done", "blocked"]);
  let statusColumn = -1;
  let statusRows = 0;

  for (const line of roadmap.split("\n")) {
    if (!line.startsWith("|")) {
      statusColumn = -1;
      continue;
    }

    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    const headerStatusColumn = cells.indexOf("状态");
    if (headerStatusColumn >= 0) {
      statusColumn = headerStatusColumn;
      continue;
    }
    if (statusColumn < 0 || cells.every((cell) => /^:?-+:?$/.test(cell))) continue;

    const status = cells[statusColumn];
    assert.ok(allowedStatuses.has(status), `invalid roadmap status ${status} in: ${line}`);
    if (status === "done") {
      assert.match(line, /\[[^\]]+\]\([^)]+\)/, `done roadmap row lacks evidence link: ${line}`);
    }
    statusRows += 1;
  }

  assert.ok(statusRows > 0, "roadmap contains no status rows");
});
