import assert from "node:assert/strict";
import test from "node:test";

import { encodeQrModules, encodeQrSvg, QR_LEVELS } from "../js/qrcode-core.mjs";

test("QR_LEVELS are L/M/Q/H", () => {
  assert.deepEqual(QR_LEVELS, ["L", "M", "Q", "H"]);
});

test("encodeQrSvg returns an SVG document", async () => {
  const svg = await encodeQrSvg("https://tools.songyuankun.top/", { level: "M" });
  assert.match(svg, /<svg[\s\S]*<\/svg>/i);
});

test("encodeQrModules returns a square matrix", async () => {
  const modules = await encodeQrModules("HELLO", { level: "L" });
  assert.ok(modules.length >= 21);
  assert.equal(modules.length, modules[0].length);
  assert.equal(typeof modules[0][0], "boolean");
});

test("empty input is rejected", async () => {
  await assert.rejects(() => encodeQrSvg(""), /请输入/);
});
