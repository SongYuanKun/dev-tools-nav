import assert from "node:assert/strict";
import test from "node:test";

import {
  applyUrlCodec,
  decodeComponent,
  encodeComponent,
  encodeForm,
  decodeForm,
} from "../js/url-codec.mjs";

test("encodeURIComponent round-trips Chinese and spaces", () => {
  const raw = "JSON 格式化";
  const encoded = encodeComponent(raw);
  assert.match(encoded, /%/);
  assert.equal(decodeComponent(encoded), raw);
});

test("form encoding uses plus for spaces", () => {
  assert.equal(encodeForm("a b"), "a+b");
  assert.equal(decodeForm("a+b"), "a b");
});

test("applyUrlCodec rejects illegal percent sequences", () => {
  assert.throws(() => applyUrlCodec("decode-component", "%E0%A4%A"), /非法百分号编码/);
});

test("applyUrlCodec supports encode-uri mode", () => {
  const url = "https://example.com/a b?q=1";
  const encoded = applyUrlCodec("encode-uri", url);
  assert.match(encoded, /^https:\/\//);
  assert.equal(applyUrlCodec("decode-uri", encoded), "https://example.com/a b?q=1");
});
