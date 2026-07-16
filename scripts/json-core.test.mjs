import assert from "node:assert/strict";
import test from "node:test";

import {
  diffJson,
  escapeUnicode,
  formatJson,
  jsonToYaml,
  jsonStats,
  minifyJson,
  parseJson,
  queryJsonPath,
  repairJson,
  sortJsonKeys,
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
  assert.match(yaml, /title:\s+["']?true["']?/);
  const converted = yamlToJson(yaml);
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
