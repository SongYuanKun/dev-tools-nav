import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { digest, md5Hex, HASH_ALGORITHMS } from "../js/hash-core.mjs";

const NODE_ALGO = {
  "SHA-1": "sha1",
  "SHA-256": "sha256",
  "SHA-384": "sha384",
  "SHA-512": "sha512",
};

test("MD5 matches Node crypto vectors", () => {
  assert.equal(md5Hex(""), "d41d8cd98f00b204e9800998ecf8427e");
  assert.equal(md5Hex("abc"), "900150983cd24fb0d6963f7d28e17f72");
  assert.equal(
    md5Hex("Koen's 工具箱"),
    createHash("md5").update("Koen's 工具箱", "utf8").digest("hex"),
  );
});

test("SHA digests match Node crypto", async () => {
  for (const algo of Object.keys(NODE_ALGO)) {
    const expected = createHash(NODE_ALGO[algo]).update("abc", "utf8").digest("hex");
    assert.equal(await digest(algo, "abc", "hex"), expected, algo);
  }
});

test("HASH_ALGORITHMS lists MD5 and SHA family", () => {
  assert.deepEqual(HASH_ALGORITHMS, ["MD5", "SHA-1", "SHA-256", "SHA-384", "SHA-512"]);
});

test("digest supports base64 output for MD5", async () => {
  const hex = await digest("MD5", "abc", "hex");
  const b64 = await digest("MD5", "abc", "base64");
  assert.equal(hex.length, 32);
  assert.ok(b64.length > 0);
  assert.notEqual(hex, b64);
});
