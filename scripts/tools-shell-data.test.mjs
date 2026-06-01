import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

function loadToolsData() {
  const source = readFileSync("data/tools.js", "utf-8");
  return vm.runInNewContext(`${source}\n;({ TOOLS_DATA, CATEGORIES });`, {});
}

test("visible shell-backed online tools define valid shell and legacy URLs", () => {
  const { TOOLS_DATA } = loadToolsData();
  const shellTools = TOOLS_DATA.filter((tool) => (
    tool
    && tool.category === "online-tools"
    && tool.id !== "online-tools-hub"
    && tool.hidden !== true
  ));

  assert.ok(shellTools.length > 0);

  for (const tool of shellTools) {
    assert.ok(tool.slug, `${tool.id} should define a slug`);
    assert.equal(tool.url, `tools/${tool.slug}/`, `${tool.id} should route through the tool shell`);

    const legacyUrl = tool.legacyUrl || tool.legacy_url;
    assert.ok(legacyUrl, `${tool.id} should define a legacyUrl for the iframe`);
    assert.ok(
      existsSync(join(process.cwd(), legacyUrl)),
      `${tool.id} legacyUrl should point to an existing page`,
    );
  }
});

test("KMS shell embeds the KMS legacy page", () => {
  const { TOOLS_DATA } = loadToolsData();
  const kms = TOOLS_DATA.find((tool) => tool && tool.id === "kms");

  assert.ok(kms);
  assert.equal(kms.url, "tools/kms/");
  assert.equal(kms.legacyUrl, "pages/kms.html");
});
