import {
  isMap,
  isScalar,
  isSeq,
  parseAllDocuments,
  stringify as stringifyYaml,
  visit,
} from "yaml";

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
    while (/[ \t\r\n]/.test(chars[next] ?? "")) next += 1;
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
    while (/[ \t\r\n]/.test(source[index] ?? "")) index += 1;
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

const JSON_NUMBER_TAG = Symbol.for("dev-tools-nav.jsonNumber");

/** 保留 JSON 数字词素；仅在 Number 无法无损表示时使用。 */
export class JsonNumber {
  constructor(raw, { reason = "unsafe-integer" } = {}) {
    this.raw = String(raw);
    this.reason = reason;
    Object.defineProperty(this, JSON_NUMBER_TAG, { value: true });
  }

  toString() {
    return this.raw;
  }

  valueOf() {
    return Number(this.raw);
  }

  toJSON() {
    // JSON.stringify 无法保真；业务路径必须走 stringifyJson。
    return Number(this.raw);
  }
}

export function isJsonNumber(value) {
  return Boolean(value) && typeof value === "object" && value[JSON_NUMBER_TAG] === true;
}

export function formatJsonPrimitive(value) {
  if (isJsonNumber(value)) return value.raw;
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (typeof value === "boolean" || value === null) return String(value);
  return String(value);
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || isJsonNumber(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isContainer(value) {
  return Array.isArray(value) || isPlainObject(value);
}

// 按十进制有效数字和指数比较，不经过二进制浮点舍入。
function decimalKey(raw) {
  const sign = raw.startsWith("-") ? "-" : "";
  const [mantissa, exponent = "0"] = raw.slice(sign.length).toLowerCase().split("e");
  const [whole, fraction = ""] = mantissa.split(".");
  const digits = (whole + fraction).replace(/^0+/, "");
  if (!digits) return sign + "0";
  let end = digits.length;
  while (digits[end - 1] === "0") end -= 1;
  const scale = BigInt(exponent) + BigInt(digits.length - end - fraction.length);
  return sign + digits.slice(0, end) + "e" + scale;
}

function numberNeedsLexeme(raw) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return { preserve: true, reason: "non-finite" };
  if (value === 0) {
    const mantissa = raw.split(/[eE]/, 1)[0];
    if (/[1-9]/.test(mantissa)) return { preserve: true, reason: "float-precision" };
    if (Object.is(value, -0)) return { preserve: true, reason: "negative-zero" };
    return { preserve: false, value };
  }
  if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
    return { preserve: true, reason: "unsafe-integer" };
  }
  const output = String(value);
  if (raw !== output && decimalKey(raw) !== decimalKey(output)) {
    return { preserve: true, reason: "float-precision" };
  }
  return { preserve: false, value };
}

function decodeJsonStringBody(body, startOffset, fail) {
  let output = "";
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (char !== "\\") {
      if (body.charCodeAt(index) <= 0x1f) fail(startOffset + index);
      output += char;
      continue;
    }
    const escaped = body[index + 1];
    if (escaped === undefined) fail(startOffset + index);
    if ('"\\/bfnrt'.includes(escaped)) {
      const map = {
        '"': '"',
        "\\": "\\",
        "/": "/",
        b: "\b",
        f: "\f",
        n: "\n",
        r: "\r",
        t: "\t",
      };
      output += map[escaped];
      index += 1;
      continue;
    }
    if (escaped === "u") {
      const hex = body.slice(index + 2, index + 6);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail(startOffset + index);
      output += String.fromCharCode(Number.parseInt(hex, 16));
      index += 5;
      continue;
    }
    fail(startOffset + index);
  }
  return output;
}

function parseJsonDocument(source) {
  let index = 0;
  let preservedNumbers = 0;
  const fail = (offset = index, message = "无效 JSON") => {
    const error = new Error(message);
    error.offset = offset;
    throw error;
  };
  const skipWhitespace = () => {
    while (/[ \t\r\n]/.test(source[index] ?? "")) index += 1;
  };
  const parseString = () => {
    if (source[index] !== '"') fail();
    const start = index;
    index += 1;
    let end = index;
    while (end < source.length) {
      if (source[end] === '"') break;
      if (source[end] === "\\") {
        end += 2;
        continue;
      }
      if (source.charCodeAt(end) <= 0x1f) fail(end);
      end += 1;
    }
    if (end >= source.length) fail(source.length, "字符串缺少结束引号");
    const body = source.slice(index, end);
    const value = decodeJsonStringBody(body, index, fail);
    index = end + 1;
    return value;
  };
  const parseNumberToken = () => {
    const match = source.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (!match) fail();
    const raw = match[0];
    index += raw.length;
    const decision = numberNeedsLexeme(raw);
    if (decision.preserve) {
      preservedNumbers += 1;
      return new JsonNumber(raw, { reason: decision.reason });
    }
    return decision.value;
  };
  const parseLiteral = (literal, value) => {
    for (let literalIndex = 0; literalIndex < literal.length; literalIndex += 1) {
      if (source[index + literalIndex] !== literal[literalIndex]) fail(index + literalIndex);
    }
    index += literal.length;
    return value;
  };
  const parseValue = (depth) => {
    if (depth > MAX_JSON_DEPTH) {
      fail(index, `JSON 嵌套层级不能超过 ${MAX_JSON_DEPTH}`);
    }
    skipWhitespace();
    const char = source[index];
    if (char === '"') return parseString();
    if (char === "{") return parseObject(depth);
    if (char === "[") return parseArray(depth);
    if (char === "-" || /\d/.test(char ?? "")) return parseNumberToken();
    if (char === "t") return parseLiteral("true", true);
    if (char === "f") return parseLiteral("false", false);
    if (char === "n") return parseLiteral("null", null);
    fail();
  };
  const parseObject = (depth) => {
    index += 1;
    skipWhitespace();
    const object = {};
    if (source[index] === "}") {
      index += 1;
      return object;
    }
    while (index < source.length) {
      skipWhitespace();
      const key = parseString();
      skipWhitespace();
      if (source[index] !== ":") fail();
      index += 1;
      const value = parseValue(depth + 1);
      Object.defineProperty(object, key, {
        value,
        enumerable: true,
        configurable: true,
        writable: true,
      });
      skipWhitespace();
      if (source[index] === "}") {
        index += 1;
        return object;
      }
      if (source[index] !== ",") fail();
      index += 1;
    }
    fail(source.length);
  };
  const parseArray = (depth) => {
    index += 1;
    skipWhitespace();
    const array = [];
    if (source[index] === "]") {
      index += 1;
      return array;
    }
    while (index < source.length) {
      array.push(parseValue(depth + 1));
      skipWhitespace();
      if (source[index] === "]") {
        index += 1;
        return array;
      }
      if (source[index] !== ",") fail();
      index += 1;
    }
    fail(source.length);
  };

  const value = parseValue(0);
  skipWhitespace();
  if (index !== source.length) fail(index, "JSON 末尾存在多余内容");
  return { value, preservedNumbers };
}

export function stringifyJson(value, { indent = 2, compact = false } = {}) {
  const spacer = compact ? null : indentation(indent);
  const colon = spacer === null ? ":" : ": ";
  const seen = new WeakSet();

  const write = (current, depth) => {
    if (isJsonNumber(current)) return current.raw;
    if (current === null) return "null";
    if (typeof current === "boolean") return current ? "true" : "false";
    if (typeof current === "number") {
      if (!Number.isFinite(current)) {
        throw new TypeError("无法序列化非有限数字；请改用保留词素的 JsonNumber");
      }
      return Object.is(current, -0) ? "-0" : String(current);
    }
    if (typeof current === "string") return JSON.stringify(current);
    if (typeof current !== "object") {
      throw new TypeError(`无法序列化类型 ${typeof current}`);
    }
    if (seen.has(current)) throw new TypeError("无法序列化循环引用");
    seen.add(current);
    try {
      if (Array.isArray(current)) {
        if (current.length === 0) return "[]";
        if (spacer === null) {
          return `[${current.map((item) => write(item, depth + 1)).join(",")}]`;
        }
        const pad = spacer === "\t" ? "\t".repeat(depth + 1) : " ".repeat(spacer * (depth + 1));
        const close = spacer === "\t" ? "\t".repeat(depth) : " ".repeat(spacer * depth);
        const rows = current.map((item) => `${pad}${write(item, depth + 1)}`);
        return `[\n${rows.join(",\n")}\n${close}]`;
      }
      if (!isPlainObject(current)) {
        throw new TypeError("只能序列化普通对象、数组与 JSON 原始值");
      }
      const keys = Object.keys(current);
      if (keys.length === 0) return "{}";
      if (spacer === null) {
        return `{${keys.map((key) => `${JSON.stringify(key)}:${write(current[key], depth + 1)}`).join(",")}}`;
      }
      const pad = spacer === "\t" ? "\t".repeat(depth + 1) : " ".repeat(spacer * (depth + 1));
      const close = spacer === "\t" ? "\t".repeat(depth) : " ".repeat(spacer * depth);
      const rows = keys.map((key) => `${pad}${JSON.stringify(key)}${colon}${write(current[key], depth + 1)}`);
      return `{\n${rows.join(",\n")}\n${close}}`;
    } finally {
      seen.delete(current);
    }
  };

  return write(value, 0);
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
    const parsed = parseJsonDocument(processed);
    const result = { ok: true, value: parsed.value };
    if (parsed.preservedNumbers > 0) result.preservedNumbers = parsed.preservedNumbers;
    return result;
  } catch (cause) {
    const offset = typeof cause?.offset === "number"
      ? cause.offset
      : (locateJsonSyntaxError(processed) ?? processed.length);
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
  try {
    const result = {
      ok: true,
      text: stringifyJson(parsed.value, { indent, compact }),
      value: parsed.value,
    };
    if ((parsed.preservedNumbers ?? 0) > 0) result.preservedNumbers = parsed.preservedNumbers;
    return result;
  } catch (cause) {
    return {
      ok: false,
      error: {
        message: cause instanceof Error ? cause.message : "无法序列化 JSON",
        offset: 0,
        line: 1,
        column: 1,
      },
    };
  }
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
  if (value === null || typeof value !== "object" || isJsonNumber(value)) return value;
  const root = Array.isArray(value) ? [] : {};
  const seen = new WeakMap([[value, root]]);
  const stack = [{ source: value, target: root }];
  while (stack.length > 0) {
    const { source, target } = stack.pop();
    const keys = Array.isArray(source) ? Object.keys(source) : Object.keys(source).sort();
    for (const key of keys) {
      const item = source[key];
      if (item === null || typeof item !== "object" || isJsonNumber(item)) {
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
    } else if (current !== null && typeof current === "object" && !isJsonNumber(current)) {
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
    if (
      isJsonNumber(current)
      || current === null
      || typeof current !== "object"
      || !Object.hasOwn(current, segment)
    ) {
      return jsonPathFailure("PATH_NOT_FOUND", `路径不存在：${String(segment)}`, parsed.segmentOffsets[index]);
    }
    current = current[segment];
  }
  return { ok: true, value: current, path: parsed.segments };
}

function yamlCompatibleValue(value, seen = new WeakSet()) {
  if (isJsonNumber(value)) {
    const decision = numberNeedsLexeme(value.raw);
    if (decision.preserve) {
      const error = new Error("YAML 导出无法保留该数字的精度或符号");
      error.code = "YAML_NUMBER_LOSSY";
      error.raw = value.raw;
      throw error;
    }
    return decision.value;
  }
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
    return value;
  }
  if (typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => yamlCompatibleValue(item, seen));
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, yamlCompatibleValue(item, seen)]));
}

export function jsonToYaml(value) {
  try {
    return {
      ok: true,
      text: stringifyYaml(yamlCompatibleValue(value), {
        aliasDuplicateObjects: false,
        lineWidth: 0,
      }),
    };
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: cause?.code || "YAML_CONVERT_FAILED",
        message: cause instanceof Error ? cause.message : "无法转换为 YAML",
        raw: cause?.raw,
      },
    };
  }
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
  if (isJsonNumber(value)) return true;
  if (typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.every((item) => isJsonCompatible(item, seen));
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Object.keys(value).every((key) => isJsonCompatible(value[key], seen));
}

function yamlScalarToJsonValue(node) {
  if (typeof node.value !== "number") return node.value;
  const raw = node.source;
  let jsonNumber;
  if (/^0(?:x[\da-f]+|o[0-7]+)$/i.test(raw)) {
    jsonNumber = BigInt(raw).toString();
  } else {
    // YAML 允许前导加号、前导零和省略整数或小数部分。
    const match = /^([-+]?)(\d*)(?:\.(\d*))?([eE][-+]?\d+)?$/.exec(raw);
    if (!match || !(match[2] || match[3])) {
      throw new TypeError(`无法将 YAML 数值转换为 JSON：${raw}`);
    }
    const whole = match[2].replace(/^0+/, "") || "0";
    jsonNumber = (match[1] === "-" ? "-" : "") + whole
      + (match[3] ? "." + match[3] : "") + (match[4] || "");
  }
  const decision = numberNeedsLexeme(jsonNumber);
  return decision.preserve ? new JsonNumber(jsonNumber, { reason: decision.reason }) : decision.value;
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
    const convertNode = (node, depth = 0) => {
      if (depth > 512) throw new Error("YAML 嵌套层级超过 512");
      if (node == null) return null;
      if (isScalar(node)) return yamlScalarToJsonValue(node);
      if (isSeq(node)) {
        if (node.tag && node.tag !== "tag:yaml.org,2002:seq") {
          throw new TypeError(`不支持的 YAML 序列标签：${node.tag}`);
        }
        return node.items.map((item) => convertNode(item, depth + 1));
      }
      if (isMap(node)) {
        const tag = typeof node.tag === "string" ? node.tag : "";
        if (tag && tag !== "tag:yaml.org,2002:map") {
          throw new TypeError(`不支持的 YAML 映射标签：${tag}`);
        }
        if (node.constructor?.name === "YAMLSet") {
          throw new TypeError("YAML set 无法无损转换为 JSON");
        }
        return Object.fromEntries(node.items.map((item) => {
          const key = convertNode(item.key, depth + 1);
          if (typeof key !== "string") throw new TypeError("YAML map key 必须是字符串");
          return [key, convertNode(item.value, depth + 1)];
        }));
      }
      if (typeof node !== "object") return node;
      if (node instanceof Set) {
        throw new TypeError("YAML set 无法无损转换为 JSON");
      }
      if (node instanceof Map) {
        const entries = [];
        for (const [key, item] of node) {
          if (typeof key !== "string") throw new TypeError("YAML map key 必须是字符串");
          entries.push([key, convertNode(item, depth + 1)]);
        }
        return Object.fromEntries(entries);
      }
      if (Array.isArray(node)) return node.map((item) => convertNode(item, depth + 1));
      return node;
    };
    let value;
    try {
      value = convertNode(document.contents);
    } catch (error) {
      return yamlFailure("UNSUPPORTED_YAML_VALUE", error.message, source, error);
    }
    if (!isJsonCompatible(value)) {
      return yamlFailure("UNSUPPORTED_YAML_VALUE", "YAML 包含 JSON 无法无损表示的值", source);
    }
    return { ok: true, text: stringifyJson(value, { indent: 2 }), value };
  } catch (error) {
    return yamlFailure("INVALID_YAML", error instanceof Error ? error.message : "无效 YAML", source, error);
  }
}

function cloneJsonValue(value) {
  if (value === null || typeof value !== "object" || isJsonNumber(value)) return value;
  const root = Array.isArray(value) ? [] : {};
  const seen = new WeakMap([[value, root]]);
  const stack = [{ source: value, target: root }];
  while (stack.length > 0) {
    const { source, target } = stack.pop();
    for (const key of Object.keys(source)) {
      const item = source[key];
      if (item === null || typeof item !== "object" || isJsonNumber(item)) {
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
  if (isJsonNumber(value)) return "primitive";
  return typeof value === "object" ? "object" : "primitive";
}

function jsonValuesEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (isJsonNumber(left) || isJsonNumber(right)) {
    if (!(isJsonNumber(left) || typeof left === "number")
      || !(isJsonNumber(right) || typeof right === "number")) return false;
    const leftRaw = isJsonNumber(left) ? left.raw : String(left);
    const rightRaw = isJsonNumber(right) ? right.raw : String(right);
    return leftRaw === rightRaw || decimalKey(leftRaw) === decimalKey(rightRaw);
  }
  return false;
}

export function diffJson(left, right, { includeValues = true, maxChanges = Infinity, maxWork = Infinity } = {}) {
  const changes = [];
  const stack = [{ before: left, after: right, path: null }];
  const seenPairs = new WeakMap();
  let truncated = false;
  let work = 0;
  const pathArray = (path) => {
    const result = [];
    for (let node = path; node; node = node.parent) result.push(node.segment);
    return result.reverse();
  };

  while (stack.length > 0) {
    if (work >= maxWork) {
      truncated = true;
      break;
    }
    work += 1;
    const task = stack.pop();
    const { before, after, path } = task;
    if (task.type === "added") {
      changes.push({ type: "added", path: pathArray(path), ...(includeValues ? { value: cloneJsonValue(after) } : {}) });
      if (changes.length >= maxChanges) { truncated = truncated || stack.length > 0; break; }
      continue;
    }
    if (task.type === "removed") {
      changes.push({ type: "removed", path: pathArray(path), ...(includeValues ? { value: cloneJsonValue(before) } : {}) });
      if (changes.length >= maxChanges) { truncated = truncated || stack.length > 0; break; }
      continue;
    }
    if (jsonValuesEqual(before, after)) continue;
    const beforeKind = valueKind(before);
    const afterKind = valueKind(after);
    if (beforeKind !== afterKind || beforeKind === "primitive" || beforeKind === "null") {
      changes.push({
        type: "changed",
        path: pathArray(path),
        ...(includeValues ? { before: cloneJsonValue(before), after: cloneJsonValue(after) } : {}),
      });
      if (changes.length >= maxChanges) { truncated = truncated || stack.length > 0; break; }
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
      const scheduled = Math.min(length, Math.max(0, maxWork - work - stack.length));
      if (scheduled < length) truncated = true;
      for (let index = scheduled - 1; index >= 0; index -= 1) {
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
    const scheduled = Math.min(keys.length, Math.max(0, maxWork - work - stack.length));
    if (scheduled < keys.length) truncated = true;
    for (let index = scheduled - 1; index >= 0; index -= 1) {
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

  return { equal: !truncated && changes.length === 0, changes, ...(truncated ? { truncated: true } : {}) };
}

export function formatJsonPath(path) {
  if (!Array.isArray(path) || path.length === 0) return "$";
  return path.reduce((acc, segment) => {
    if (typeof segment === "number") return `${acc}[${segment}]`;
    const key = String(segment);
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return `${acc}.${key}`;
    return `${acc}[${JSON.stringify(key)}]`;
  }, "$");
}

export function summarizeDiffChanges(changes, { limit = 40 } = {}) {
  const list = Array.isArray(changes) ? changes : [];
  const counts = { added: 0, removed: 0, changed: 0 };
  for (const change of list) {
    if (change?.type && Object.prototype.hasOwnProperty.call(counts, change.type)) {
      counts[change.type] += 1;
    }
  }
  const rows = list.slice(0, Math.max(0, limit)).map((change) => ({
    type: change.type,
    path: formatJsonPath(change.path),
  }));
  return {
    counts,
    rows,
    truncated: list.length > rows.length,
    text: rows
      .map((row) => `${row.type === "added" ? "+" : row.type === "removed" ? "-" : "~"} ${row.path}`)
      .join("\n"),
  };
}

export function assessJsonPayloadSize(text) {
  const source = String(text ?? "");
  const size = new TextEncoder().encode(source).byteLength;
  return {
    bytes: size,
    chars: source.length,
    warn: size >= 256 * 1024,
    heavy: size >= 1024 * 1024,
    skipAutoLint: size > 1024 * 1024,
  };
}

export function buildHttpSnippets(bodyText, {
  url = "https://api.example.com/endpoint",
  method = "POST",
  contentType = "application/json",
} = {}) {
  const body = String(bodyText ?? "");
  const safeMethod = String(method || "POST").toUpperCase();
  const curlBody = body.replace(/'/g, `'\\''`);
  const curl = [
    `curl -sS -X ${safeMethod} '${url}'`,
    `  -H 'Content-Type: ${contentType}'`,
    `  -d '${curlBody}'`,
  ].join(" \\\n");
  const fetchSnippet = [
    `await fetch(${JSON.stringify(url)}, {`,
    `  method: ${JSON.stringify(safeMethod)},`,
    `  headers: { "Content-Type": ${JSON.stringify(contentType)} },`,
    `  body: ${JSON.stringify(body)}`,
    `});`,
  ].join("\n");
  return { curl, fetch: fetchSnippet, method: safeMethod, url, contentType };
}
