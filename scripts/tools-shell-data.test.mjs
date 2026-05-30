import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";

import { readToolsData } from "./generate-sitemap.mjs";

test("online tool shell entries point at existing legacy pages", () => {
  const { tools } = readToolsData(process.cwd());
  const shellTools = tools.filter((tool) => {
    return (
      tool &&
      tool.category === "online-tools" &&
      tool.hidden !== true &&
      tool.id !== "online-tools-hub" &&
      typeof tool.slug === "string" &&
      tool.slug.trim()
    );
  });

  assert.ok(shellTools.length > 0, "expected at least one shell-backed online tool");

  const missingLegacyUrls = shellTools
    .filter((tool) => !String(tool.legacyUrl || tool.legacy_url || "").trim())
    .map((tool) => tool.id);
  assert.deepEqual(missingLegacyUrls, []);

  for (const tool of shellTools) {
    const expectedShellUrl = `tools/${tool.slug}/`;
    assert.equal(tool.url, expectedShellUrl, `${tool.id} should open the shell route`);

    const legacyUrl = String(tool.legacyUrl || tool.legacy_url || "");
    if (/^https?:\/\//i.test(legacyUrl)) continue;

    const legacyPath = path.join(process.cwd(), legacyUrl);
    assert.ok(existsSync(legacyPath), `${tool.id} legacyUrl target is missing: ${legacyUrl}`);
  }
});
