import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SELF_BUILT_TOOLS = Object.freeze([
  "base64", "color", "cron", "diff", "json",
  "jwt", "regex", "sql-formatter", "timestamp", "uuid",
]);

function topLevelToolObjects(source) {
  const declaration = source.indexOf("const TOOLS_DATA = [");
  if (declaration === -1) return [];

  const start = source.indexOf("[", declaration);
  const objects = [];
  let arrayDepth = 1;
  let objectDepth = 0;
  let objectStart = -1;
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = start + 1; index < source.length && arrayDepth; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "[") arrayDepth += 1;
    else if (char === "]") arrayDepth -= 1;
    else if (char === "{") {
      if (arrayDepth === 1 && objectDepth === 0) objectStart = index;
      objectDepth += 1;
    } else if (char === "}") {
      objectDepth -= 1;
      if (arrayDepth === 1 && objectDepth === 0 && objectStart !== -1) {
        objects.push(source.slice(objectStart, index + 1));
        objectStart = -1;
      }
    }
  }

  return objects;
}

function literal(object, field) {
  return object.match(new RegExp(`^ {4}${field}: ["']([^"']+)["'],?`, "m"))?.[1];
}

function readmeCount(readme, name) {
  const value = readme.match(new RegExp(`<!-- catalog-${name}: (\\d+) -->`))?.[1];
  return value === undefined ? undefined : Number(value);
}

export function auditTools(root) {
  const source = fs.readFileSync(path.join(root, "data", "tools.js"), "utf8");
  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
  const tools = topLevelToolObjects(source).map((object) => ({
    id: literal(object, "id"),
    category: literal(object, "category"),
    url: literal(object, "url"),
  }));
  const seen = new Set();
  const duplicateIds = [];
  const categoryCounts = {};

  for (const tool of tools) {
    categoryCounts[tool.category] = (categoryCounts[tool.category] ?? 0) + 1;
    if (seen.has(tool.id) && !duplicateIds.includes(tool.id)) duplicateIds.push(tool.id);
    seen.add(tool.id);
  }

  const missingCanonical = SELF_BUILT_TOOLS.filter((slug) =>
    !fs.existsSync(path.join(root, "tools", slug, "index.html")),
  );
  const canonicalPaths = SELF_BUILT_TOOLS.map((slug) => `/tools/${slug}/`);

  return {
    total: tools.length,
    selfBuilt: [...SELF_BUILT_TOOLS],
    categoryCounts,
    duplicateIds,
    missingCanonical,
    readmeCounts: {
      total: readmeCount(readme, "total"),
      selfBuilt: readmeCount(readme, "self-built"),
      onlineTools: readmeCount(readme, "online-tools"),
    },
    readmeUsesCanonicalToolsPath: canonicalPaths.every((toolPath) => readme.includes(`\`${toolPath}\``)),
  };
}

function invariantsHold(result) {
  return result.total === 73
    && result.selfBuilt.length === 10
    && result.categoryCounts["online-tools"] === 11
    && result.duplicateIds.length === 0
    && result.missingCanonical.length === 0
    && result.readmeCounts.total === 73
    && result.readmeCounts.selfBuilt === 10
    && result.readmeCounts.onlineTools === 11
    && result.readmeUsesCanonicalToolsPath;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = auditTools(process.cwd());
  console.log(JSON.stringify(result, null, 2));
  if (!invariantsHold(result)) process.exitCode = 1;
}
