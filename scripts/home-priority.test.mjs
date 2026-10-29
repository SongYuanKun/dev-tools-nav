import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("home first screen prioritizes self-built tools and softens AI/catalog chrome", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /开发者工具，[\s\S]*都在本机运行/);
  assert.match(html, /data-tool-id="json"/);
  assert.match(html, /desk-secondary--quiet/);
  assert.match(html, /<details class="desk-more">/);
  assert.match(html, /更多资源/);
  assert.doesNotMatch(html, /title>Koen 工具箱 - 开发者在线工具与 AI 专题</);
  assert.match(html, /title>Koen 工具箱 - 本机开发者工具</);

  const aiSectionIndex = html.indexOf('id="aiTitle"');
  const toolsSectionIndex = html.indexOf('id="tools"');
  assert.ok(toolsSectionIndex >= 0 && aiSectionIndex > toolsSectionIndex);

  const footer = html.slice(html.indexOf('<div class="footer-links">'));
  assert.ok(footer.indexOf("tools/") < footer.indexOf("pages/ai/index.html"));
});

test("nav injects tools before AI and marks AI as secondary", async () => {
  const source = await readFile(new URL("../js/base.js", import.meta.url), "utf8");
  assert.match(source, /nav-menu--secondary/);
  assert.match(source, /本机开发者工具/);
  const toolsPos = source.indexOf("a(prefix + 'tools/'");
  const aiPos = source.indexOf("aiDropdown");
  const navJoinPos = source.indexOf("'  <div class=\"nav-links\">'");
  assert.ok(toolsPos > navJoinPos);
  // In the returned nav markup string, 工具 link is emitted before aiDropdown interpolation.
  const navBlock = source.slice(navJoinPos, navJoinPos + 500);
  assert.ok(navBlock.indexOf("tools/") < navBlock.indexOf("aiDropdown"));
  assert.ok(aiPos > 0);
});
