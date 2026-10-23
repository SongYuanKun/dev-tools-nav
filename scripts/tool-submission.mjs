#!/usr/bin/env node
/**
 * 将「工具目录投稿」Issue 安全地转换为 data/tools.js 条目补丁。
 * 不执行 Issue 正文中的任何代码；所有字段先做白名单校验再写入字面量。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = join(MODULE_DIR, "..");

export const ALLOWED_CATEGORIES = Object.freeze([
  "ai", "dev", "hosting", "security", "ops", "design",
]);

const FIELD_ALIASES = {
  tool_id: ["工具 ID（英文短横线）", "工具 ID", "tool_id"],
  tool_name: ["工具显示名称", "tool_name"],
  category: ["分类", "category"],
  description: ["一句话简介", "description"],
  url: ["官网 URL", "url"],
  tags: ["标签（逗号分隔）", "标签", "tags"],
  icon: ["图标 URL（可选）", "图标 URL", "icon"],
  featured: ["是否建议精选", "featured"],
  notes: ["补充说明（可选）", "补充说明", "notes"],
};

export function parseIssueForm(body) {
  const text = String(body || "").replace(/\r\n/g, "\n");
  const fields = {};
  const parts = text.split(/^###\s+/m).slice(1);
  for (const part of parts) {
    const nl = part.indexOf("\n");
    const label = (nl === -1 ? part : part.slice(0, nl)).trim();
    let value = (nl === -1 ? "" : part.slice(nl + 1)).trim();
    // GitHub 未填字段常为 _No response_
    if (/^_No response_$/i.test(value)) value = "";
    fields[label] = value;
  }

  const pick = (key) => {
    for (const alias of FIELD_ALIASES[key] || []) {
      if (Object.prototype.hasOwnProperty.call(fields, alias)) return fields[alias];
    }
    return "";
  };

  return {
    tool_id: pick("tool_id"),
    tool_name: pick("tool_name"),
    category: pick("category"),
    description: pick("description"),
    url: pick("url"),
    tags: pick("tags"),
    icon: pick("icon"),
    featured: pick("featured"),
    notes: pick("notes"),
    _rawLabels: Object.keys(fields),
  };
}

export function sanitizePlainText(value, { max = 200 } = {}) {
  let text = String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/[`$\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length > max) text = text.slice(0, max).trim();
  return text;
}

export function validateToolId(raw) {
  const id = sanitizePlainText(raw, { max: 64 }).toLowerCase();
  if (!/^[a-z][a-z0-9-]{1,62}$/.test(id)) {
    throw new Error("工具 ID 须为 2–63 位，以小写字母开头，仅含小写字母/数字/短横线");
  }
  if (id.startsWith("online-")) {
    throw new Error("外链投稿请勿使用 online- 前缀（保留给站内自研工具）");
  }
  return id;
}

export function validateHttpsUrl(raw, { allowEmpty = false, field = "URL" } = {}) {
  const value = sanitizePlainText(raw, { max: 500 });
  if (!value) {
    if (allowEmpty) return "";
    throw new Error(`${field} 不能为空`);
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${field} 不是合法 URL`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`${field} 必须使用 https://`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${field} 不得包含用户名或密码`);
  }
  const host = parsed.hostname.toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".local")) {
    throw new Error(`${field} 主机名无效`);
  }
  // 拒绝明显的脚本/数据协议残留
  if (/^(javascript|data|vbscript):/i.test(value)) {
    throw new Error(`${field} 协议不被允许`);
  }
  return parsed.toString();
}

export function validateTags(raw) {
  const parts = sanitizePlainText(raw, { max: 200 })
    .split(/[,，]/)
    .map((part) => sanitizePlainText(part, { max: 20 }))
    .filter(Boolean);
  if (!parts.length) throw new Error("至少需要 1 个标签");
  if (parts.length > 5) throw new Error("标签最多 5 个");
  return parts;
}

export function validateCategory(raw) {
  const category = sanitizePlainText(raw, { max: 32 }).toLowerCase();
  if (!ALLOWED_CATEGORIES.includes(category)) {
    throw new Error(`分类必须是：${ALLOWED_CATEGORIES.join(", ")}`);
  }
  return category;
}

function jsString(value) {
  // 仅输出 JSON 字符串字面量，杜绝换行/引号注入
  return JSON.stringify(String(value));
}

export function buildToolEntry(fields) {
  const id = validateToolId(fields.tool_id);
  const name = sanitizePlainText(fields.tool_name, { max: 80 });
  if (!name) throw new Error("工具显示名称不能为空");
  const category = validateCategory(fields.category);
  const description = sanitizePlainText(fields.description, { max: 160 });
  if (description.length < 8) throw new Error("简介至少 8 个字符");
  const url = validateHttpsUrl(fields.url, { field: "官网 URL" });
  const tags = validateTags(fields.tags);
  let icon = validateHttpsUrl(fields.icon, { allowEmpty: true, field: "图标 URL" });
  if (!icon) {
    const host = new URL(url).hostname;
    icon = `https://icon.horse/icon/${host}`;
  }
  const featured = sanitizePlainText(fields.featured, { max: 8 }) === "是";

  const tagLiterals = tags.map((tag) => jsString(tag)).join(", ");
  return {
    id,
    category,
    entry:
      `  {\n` +
      `    id: ${jsString(id)},\n` +
      `    name: ${jsString(name)},\n` +
      `    description: ${jsString(description)},\n` +
      `    category: ${jsString(category)},\n` +
      `    tags: [${tagLiterals}],\n` +
      `    url: ${jsString(url)},\n` +
      `    icon: ${jsString(icon)},\n` +
      `    featured: ${featured ? "true" : "false"},\n` +
      `    content: null,\n` +
      `  },\n`,
  };
}

export function assertIdAvailable(source, id) {
  const re = new RegExp(`^\\s*id:\\s*["']${id}["']`, "m");
  if (re.test(source)) {
    throw new Error(`工具 ID 已存在：${id}`);
  }
}

export function insertToolEntry(source, entry) {
  // 插入到「在线工具」分节之前；若不存在则插入到 TOOLS_DATA 数组末尾 `];` 前
  const onlineMarker = "  // ==================== 🧰 在线工具（自研，站内页面） ====================";
  const markerIndex = source.indexOf(onlineMarker);
  if (markerIndex !== -1) {
    return source.slice(0, markerIndex) + entry + "\n" + source.slice(markerIndex);
  }
  const end = source.lastIndexOf("\n];");
  if (end === -1) throw new Error("无法定位 TOOLS_DATA 结束位置");
  return source.slice(0, end + 1) + entry + source.slice(end + 1);
}

export function bumpCatalogTotal(readme, delta = 1) {
  return String(readme).replace(
    /<!--\s*catalog-total:\s*(\d+)\s*-->/,
    (_, n) => `<!-- catalog-total: ${Number(n) + delta} -->`,
  );
}

export function bumpReadmeOpeningCount(readme, delta = 1) {
  return String(readme).replace(
    /目录收录\s*(\d+)\s*条/,
    (_, n) => `目录收录 ${Number(n) + delta} 条`,
  );
}

export function applySubmission({ body, toolsSource, readmeSource }) {
  const fields = parseIssueForm(body);
  const built = buildToolEntry(fields);
  assertIdAvailable(toolsSource, built.id);
  const nextTools = insertToolEntry(toolsSource, built.entry);
  let nextReadme = readmeSource;
  if (typeof readmeSource === "string" && readmeSource) {
    nextReadme = bumpReadmeOpeningCount(bumpCatalogTotal(readmeSource, 1), 1);
  }
  return {
    id: built.id,
    category: built.category,
    entry: built.entry,
    toolsSource: nextTools,
    readmeSource: nextReadme,
    fields,
  };
}

function main(argv = process.argv.slice(2)) {
  const args = Object.fromEntries(
    argv.filter((a) => a.startsWith("--")).map((a) => {
      const [k, ...rest] = a.replace(/^--/, "").split("=");
      return [k, rest.join("=") || "true"];
    }),
  );
  const root = args.root || DEFAULT_ROOT;
  const body = args.bodyFile
    ? readFileSync(args.bodyFile, "utf8")
    : (process.env.ISSUE_BODY || "");
  const toolsPath = join(root, "data", "tools.js");
  const readmePath = join(root, "README.md");
  const toolsSource = readFileSync(toolsPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const result = applySubmission({ body, toolsSource, readmeSource });
  if (args.write === "true") {
    writeFileSync(toolsPath, result.toolsSource);
    if (result.readmeSource && result.readmeSource !== readmeSource) {
      writeFileSync(readmePath, result.readmeSource);
    }
  }
  process.stdout.write(JSON.stringify({
    ok: true,
    id: result.id,
    category: result.category,
    name: sanitizePlainText(result.fields.tool_name, { max: 80 }),
  }) + "\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(String(error && error.message ? error.message : error) + "\n");
    process.exitCode = 1;
  }
}
