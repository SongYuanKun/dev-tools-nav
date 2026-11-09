import assert from "node:assert/strict";
import test from "node:test";

import {
  assessJsonPayloadSize,
  buildHttpSnippets,
  diffJson,
  escapeUnicode,
  formatJson,
  formatJsonPath,
  isJsonNumber,
  jsonToYaml,
  jsonStats,
  minifyJson,
  parseJson,
  queryJsonPath,
  repairJson,
  sortJsonKeys,
  stringifyJson,
  summarizeDiffChanges,
  unescapeUnicode,
  yamlToJson,
} from "../js/json-core.mjs";

test("parseJson accepts every valid JSON top-level type", () => {
  for (const [source, expected] of [
    ['{"answer":42}', { answer: 42 }],
    ["[true,null]", [true, null]],
    ['"text"', "text"],
    ["42", 42],
    ["false", false],
    ["null", null],
  ]) {
    assert.deepEqual(parseJson(source), { ok: true, value: expected });
  }
});

test("parseJson relaxed mode accepts comments and trailing commas", () => {
  const source = `{
  // a line comment
  "url": "https://example.com/a//b",
  "marker": "/* text */",
  /* a block
     comment */
  "items": [1, 2,],
}`;

  assert.deepEqual(parseJson(source, { relaxed: true }), {
    ok: true,
    value: {
      url: "https://example.com/a//b",
      marker: "/* text */",
      items: [1, 2],
    },
  });
  assert.equal(parseJson(source).ok, false);
});

test("parseJson relaxed mode accepts a comment between a trailing comma and closing token", () => {
  const source = '{"items": [1, /* keep offset */ ], /* final */ }';
  assert.deepEqual(parseJson(source, { relaxed: true }), {
    ok: true,
    value: { items: [1] },
  });
});

test("parseJson relaxed mode rejects an unterminated block comment", () => {
  const source = '{"valid": true} /* never closed';
  const result = parseJson(source, { relaxed: true });
  assert.equal(result.ok, false);
  assert.equal(result.error.offset, source.indexOf("/*"));
});

test("parseJson relaxed mode does not accept single-quoted strings", () => {
  const result = parseJson("{'answer': 42}", { relaxed: true });
  assert.equal(result.ok, false);
});

test("parseJson reports an original-source offset, line, and column", () => {
  const source = `{
  // keep offsets aligned
  "valid": true,
  "broken": nope
}`;
  const result = parseJson(source, { relaxed: true });

  assert.equal(result.ok, false);
  assert.equal(result.error.offset, source.indexOf("nope") + 1);
  assert.equal(result.error.line, 4);
  assert.equal(result.error.column, 14);
  assert.match(result.error.message, /JSON|unexpected|token|property/i);
});

test("parseJson keeps UTF-16 offsets aligned after emoji inside comments", () => {
  const source = `{
  // 😀 keep two UTF-16 code units
  "broken": nope
}`;
  const result = parseJson(source, { relaxed: true });
  assert.equal(result.ok, false);
  assert.equal(result.error.offset, source.indexOf("nope") + 1);
  assert.equal(result.error.line, 3);
  assert.equal(result.error.column, 14);
});

test("deep JSON parsing and repair fail structurally instead of throwing RangeError", () => {
  const invalid = `${"[".repeat(15_000)}x${"]".repeat(15_000)}`;
  const valid = `${"[".repeat(15_000)}0${"]".repeat(15_000)}`;
  for (const operation of [() => parseJson(invalid), () => parseJson(valid), () => repairJson(invalid)]) {
    let result;
    assert.doesNotThrow(() => { result = operation(); });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "MAX_DEPTH_EXCEEDED");
  }
});

test("parseJson locates the first divergent character in invalid literals", () => {
  for (const source of ["truX", '{"x": falsX}', "{\n  \"x\": nulX\n}"]) {
    const result = parseJson(source);
    const expectedOffset = source.indexOf("X");
    const before = source.slice(0, expectedOffset);
    const expectedLine = before.split("\n").length;
    const expectedColumn = expectedOffset - before.lastIndexOf("\n");
    assert.equal(result.ok, false, source);
    assert.equal(result.error.offset, expectedOffset, source);
    assert.equal(result.error.line, expectedLine, source);
    assert.equal(result.error.column, expectedColumn, source);
  }
});

test("parseJson locates intermediate literal mismatches at top level and nested", () => {
  for (const token of ["tXue", "trXe", "fXlse", "faXse", "nXll", "nuXl"]) {
    for (const source of [token, `{\n  "value": ${token}\n}`]) {
      const result = parseJson(source);
      const expectedOffset = source.indexOf("X");
      const before = source.slice(0, expectedOffset);
      assert.equal(result.ok, false, source);
      assert.equal(result.error.offset, expectedOffset, source);
      assert.equal(result.error.line, before.split("\n").length, source);
      assert.equal(result.error.column, expectedOffset - before.lastIndexOf("\n"), source);
    }
  }
});

test("formatJson supports two spaces, four spaces, and tabs", () => {
  const source = '{"outer":{"value":1}}';
  assert.equal(formatJson(source, { indent: 2 }).text, '{\n  "outer": {\n    "value": 1\n  }\n}');
  assert.equal(formatJson(source, { indent: 4 }).text, '{\n    "outer": {\n        "value": 1\n    }\n}');
  assert.equal(formatJson(source, { indent: "\t" }).text, '{\n\t"outer": {\n\t\t"value": 1\n\t}\n}');
  assert.equal(formatJson(source, { indent: "4" }).text, '{\n    "outer": {\n        "value": 1\n    }\n}');
});

test("formatJson and minifyJson optionally use relaxed parsing", () => {
  const source = '{\n  // comment\n  "value": 1,\n}';
  assert.equal(formatJson(source).ok, false);
  assert.deepEqual(minifyJson(source, { relaxed: true }), {
    ok: true,
    text: '{"value":1}',
    value: { value: 1 },
  });
});

test("failed transformations provide no replacement text and leave input untouched", () => {
  const source = '{"broken": nope}';
  const result = minifyJson(source);
  assert.equal(result.ok, false);
  assert.equal("text" in result, false);
  assert.equal(source, '{"broken": nope}');
});

test("repairJson repairs comments and trailing commas", () => {
  const repaired = repairJson('{/* note */"a":[1,],}');
  assert.equal(repaired.ok, true);
  assert.equal(repaired.text, '{\n  "a": [\n    1\n  ]\n}');
});

test("repairJson safely converts single-quoted keys and values", () => {
  const source = String.raw`{
    // a comment's apostrophe stays comment text
    'name': 'Koen',
    'quote': 'it\'s "great"',
    'unicode': '\u4e2d',
    'slash': '\\',
    "unchanged": "don't // touch",
  }`;
  const result = repairJson(source);
  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(result.text), {
    name: "Koen",
    quote: `it's "great"`,
    unicode: "中",
    slash: "\\",
    unchanged: "don't // touch",
  });
});

test("repairJson rejects ambiguous or unterminated single-quoted strings", () => {
  for (const source of [String.raw`{'value': '\x41'}`, "{'value': 'unterminated}", "{'value': 'line\nbreak'}"]) {
    const result = repairJson(source);
    assert.equal(result.ok, false, source);
    assert.equal("text" in result, false, source);
  }
});

test("repairJson maps errors back after a shrinking single-quote conversion", () => {
  const source = String.raw`{'x':'it\'s', 'bad': nope}`;
  const result = repairJson(source);
  assert.equal(result.ok, false);
  assert.equal(result.error.offset, source.indexOf("nope") + 1);
  assert.equal(result.error.line, 1);
  assert.equal(result.error.column, source.indexOf("nope") + 2);
});

test("repairJson maps errors back after a growing embedded-quote conversion", () => {
  const source = `{'x':'say "hello"', 'bad': nope}`;
  const result = repairJson(source);
  assert.equal(result.ok, false);
  assert.equal(result.error.offset, source.indexOf("nope") + 1);
  assert.equal(result.error.line, 1);
  assert.equal(result.error.column, source.indexOf("nope") + 2);
});

test("sortJsonKeys recursively sorts objects without mutating the input", () => {
  const source = { zebra: 1, alpha: { d: 4, c: 3 }, list: [{ b: 2, a: 1 }] };
  const sorted = sortJsonKeys(source);
  assert.deepEqual(sorted, { alpha: { c: 3, d: 4 }, list: [{ a: 1, b: 2 }], zebra: 1 });
  assert.deepEqual(Object.keys(source), ["zebra", "alpha", "list"]);
});

test("sortJsonKeys uses deterministic UTF-16 key ordering", () => {
  const sorted = sortJsonKeys({ ä: 1, a: 2, Z: 3 });
  assert.deepEqual(Object.keys(sorted), ["Z", "a", "ä"]);
});

test("Unicode escaping round-trips BMP and surrogate-pair characters", () => {
  const source = "JSON 工具 😀";
  const escaped = escapeUnicode(source);
  assert.equal(escaped, "JSON \\u5de5\\u5177 \\ud83d\\ude00");
  assert.deepEqual(unescapeUnicode(escaped), { ok: true, text: source });
});

test("unescapeUnicode rejects malformed Unicode escape sequences", () => {
  const result = unescapeUnicode("bad \\u12xz");
  assert.equal(result.ok, false);
  assert.equal("text" in result, false);
});

test("unescapeUnicode respects backslash parity and preserves valid JSON", () => {
  const literalEscape = String.raw`{"x":"\\u4e2d","malformedLiteral":"\\u12xz"}`;
  const literalResult = unescapeUnicode(literalEscape);
  assert.equal(literalResult.ok, true);
  assert.doesNotThrow(() => JSON.parse(literalResult.text));
  assert.deepEqual(JSON.parse(literalResult.text), JSON.parse(literalEscape));

  const activeEscape = String.raw`{"x":"\u4e2d"}`;
  const activeResult = unescapeUnicode(activeEscape);
  assert.equal(activeResult.ok, true);
  assert.deepEqual(JSON.parse(activeResult.text), { x: "中" });

  const oddRun = String.raw`{"x":"\\\u4e2d"}`;
  const oddResult = unescapeUnicode(oddRun);
  assert.equal(oddResult.ok, true);
  assert.deepEqual(JSON.parse(oddResult.text), { x: "\\中" });
});

test("unescapeUnicode keeps JSON syntax valid for decoded quotes, slashes, and controls", () => {
  const source = String.raw`{"quote":"\u0022","slash":"\u005c","line":"\u000a"}`;
  const result = unescapeUnicode(source);
  assert.equal(result.ok, true);
  assert.doesNotThrow(() => JSON.parse(result.text));
  assert.deepEqual(JSON.parse(result.text), JSON.parse(source));
});

test("jsonStats counts containers, keys, primitives, and maximum depth", () => {
  const value = { a: 1, nested: { b: true }, items: [null, "x"] };
  assert.deepEqual(jsonStats(value), {
    objects: 2,
    arrays: 1,
    keys: 4,
    primitives: 4,
    depth: 2,
  });
});

test("queryJsonPath supports root, dotted keys, indexes, and quoted bracket keys", () => {
  const value = { users: [{ name: "Koen" }], "a.b": { "display name": "工具" } };
  assert.deepEqual(queryJsonPath(value, "$"), { ok: true, value, path: [] });
  assert.deepEqual(queryJsonPath(value, "$.users[0].name"), {
    ok: true,
    value: "Koen",
    path: ["users", 0, "name"],
  });
  assert.deepEqual(queryJsonPath(value, '$["a.b"][\'display name\']'), {
    ok: true,
    value: "工具",
    path: ["a.b", "display name"],
  });
});

test("queryJsonPath distinguishes missing and malformed paths", () => {
  const missing = queryJsonPath({ users: [] }, "$.users[2]");
  assert.equal(missing.ok, false);
  assert.equal(missing.error.code, "PATH_NOT_FOUND");

  for (const path of ["$.users[", "$.users..name", "$[unquoted]", "$.users[*]"]) {
    const malformed = queryJsonPath({}, path);
    assert.equal(malformed.ok, false, path);
    assert.equal(malformed.error.code, "INVALID_PATH", path);
  }
});

test("queryJsonPath rejects prototype-pollution segments", () => {
  for (const path of ["$.__proto__", "$.prototype", "$.constructor.name", '$["__proto__"]']) {
    const result = queryJsonPath({}, path);
    assert.equal(result.ok, false, path);
    assert.equal(result.error.code, "UNSAFE_PATH", path);
  }
});

test("queryJsonPath accepts JSON string escapes in quoted property names", () => {
  const value = { "line\nbreak\t😀": "found" };
  assert.deepEqual(queryJsonPath(value, String.raw`$["line\nbreak\t\ud83d\ude00"]`), {
    ok: true,
    value: "found",
    path: ["line\nbreak\t😀"],
  });
});

test("queryJsonPath reports offsets in the untrimmed original path", () => {
  const malformedPath = "  $.users[*]  ";
  const malformed = queryJsonPath({}, malformedPath);
  assert.equal(malformed.ok, false);
  assert.equal(malformed.error.offset, malformedPath.indexOf("*"));

  const unsafePath = "\n  $.__proto__  ";
  const unsafe = queryJsonPath({}, unsafePath);
  assert.equal(unsafe.ok, false);
  assert.equal(unsafe.error.offset, unsafePath.indexOf("__proto__"));
});

test("JSON and YAML conversion preserves nested values and scalar types", () => {
  const value = {
    title: "true",
    enabled: true,
    count: 2,
    empty: null,
    users: [{ name: "Koen", tags: ["dev", "工具"] }],
  };
  const yaml = jsonToYaml(value);
  assert.equal(yaml.ok, true);
  assert.match(yaml.text, /title:\s+["']?true["']?/);
  const converted = yamlToJson(yaml.text);
  assert.equal(converted.ok, true);
  assert.deepEqual(converted.value, value);
  assert.deepEqual(JSON.parse(converted.text), value);
});

test("yamlToJson preserves explicitly quoted scalars", () => {
  const result = yamlToJson('truth: "true"\nnumber: "42"\nnothing: "null"\nactual: null\n');
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    truth: "true",
    number: "42",
    nothing: "null",
    actual: null,
  });
});

test("yamlToJson rejects multiple YAML documents", () => {
  const result = yamlToJson("---\na: 1\n---\nb: 2\n");
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "MULTIPLE_DOCUMENTS");
  assert.equal("text" in result, false);
});

test("yamlToJson rejects aliases instead of expanding them", () => {
  const result = yamlToJson("base: &base\n  role: admin\ncopy: *base\n");
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "ALIASES_DISABLED");
  assert.equal("text" in result, false);
});

test("yamlToJson returns a safe failure without replacement text", () => {
  const source = "items: [one, two";
  const result = yamlToJson(source);
  assert.equal(result.ok, false);
  assert.equal("text" in result, false);
  assert.equal(source, "items: [one, two");
});

test("yamlToJson rejects YAML values that cannot round-trip through JSON", () => {
  for (const source of ["value: .nan\n", "value: !!set { admin: null }\n"]) {
    const result = yamlToJson(source);
    assert.equal(result.ok, false, source);
    assert.equal(result.error.code, "UNSUPPORTED_YAML_VALUE", source);
    assert.equal("text" in result, false, source);
  }
});

test("yamlToJson rejects complex map keys and unresolved custom tags", () => {
  for (const source of ["? [a, b]\n: value\n", "x: !custom foo\n"]) {
    const result = yamlToJson(source);
    assert.equal(result.ok, false, source);
    assert.equal("text" in result, false, source);
  }
});

test("diffJson reports identical data without changes", () => {
  const value = { user: { name: "Koen" }, roles: ["admin"] };
  assert.deepEqual(diffJson(value, structuredClone(value)), { equal: true, changes: [] });
});

test("diffJson emits typed paths and values for nested structural changes", () => {
  const left = {
    user: { name: "Koen", role: "admin", obsolete: true },
    tags: ["json", "old"],
  };
  const right = {
    user: { name: "Koen", role: "editor", active: true },
    tags: ["json", "new", "tool"],
  };

  assert.deepEqual(diffJson(left, right), {
    equal: false,
    changes: [
      { type: "changed", path: ["tags", 1], before: "old", after: "new" },
      { type: "added", path: ["tags", 2], value: "tool" },
      { type: "added", path: ["user", "active"], value: true },
      { type: "removed", path: ["user", "obsolete"], value: true },
      { type: "changed", path: ["user", "role"], before: "admin", after: "editor" },
    ],
  });
  assert.equal(typeof diffJson(left, right).changes[0].path[1], "number");
});

test("diffJson treats a container type change as one safe root change", () => {
  assert.deepEqual(diffJson({ value: [] }, { value: {} }), {
    equal: false,
    changes: [{ type: "changed", path: ["value"], before: [], after: {} }],
  });
});

test("diffJson truncates structural work at explicit UI budgets", () => {
  const left = Array.from({ length: 20_000 }, () => 0);
  const right = Array.from({ length: 20_000 }, () => 1);
  const result = diffJson(left, right, { maxChanges: 100, maxWork: 1_000 });
  assert.equal(result.equal, false);
  assert.equal(result.truncated, true);
  assert.ok(result.changes.length <= 100);
  const lateDifference = Array.from({ length: 20_000 }, () => 0);
  lateDifference[19_999] = 1;
  assert.deepEqual(diffJson(left, lateDifference, { maxWork: 1_000 }), {
    equal: false,
    changes: [],
    truncated: true,
  });
});

test("deep direct values are handled without recursive stack overflow", () => {
  const source = `${"[".repeat(15_000)}0${"]".repeat(15_000)}`;
  const left = JSON.parse(source);
  const right = JSON.parse(source);
  let sorted;
  let stats;
  let diff;
  let added;
  assert.doesNotThrow(() => { sorted = sortJsonKeys(left); });
  assert.doesNotThrow(() => { stats = jsonStats(left); });
  assert.doesNotThrow(() => { diff = diffJson(left, right); });
  assert.doesNotThrow(() => { added = diffJson({}, { deep: left }); });
  assert.equal(Array.isArray(sorted), true);
  assert.equal(stats.depth, 15_000);
  assert.deepEqual(diff, { equal: true, changes: [] });
  assert.equal(added.changes[0].type, "added");
});

test("formatJsonPath and summarizeDiffChanges produce copy-friendly path digests", () => {
  assert.equal(formatJsonPath(["items", 0, "name"]), "$.items[0].name");
  assert.equal(formatJsonPath(["weird key"]), '$["weird key"]');
  const digest = summarizeDiffChanges([
    { type: "added", path: ["a"] },
    { type: "removed", path: ["b", 1] },
    { type: "changed", path: ["c"] },
  ], { limit: 2 });
  assert.deepEqual(digest.counts, { added: 1, removed: 1, changed: 1 });
  assert.equal(digest.truncated, true);
  assert.match(digest.text, /^\+ \$\.a\n- \$\.b\[1]$/);
});

test("buildHttpSnippets wraps JSON body as local fetch/curl copy targets", () => {
  const body = '{\n  "ok": true\n}';
  const snippets = buildHttpSnippets(body, { url: "https://example.test/v1", method: "post" });
  assert.equal(snippets.method, "POST");
  assert.match(snippets.curl, /curl -sS -X POST 'https:\/\/example\.test\/v1'/);
  assert.match(snippets.curl, /-d '\{\n  "ok": true\n}'/);
  assert.match(snippets.fetch, /method: "POST"/);
  assert.match(snippets.fetch, /body: "\{\\n  \\"ok\\": true\\n}"/);
});

test("assessJsonPayloadSize flags soft and heavy paste budgets", () => {
  const small = assessJsonPayloadSize('{"a":1}');
  assert.equal(small.warn, false);
  assert.equal(small.heavy, false);
  const warn = assessJsonPayloadSize("x".repeat(300 * 1024));
  assert.equal(warn.warn, true);
  assert.equal(warn.heavy, false);
  const heavy = assessJsonPayloadSize("y".repeat(1100 * 1024));
  assert.equal(heavy.heavy, true);
  assert.equal(heavy.skipAutoLint, true);
});

test("format/minify preserve unsafe integer lexemes end-to-end", () => {
  const source = '{"id":9007199254740993,"name":"中文","items":[{"x":true},null]}';
  // Number 字面量本身已丢精度；用字符串对照证明 JSON.parse 静默损坏。
  assert.equal(String(JSON.parse(source).id), "9007199254740992");
  const formatted = formatJson(source);
  assert.equal(formatted.ok, true);
  assert.equal(formatted.preservedNumbers, 1);
  assert.match(formatted.text, /"id": 9007199254740993/);
  assert.equal(isJsonNumber(formatted.value.id), true);
  assert.equal(formatted.value.id.raw, "9007199254740993");
  const minified = minifyJson(formatted.text);
  assert.equal(minified.ok, true);
  assert.equal(minified.text, source);
  const sorted = stringifyJson(sortJsonKeys(formatted.value), { indent: 0 });
  assert.match(sorted, /9007199254740993/);
  const queried = queryJsonPath(formatted.value, "$.id");
  assert.equal(queried.ok, true);
  assert.equal(isJsonNumber(queried.value), true);
  assert.equal(stringifyJson(queried.value), "9007199254740993");
});

test("numeric preservation keeps strings, negatives, fractions, exponents and nested values", () => {
  const source = `{
    "safe": 42,
    "unsafe": -9007199254740993,
    "asString": "9007199254740993",
    "fraction": 0.1,
    "exponent": 1e2,
    "negZero": -0,
    "nested": { "deep": [9007199254740995, {"k": 1}] }
  }`;
  const parsed = parseJson(source);
  assert.equal(parsed.ok, true);
  assert.equal(typeof parsed.value.safe, "number");
  assert.equal(parsed.value.safe, 42);
  assert.equal(isJsonNumber(parsed.value.unsafe), true);
  assert.equal(parsed.value.unsafe.raw, "-9007199254740993");
  assert.equal(parsed.value.asString, "9007199254740993");
  assert.equal(typeof parsed.value.fraction, "number");
  assert.equal(parsed.value.exponent, 100);
  assert.equal(Object.is(parsed.value.negZero, -0) || isJsonNumber(parsed.value.negZero), true);
  assert.equal(isJsonNumber(parsed.value.nested.deep[0]), true);
  const roundTrip = minifyJson(formatJson(source).text);
  assert.equal(roundTrip.ok, true);
  assert.match(roundTrip.text, /"unsafe":-9007199254740993/);
  assert.match(roundTrip.text, /"asString":"9007199254740993"/);
  assert.match(roundTrip.text, /9007199254740995/);
});

test("diffJson compares preserved number lexemes without collapsing precision", () => {
  const left = parseJson('{"id":9007199254740993}').value;
  const right = parseJson('{"id":9007199254740992}').value;
  const same = diffJson(left, parseJson('{"id":9007199254740993}').value);
  assert.equal(same.equal, true);
  const changed = diffJson(left, right);
  assert.equal(changed.equal, false);
  assert.equal(changed.changes[0].type, "changed");
});

test("repairJson preserves unsafe integers while fixing trailing commas", () => {
  const repaired = repairJson('{"id":9007199254740993,}');
  assert.equal(repaired.ok, true);
  assert.match(repaired.text, /9007199254740993/);
  assert.equal(isJsonNumber(repaired.value.id), true);
});

test("jsonToYaml honestly fails for unsafe integer lexemes instead of corrupting", () => {
  const parsed = parseJson('{"id":9007199254740993}');
  const yaml = jsonToYaml(parsed.value);
  assert.equal(yaml.ok, false);
  assert.equal(yaml.error.code, "YAML_NUMBER_LOSSY");
  assert.equal("text" in yaml, false);
});

test("yamlToJson preserves safe numbers and unsafe integer lexemes when representable as plain scalars", () => {
  const safe = yamlToJson("count: 2\n");
  assert.equal(safe.ok, true);
  assert.equal(safe.value.count, 2);
  const unsafe = yamlToJson("id: 9007199254740993\n");
  assert.equal(unsafe.ok, true);
  assert.equal(isJsonNumber(unsafe.value.id), true);
  assert.equal(unsafe.value.id.raw, "9007199254740993");
  assert.match(unsafe.text, /9007199254740993/);
});
