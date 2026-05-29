import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { readToolsData } from "./generate-sitemap.mjs";

test("tool shell routes point at an embeddable legacy page", () => {
  const root = process.cwd();
  const { tools } = readToolsData(root);
  const shellTools = tools.filter((tool) => (
    tool
    && tool.category === "online-tools"
    && tool.slug
    && existsSync(join(root, "tools", tool.slug, "index.html"))
  ));

  assert.ok(shellTools.length > 0, "expected at least one generated tool shell route");

  for (const tool of shellTools) {
    assert.equal(
      typeof tool.legacyUrl,
      "string",
      `${tool.id} must define legacyUrl for tools/${tool.slug}/ shell`,
    );

    const legacyUrl = tool.legacyUrl.trim();
    assert.ok(legacyUrl, `${tool.id} legacyUrl must not be empty`);
    assert.ok(
      !legacyUrl.replace(/^\/+/, "").startsWith(`tools/${tool.slug}/`),
      `${tool.id} legacyUrl must not point back to its shell route`,
    );

    if (!/^https?:\/\//i.test(legacyUrl)) {
      assert.ok(
        existsSync(join(root, legacyUrl.replace(/^\/+/, ""))),
        `${tool.id} legacyUrl target must exist`,
      );
    }
  }
});
