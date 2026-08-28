import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parseToolCatalog } from "./audit-tools.mjs";

function readToolsData(root) {
  const source = readFileSync(join(root, "data", "tools.js"), "utf8");
  return parseToolCatalog(source, { extended: true });
}

test("online tool shell pages point at an existing legacy page", () => {
  const root = process.cwd();
  const { tools } = readToolsData(root);

  const shellTools = tools.filter((tool) => {
    if (!tool || tool.category !== "online-tools" || tool.hidden === true || !tool.slug) {
      return false;
    }

    return existsSync(join(root, "tools", tool.slug, "index.html"));
  });

  assert.ok(shellTools.length > 0, "expected at least one online tool shell page");

  for (const tool of shellTools) {
    assert.equal(
      tool.url,
      `tools/${tool.slug}/`,
      `${tool.id} should expose its shell page as the public tool URL`,
    );

    assert.match(
      String(tool.legacyUrl || ""),
      /^pages\/.+\.html$/,
      `${tool.id} shell page needs a legacyUrl for its iframe target`,
    );

    assert.ok(
      existsSync(join(root, tool.legacyUrl)),
      `${tool.id} legacyUrl should point at an existing page`,
    );
  }
});
