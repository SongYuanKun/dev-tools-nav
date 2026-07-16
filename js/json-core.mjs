import { parseAllDocuments, stringify as stringifyYaml, visit } from "yaml";

class JsonPreprocessError extends Error {
  constructor(message, offset) {
    super(message);
    this.offset = offset;
  }
}

const MAX_JSON_DEPTH = 512;

function findDepthLimitOffset(source) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{" || char === "[") {
      depth += 1;
      if (depth > MAX_JSON_DEPTH) return index;
    } else if ((char === "}" || char === "]") && depth > 0) depth -= 1;
  }
  return null;
}

function replaceRelaxedSyntax(source) {
  const chars = source.split("");
  let inString = false;
  let escaped = false;

  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "/" && chars[index + 1] === "/") {
      chars[index] = " ";
      chars[index + 1] = " ";
      index += 2;
      while (index < chars.length && chars[index] !== "\n" && chars[index] !== "\r") {
        chars[index] = " ";
        index += 1;
      }
      index -= 1;
      continue;
    }

    if (char === "/" && chars[index + 1] === "*") {
      const commentStart = index;
      let closed = false;
      chars[index] = " ";
      chars[index + 1] = " ";
      index += 2;
      while (index < chars.length) {
        if (chars[index] === "*" && chars[index + 1] === "/") {
          chars[index] = " ";
          chars[index + 1] = " ";
          index += 1;
          closed = true;
          break;
        }
        if (chars[index] !== "\n" && chars[index] !== "\r") chars[index] = " ";
        index += 1;
      }
      if (!closed) throw new JsonPreprocessError("块注释缺少结束标记 */", commentStart);
      continue;
    }

  }

  inString = false;
  escaped = false;
  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char !== ",") continue;
    let next = index + 1;
    while (/\s/.test(chars[next] ?? "")) next += 1;
    if (chars[next] === "}" || chars[next] === "]") chars[index] = " ";
  }

  return chars.join("");
}

function locateJsonSyntaxError(source) {
  let index = 0;
  const fail = (offset = index) => {
    throw { offset };
  };
  const skipWhitespace = () => {
    while (/\s/.test(source[index] ?? "")) index += 1;
  };
  const parseString = () => {
    if (source[index] !== '"') fail();
    index += 1;
    while (index < source.length) {
      const code = source.charCodeAt(index);
      if (source[index] === '"') {
        index += 1;
        return;
      }
      if (source[index] === "\\") {
        index += 1;
        if ('"\\/bfnrt'.includes(source[index])) {
          index += 1;
          continue;
        }
        if (source[index] === "u" && /^[0-9a-fA-F]{4}$/.test(source.slice(index + 1, index + 5))) {
          index += 5;
          continue;
        }
        fail();
      }
      if (code <= 0x1f) fail();
      index += 1;
    }
    fail(source.length);
  };
  const parseNumber = () => {
    const match = source.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (!match) fail();
    index += match[0].length;
  };
  const parseLiteral = (literal) => {
    for (let literalIndex = 0; literalIndex < literal.length; literalIndex += 1) {
      if (source[index + literalIndex] !== literal[literalIndex]) fail(index + literalIndex);
    }
    index += literal.length;
  };
  const parseValue = () => {
    skipWhitespace();
    const char = source[index];
    if (char === '"') parseString();
    else if (char === "{") parseObject();
    else if (char === "[") parseArray();
    else if (char === "-" || /\d/.test(char ?? "")) parseNumber();
    else if (char === "t") parseLiteral("true");
    else if (char === "f") parseLiteral("false");
    else if (char === "n") parseLiteral("null");
    else fail();
  };
  const parseObject = () => {
    index += 1;
    skipWhitespace();
    if (source[index] === "}") {
      index += 1;
      return;
    }
    while (index < source.length) {
      skipWhitespace();
      parseString();
      skipWhitespace();
      if (source[index] !== ":") fail();
      index += 1;
      parseValue();
      skipWhitespace();
      if (source[index] === "}") {
        index += 1;
        return;
      }
      if (source[index] !== ",") fail();
      index += 1;
    }
    fail(source.length);
  };
  const parseArray = () => {
    index += 1;
    skipWhitespace();
    if (source[index] === "]") {
      index += 1;
      return;
    }
    while (index < source.length) {
      parseValue();
      skipWhitespace();
      if (source[index] === "]") {
        index += 1;
        return;
      }
      if (source[index] !== ",") fail();
      index += 1;
    }
    fail(source.length);
  };

  try {
    parseValue();
    skipWhitespace();
    if (index !== source.length) fail();
  } catch (error) {
    if (typeof error?.offset === "number") return error.offset;
    throw error;
  }
  return null;
}

function positionFromOffset(source, offset) {
  const before = source.slice(0, offset);
  const line = before.split("\n").length;
  const lastNewline = before.lastIndexOf("\n");
  return { offset, line, column: offset - lastNewline };
}

export function parseJson(text, { relaxed = false } = {}) {
  const source = String(text);
  let processed;
  try {
    processed = relaxed ? replaceRelaxedSyntax(source) : source;
  } catch (cause) {
    if (!(cause instanceof JsonPreprocessError)) throw cause;
    return {
      ok: false,
      error: {
        message: cause.message,
        ...positionFromOffset(source, cause.offset),
      },
    };
  }
  const depthOffset = findDepthLimitOffset(processed);
  if (depthOffset !== null) {
    return {
      ok: false,
      error: {
        code: "MAX_DEPTH_EXCEEDED",
        message: `JSON 嵌套层级不能超过 ${MAX_JSON_DEPTH}`,
        ...positionFromOffset(source, depthOffset),
      },
    };
  }
  try {
    return { ok: true, value: JSON.parse(processed) };
  } catch (cause) {
    const offset = locateJsonSyntaxError(processed) ?? processed.length;
    return {
      ok: false,
      error: {
        message: cause instanceof Error ? cause.message : "无效 JSON",
        ...positionFromOffset(source, offset),
      },
    };
  }
}

function indentation(value) {
  if (value === "\t" || value === "tab") return "\t";
  return value === 4 || value === "4" ? 4 : 2;
}

function transformJson(text, { relaxed = false, indent = 2, compact = false } = {}) {
  const parsed = parseJson(text, { relaxed });
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    text: JSON.stringify(parsed.value, null, compact ? undefined : indentation(indent)),
    value: parsed.value,
  };
}

export function formatJson(text, options = {}) {
  return transformJson(text, options);
}

export function minifyJson(text, options = {}) {
  return transformJson(text, { ...options, compact: true });
}

function replaceSingleQuotedStrings(source) {
  let output = "";
  const offsetMap = [];
  const append = (text, originalOffset, oneToOne = false) => {
    for (let mappedIndex = 0; mappedIndex < text.length; mappedIndex += 1) {
      output += text[mappedIndex];
      offsetMap.push(oneToOne ? originalOffset + mappedIndex : originalOffset);
    }
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      append(char, index);
      index += 1;
      while (index < source.length) {
        append(source[index], index);
        if (source[index] === "\\" && index + 1 < source.length) {
          index += 1;
          append(source[index], index);
        } else if (source[index] === '"') {
          break;
        }
        index += 1;
      }
      continue;
    }

    if (char === "/" && source[index + 1] === "/") {
      const newline = source.indexOf("\n", index + 2);
      const end = newline === -1 ? source.length : newline;
      append(source.slice(index, end), index, true);
      index = end - 1;
      continue;
    }

    if (char === "/" && source[index + 1] === "*") {
      const end = source.indexOf("*/", index + 2);
      if (end === -1) throw new JsonPreprocessError("块注释缺少结束标记 */", index);
      append(source.slice(index, end + 2), index, true);
      index = end + 1;
      continue;
    }

    if (char !== "'") {
      append(char, index);
      continue;
    }

    const stringStart = index;
    let closed = false;
    append('"', index);
    index += 1;
    while (index < source.length) {
      const current = source[index];
      if (current === "'") {
        append('"', index);
        closed = true;
        break;
      }
      if (current === "\n" || current === "\r" || source.charCodeAt(index) <= 0x1f) {
        throw new JsonPreprocessError("单引号字符串不能包含未转义的控制字符", index);
      }
      if (current === '"') {
        append('\\"', index);
        index += 1;
        continue;
      }
      if (current !== "\\") {
        append(current, index);
        index += 1;
        continue;
      }

      const escaped = source[index + 1];
      if (escaped === "'") {
        append("'", index);
        index += 2;
        continue;
      }
      if (escaped === '"') {
        append('\\"', index, true);
        index += 2;
        continue;
      }
      if (escaped && "\\/bfnrt".includes(escaped)) {
        append(`\\${escaped}`, index, true);
        index += 2;
        continue;
      }
      if (escaped === "u" && /^[0-9a-fA-F]{4}$/.test(source.slice(index + 2, index + 6))) {
        append(source.slice(index, index + 6), index, true);
        index += 6;
        continue;
      }
      throw new JsonPreprocessError("单引号字符串包含不支持的转义", index);
    }
    if (!closed) throw new JsonPreprocessError("单引号字符串缺少结束引号", stringStart);
  }

  offsetMap[output.length] = source.length;
  return { text: output, offsetMap };
}

export function repairJson(text) {
  const source = String(text);
  let conversion;
  try {
    conversion = replaceSingleQuotedStrings(source);
  } catch (cause) {
    if (!(cause instanceof JsonPreprocessError)) throw cause;
    return {
      ok: false,
      error: {
        message: cause.message,
        ...positionFromOffset(source, cause.offset),
      },
    };
  }
  const result = formatJson(conversion.text, { relaxed: true, indent: 2 });
  if (result.ok || typeof result.error.offset !== "number") return result;
  const originalOffset = conversion.offsetMap[result.error.offset] ?? source.length;
  return {
    ...result,
    error: {
      ...result.error,
      ...positionFromOffset(source, originalOffset),
    },
  };
}

export function sortJsonKeys(value) {
  if (value === null || typeof value !== "object") return value;
  const root = Array.isArray(value) ? [] : {};
  const seen = new WeakMap([[value, root]]);
  const stack = [{ source: value, target: root }];
  while (stack.length > 0) {
    const { source, target } = stack.pop();
    const keys = Array.isArray(source) ? Object.keys(source) : Object.keys(source).sort();
    for (const key of keys) {
      const item = source[key];
      if (item === null || typeof item !== "object") {
        Object.defineProperty(target, key, { value: item, enumerable: true, configurable: true, writable: true });
        continue;
      }
      let child = seen.get(item);
      if (!child) {
        child = Array.isArray(item) ? [] : {};
        seen.set(item, child);
        stack.push({ source: item, target: child });
      }
      Object.defineProperty(target, key, { value: child, enumerable: true, configurable: true, writable: true });
    }
  }
  return root;
}

export function jsonStats(value) {
  const stats = { objects: 0, arrays: 0, keys: 0, primitives: 0, depth: 0 };
  const stack = [{ value, depth: 0 }];
  const seen = new WeakSet();
  while (stack.length > 0) {
    const { value: current, depth } = stack.pop();
    stats.depth = Math.max(stats.depth, depth);
    if (Array.isArray(current)) {
      if (seen.has(current)) continue;
      seen.add(current);
      stats.arrays += 1;
      for (let index = current.length - 1; index >= 0; index -= 1) stack.push({ value: current[index], depth: depth + 1 });
    } else if (current !== null && typeof current === "object") {
      if (seen.has(current)) continue;
      seen.add(current);
      stats.objects += 1;
      const keys = Object.keys(current);
      stats.keys += keys.length;
      for (let index = keys.length - 1; index >= 0; index -= 1) stack.push({ value: current[keys[index]], depth: depth + 1 });
    } else {
      stats.primitives += 1;
    }
  }
  return stats;
}

export function escapeUnicode(text) {
  return String(text).replace(/[^\x00-\x7f]/g, (character) => {
    return `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`;
  });
}

export function unescapeUnicode(text) {
  const source = String(text);
  let jsonInput = false;
  try {
    JSON.parse(source);
    jsonInput = true;
  } catch {
    // Plain text is also a supported input; JSON safety only applies to valid JSON input.
  }
  let output = "";
  let index = 0;
  while (index < source.length) {
    if (source[index] !== "\\") {
      output += source[index];
      index += 1;
      continue;
    }

    const runStart = index;
    while (source[index] === "\\") index += 1;
    const slashCount = index - runStart;
    if (source[index] !== "u" || slashCount % 2 === 0) {
      output += "\\".repeat(slashCount);
      continue;
    }

    const escapeOffset = index - 1;
    const hex = source.slice(index + 1, index + 5);
    if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
      return {
        ok: false,
        error: {
          message: "无效的 Unicode 转义，\\u 后必须是 4 位十六进制字符",
          ...positionFromOffset(source, escapeOffset),
        },
      };
    }
    output += "\\".repeat(slashCount - 1);
    const decoded = String.fromCharCode(Number.parseInt(hex, 16));
    if (jsonInput && decoded === '"') output += '\\"';
    else if (jsonInput && decoded === "\\") output += "\\\\";
    else if (jsonInput && decoded.charCodeAt(0) <= 0x1f) output += `\\u${hex}`;
    else output += decoded;
    index += 5;
  }
  return { ok: true, text: output };
}

function jsonPathFailure(code, message, offset = null) {
  return { ok: false, error: { code, message, offset } };
}

function parseJsonPath(path) {
  const raw = String(path);
  const leading = raw.search(/\S/);
  const baseOffset = leading === -1 ? raw.length : leading;
  const source = raw.slice(baseOffset).trimEnd();
  const segments = [];
  const segmentOffsets = [];
  const fail = (code, message, offset = null) => {
    return jsonPathFailure(code, message, offset === null ? null : baseOffset + offset);
  };
  let index = 0;
  if (source[index] === "$") index += 1;
  if (index === source.length) return { ok: true, segments, segmentOffsets };

  while (index < source.length) {
    if (source[index] === ".") {
      index += 1;
      const start = index;
      while (index < source.length && source[index] !== "." && source[index] !== "[") index += 1;
      const key = source.slice(start, index);
      if (!key || /\s/.test(key)) return fail("INVALID_PATH", "点号后需要有效的属性名", start);
      segments.push(key);
      segmentOffsets.push(baseOffset + start);
      continue;
    }

    if (source[index] === "[") {
      const start = index;
      index += 1;
      if (/\d/.test(source[index] ?? "")) {
        const numberStart = index;
        while (/\d/.test(source[index] ?? "")) index += 1;
        if (source[index] !== "]") return fail("INVALID_PATH", "数组下标缺少右方括号", index);
        segments.push(Number.parseInt(source.slice(numberStart, index), 10));
        segmentOffsets.push(baseOffset + numberStart);
        index += 1;
        continue;
      }

      const quote = source[index];
      if (quote !== '"' && quote !== "'") {
        return fail("INVALID_PATH", "方括号内仅支持数字或引号包裹的属性名", index);
      }
      index += 1;
      const keyStart = index;
      let key = "";
      let closed = false;
      while (index < source.length) {
        const character = source[index];
        if (character === quote) {
          closed = true;
          index += 1;
          break;
        }
        if (character === "\\") {
          index += 1;
          if (index >= source.length) break;
          const escaped = source[index];
          if (escaped === "u") {
            const hex = source.slice(index + 1, index + 5);
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
              return fail("INVALID_PATH", "属性名中包含无效的 Unicode 转义", index - 1);
            }
            key += String.fromCharCode(Number.parseInt(hex, 16));
            index += 5;
            continue;
          }
          const simpleEscapes = { b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", "/": "/" };
          if (escaped in simpleEscapes) {
            key += simpleEscapes[escaped];
            index += 1;
            continue;
          }
          if (escaped !== quote && escaped !== "\\") {
            return fail("INVALID_PATH", "属性名中包含不支持的转义", index - 1);
          }
          key += escaped;
          index += 1;
          continue;
        }
        if (character === "\n" || character === "\r") {
          return fail("INVALID_PATH", "属性名不能跨行", index);
        }
        key += character;
        index += 1;
      }
      if (!closed || source[index] !== "]") {
        return fail("INVALID_PATH", "属性访问缺少右方括号", start);
      }
      index += 1;
      segments.push(key);
      segmentOffsets.push(baseOffset + keyStart);
      continue;
    }

    if (index === 0) {
      const start = index;
      while (index < source.length && source[index] !== "." && source[index] !== "[") index += 1;
      const key = source.slice(start, index);
      if (!key || /\s/.test(key)) return fail("INVALID_PATH", "路径格式无效", start);
      segments.push(key);
      segmentOffsets.push(baseOffset + start);
      continue;
    }

    return fail("INVALID_PATH", "路径格式无效", index);
  }
  return { ok: true, segments, segmentOffsets };
}

export function queryJsonPath(value, path) {
  const parsed = parseJsonPath(path);
  if (!parsed.ok) return parsed;

  const unsafe = new Set(["__proto__", "prototype", "constructor"]);
  const unsafeIndex = parsed.segments.findIndex((segment) => unsafe.has(String(segment)));
  if (unsafeIndex !== -1) {
    return jsonPathFailure("UNSAFE_PATH", "该路径包含不安全的属性名", parsed.segmentOffsets[unsafeIndex]);
  }

  let current = value;
  for (let index = 0; index < parsed.segments.length; index += 1) {
    const segment = parsed.segments[index];
    if ((current === null || typeof current !== "object") || !Object.hasOwn(current, segment)) {
      return jsonPathFailure("PATH_NOT_FOUND", `路径不存在：${String(segment)}`, parsed.segmentOffsets[index]);
    }
    current = current[segment];
  }
  return { ok: true, value: current, path: parsed.segments };
}

export function jsonToYaml(value) {
  return stringifyYaml(value, {
    aliasDuplicateObjects: false,
    lineWidth: 0,
  });
}

function yamlFailure(code, message, source, error) {
  const offset = Array.isArray(error?.pos) ? error.pos[0] : null;
  const linePosition = Array.isArray(error?.linePos) ? error.linePos[0] : null;
  return {
    ok: false,
    error: {
      code,
      message,
      offset,
      line: linePosition?.line ?? (offset === null ? null : positionFromOffset(source, offset).line),
      column: linePosition?.col ?? (offset === null ? null : positionFromOffset(source, offset).column),
    },
  };
}

function isJsonCompatible(value, seen = new WeakSet()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.every((item) => isJsonCompatible(item, seen));
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Object.keys(value).every((key) => isJsonCompatible(value[key], seen));
}

export function yamlToJson(text) {
  const source = String(text);
  let documents;
  try {
    documents = parseAllDocuments(source, {
      prettyErrors: false,
      strict: true,
      uniqueKeys: true,
    });
  } catch (error) {
    return yamlFailure("INVALID_YAML", error instanceof Error ? error.message : "无效 YAML", source, error);
  }

  if (documents.length !== 1) {
    return yamlFailure("MULTIPLE_DOCUMENTS", "仅支持单个 YAML 文档", source);
  }
  const [document] = documents;
  if (document.errors.length > 0) {
    const [error] = document.errors;
    return yamlFailure("INVALID_YAML", error.message, source, error);
  }
  if (document.warnings.length > 0) {
    const [warning] = document.warnings;
    return yamlFailure("UNRESOLVED_TAG", warning.message, source, warning);
  }

  let containsAlias = false;
  visit(document, {
    Alias() {
      containsAlias = true;
      return visit.BREAK;
    },
  });
  if (containsAlias) {
    return yamlFailure("ALIASES_DISABLED", "为避免资源滥用，YAML 别名已禁用", source);
  }

  try {
    const yamlValue = document.toJS({ mapAsMap: true, maxAliasCount: 0 });
    const convert = (current, depth = 0) => {
      if (depth > 512) throw new Error("YAML 嵌套层级超过 512");
      if (current instanceof Map) {
        const entries = [];
        for (const [key, item] of current) {
          if (typeof key !== "string") throw new TypeError("YAML map key 必须是字符串");
          entries.push([key, convert(item, depth + 1)]);
        }
        return Object.fromEntries(entries);
      }
      if (Array.isArray(current)) return current.map((item) => convert(item, depth + 1));
      return current;
    };
    let value;
    try {
      value = convert(yamlValue);
    } catch (error) {
      return yamlFailure("UNSUPPORTED_YAML_VALUE", error.message, source, error);
    }
    if (!isJsonCompatible(value)) {
      return yamlFailure("UNSUPPORTED_YAML_VALUE", "YAML 包含 JSON 无法无损表示的值", source);
    }
    return { ok: true, text: JSON.stringify(value, null, 2), value };
  } catch (error) {
    return yamlFailure("INVALID_YAML", error instanceof Error ? error.message : "无效 YAML", source, error);
  }
}

function cloneJsonValue(value) {
  if (value === null || typeof value !== "object") return value;
  const root = Array.isArray(value) ? [] : {};
  const seen = new WeakMap([[value, root]]);
  const stack = [{ source: value, target: root }];
  while (stack.length > 0) {
    const { source, target } = stack.pop();
    for (const key of Object.keys(source)) {
      const item = source[key];
      if (item === null || typeof item !== "object") {
        Object.defineProperty(target, key, { value: item, enumerable: true, configurable: true, writable: true });
        continue;
      }
      let child = seen.get(item);
      if (!child) {
        child = Array.isArray(item) ? [] : {};
        seen.set(item, child);
        stack.push({ source: item, target: child });
      }
      Object.defineProperty(target, key, { value: child, enumerable: true, configurable: true, writable: true });
    }
  }
  return root;
}

function valueKind(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value === "object" ? "object" : "primitive";
}

export function diffJson(left, right) {
  const changes = [];
  const stack = [{ before: left, after: right, path: null }];
  const seenPairs = new WeakMap();
  const pathArray = (path) => {
    const result = [];
    for (let node = path; node; node = node.parent) result.push(node.segment);
    return result.reverse();
  };

  while (stack.length > 0) {
    const task = stack.pop();
    const { before, after, path } = task;
    if (task.type === "added") {
      changes.push({ type: "added", path: pathArray(path), value: cloneJsonValue(after) });
      continue;
    }
    if (task.type === "removed") {
      changes.push({ type: "removed", path: pathArray(path), value: cloneJsonValue(before) });
      continue;
    }
    if (Object.is(before, after)) continue;
    const beforeKind = valueKind(before);
    const afterKind = valueKind(after);
    if (beforeKind !== afterKind || beforeKind === "primitive" || beforeKind === "null") {
      changes.push({
        type: "changed",
        path: pathArray(path),
        before: cloneJsonValue(before),
        after: cloneJsonValue(after),
      });
      continue;
    }

    let paired = seenPairs.get(before);
    if (!paired) {
      paired = new WeakSet();
      seenPairs.set(before, paired);
    } else if (paired.has(after)) continue;
    paired.add(after);

    if (beforeKind === "array") {
      const length = Math.max(before.length, after.length);
      for (let index = length - 1; index >= 0; index -= 1) {
        const childPath = { parent: path, segment: index };
        if (index >= before.length) {
          stack.push({ type: "added", after: after[index], path: childPath });
        } else if (index >= after.length) {
          stack.push({ type: "removed", before: before[index], path: childPath });
        } else {
          stack.push({ before: before[index], after: after[index], path: childPath });
        }
      }
      continue;
    }

    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      const key = keys[index];
      const childPath = { parent: path, segment: key };
      const inBefore = Object.hasOwn(before, key);
      const inAfter = Object.hasOwn(after, key);
      if (!inBefore) {
        stack.push({ type: "added", after: after[key], path: childPath });
      } else if (!inAfter) {
        stack.push({ type: "removed", before: before[key], path: childPath });
      } else {
        stack.push({ before: before[key], after: after[key], path: childPath });
      }
    }
  }

  return { equal: changes.length === 0, changes };
}
