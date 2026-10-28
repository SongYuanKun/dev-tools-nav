#!/usr/bin/env node
/**
 * Stamp local CSS/JS URLs (and SW cache identity) with a deploy-time asset version.
 *
 * Source HTML / sw.js use the literal placeholder __ASSET_VERSION__.
 * Publish paths (GitHub Pages _site, 1Panel STAGE) replace it with git short SHA
 * or ASSET_VERSION from the environment — so HTTP caches and SW shells refresh
 * without requiring a hard refresh.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ASSET_VERSION_PLACEHOLDER = "__ASSET_VERSION__";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = join(MODULE_DIR, "..");

const SKIP_DIRS = new Set([
  ".git",
  ".github",
  "node_modules",
  "docs",
  "content",
  "scripts",
  "ops",
  "tasks",
  ".cursor",
]);

/**
 * @param {{ cwd?: string, env?: NodeJS.ProcessEnv }} [options]
 * @returns {string}
 */
export function resolveAssetVersion(options = {}) {
  const env = options.env || process.env;
  const fromEnv = String(env.ASSET_VERSION || env.GITHUB_SHA || "").trim();
  if (fromEnv) {
    return fromEnv.length > 12 ? fromEnv.slice(0, 12) : fromEnv;
  }
  const cwd = options.cwd || DEFAULT_ROOT;
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return `dev-${Date.now().toString(36)}`;
  }
}

/**
 * Rewrite a single asset URL so it carries ?v=<version> (replacing any prior v=).
 * Leaves absolute / protocol-relative / data URLs untouched when called via shouldVersionUrl.
 * @param {string} url
 * @param {string} version
 */
export function withAssetVersion(url, version) {
  const hashIdx = url.indexOf("#");
  const hash = hashIdx >= 0 ? url.slice(hashIdx) : "";
  const withoutHash = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
  const qIdx = withoutHash.indexOf("?");
  const path = qIdx >= 0 ? withoutHash.slice(0, qIdx) : withoutHash;
  const params = new URLSearchParams(qIdx >= 0 ? withoutHash.slice(qIdx + 1) : "");
  params.set("v", version);
  const query = params.toString();
  return `${path}?${query}${hash}`;
}

/**
 * @param {string} url
 * @returns {boolean}
 */
export function shouldVersionUrl(url) {
  if (!url) return false;
  const trimmed = url.trim();
  if (
    /^(https?:|\/\/|data:|blob:|mailto:|javascript:)/i.test(trimmed)
    || trimmed.startsWith("#")
  ) {
    return false;
  }
  const path = trimmed.split(/[?#]/, 1)[0];
  return /\.(css|js)$/i.test(path);
}

/**
 * Ensure href/src local .css/.js references carry ?v=<version>.
 * Idempotent: re-stamping updates the v= value.
 * @param {string} text
 * @param {string} version
 */
export function stampMarkupAssetUrls(text, version) {
  return text.replace(
    /\b(href|src)=(["'])([^"']*)\2/gi,
    (match, attr, quote, rawUrl) => {
      if (!shouldVersionUrl(rawUrl)) return match;
      return `${attr}=${quote}${withAssetVersion(rawUrl, version)}${quote}`;
    },
  );
}

/**
 * Stamp sw.js cache version + precached css/js entries.
 * @param {string} text
 * @param {string} version
 */
export function stampServiceWorker(text, version) {
  let out = text.replace(
    /const\s+VERSION\s*=\s*["'][^"']*["']/,
    `const VERSION = "pwa-${version}"`,
  );
  out = out.replace(
    /(["'])(\.\/(?:css|js|data)\/[^"'?#]+?\.(?:css|js))(?:\?[^"']*)?\1/g,
    (_m, quote, path) => `${quote}${withAssetVersion(path, version)}${quote}`,
  );
  return out.replaceAll(ASSET_VERSION_PLACEHOLDER, version);
}

/**
 * @param {string} text
 * @param {string} version
 * @param {{ kind?: "html" | "sw" | "text" }} [options]
 */
export function stampText(text, version, options = {}) {
  const kind = options.kind || "text";
  if (kind === "sw") return stampServiceWorker(text, version);
  if (kind === "html") {
    return stampMarkupAssetUrls(text, version).replaceAll(ASSET_VERSION_PLACEHOLDER, version);
  }
  return text.replaceAll(ASSET_VERSION_PLACEHOLDER, version);
}

/**
 * @param {string} root
 * @param {(relPath: string) => void} visit
 */
function walkFiles(root, visit, relativePath = "") {
  const dir = relativePath ? join(root, relativePath) : root;
  for (const name of readdirSync(dir).sort()) {
    if (!relativePath && SKIP_DIRS.has(name)) continue;
    if (name === "_site") continue;
    const childRel = relativePath ? `${relativePath}/${name}` : name;
    const full = join(root, childRel);
    const st = statSync(full);
    if (st.isDirectory()) walkFiles(root, visit, childRel);
    else visit(childRel);
  }
}

/**
 * Stamp every HTML file and sw.js under root.
 * @param {string} root
 * @param {string} version
 * @returns {{ version: string, files: string[] }}
 */
export function stampTree(root, version) {
  const files = [];
  walkFiles(root, (relPath) => {
    const lower = relPath.toLowerCase();
    let kind = null;
    if (lower.endsWith(".html")) kind = "html";
    else if (lower === "sw.js" || lower.endsWith("/sw.js")) kind = "sw";
    if (!kind) return;

    const full = join(root, relPath);
    const before = readFileSync(full, "utf8");
    const after = stampText(before, version, { kind });
    if (after !== before) {
      writeFileSync(full, after);
      files.push(relPath);
    }
  });
  return { version, files };
}

/**
 * List HTML / sw.js paths under root that still contain the publish placeholder.
 * @param {string} root
 * @returns {string[]}
 */
export function findAssetVersionPlaceholders(root) {
  const leftover = [];
  walkFiles(root, (relPath) => {
    const lower = relPath.toLowerCase();
    if (!lower.endsWith(".html") && lower !== "sw.js" && !lower.endsWith("/sw.js")) return;
    const text = readFileSync(join(root, relPath), "utf8");
    if (text.includes(ASSET_VERSION_PLACEHOLDER)) leftover.push(relPath);
  });
  return leftover;
}

function parseArgs(argv) {
  const out = { root: DEFAULT_ROOT, version: null, dryRun: false, check: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--root" && argv[i + 1]) {
      out.root = argv[++i];
    } else if (arg === "--version" && argv[i + 1]) {
      out.version = argv[++i];
    } else if (arg === "--dry-run") {
      out.dryRun = true;
    } else if (arg === "--check") {
      out.check = true;
    } else if (arg === "--help" || arg === "-h") {
      out.help = true;
    }
  }
  return out;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(`Usage: node scripts/stamp-asset-version.mjs [--root DIR] [--version ID] [--check] [--dry-run]

Replaces / appends ?v=<version> on local CSS/JS links in HTML, and bumps sw.js
VERSION + precache asset queries. Default version: ASSET_VERSION, else GITHUB_SHA
(short), else git rev-parse --short HEAD.

  --check   Exit 1 if HTML under root lacks versioned local CSS/JS links
  --dry-run Print planned version and file count without writing`);
    return 0;
  }

  const root = args.root;
  if (!existsSync(root)) {
    console.error(`stamp-asset-version: root not found: ${root}`);
    return 1;
  }

  if (args.check) {
    const failures = [];
    walkFiles(root, (relPath) => {
      if (!relPath.toLowerCase().endsWith(".html")) return;
      const html = readFileSync(join(root, relPath), "utf8");
      const attrs = [...html.matchAll(/\b(?:href|src)=(["'])([^"']*)\1/gi)];
      let localAssets = 0;
      let versioned = 0;
      for (const m of attrs) {
        const url = m[2];
        if (!shouldVersionUrl(url)) continue;
        localAssets += 1;
        if (/[?&]v=/.test(url) || url.includes(ASSET_VERSION_PLACEHOLDER)) versioned += 1;
      }
      if (localAssets > 0 && versioned < localAssets) {
        failures.push(`${relPath}: ${versioned}/${localAssets} local css/js links versioned`);
      }
    });
    if (failures.length) {
      console.error(`Asset version check failed:\n${failures.map((f) => `  ${f}`).join("\n")}`);
      return 1;
    }
    console.log("All HTML local CSS/JS links carry a version query or placeholder.");
    return 0;
  }

  const gitCwd = existsSync(join(root, ".git")) ? root : DEFAULT_ROOT;
  const version = args.version || resolveAssetVersion({ cwd: gitCwd });
  if (args.dryRun) {
    let count = 0;
    walkFiles(root, (relPath) => {
      const lower = relPath.toLowerCase();
      if (lower.endsWith(".html") || lower === "sw.js" || lower.endsWith("/sw.js")) count += 1;
    });
    console.log(`Would stamp ${count} file(s) under ${relative(process.cwd(), root) || "."} with v=${version}`);
    return 0;
  }

  if (!version || version.includes(ASSET_VERSION_PLACEHOLDER)) {
    console.error(`stamp-asset-version: refusing invalid version: ${JSON.stringify(version)}`);
    return 1;
  }

  const result = stampTree(root, version);
  const leftover = findAssetVersionPlaceholders(root);
  if (leftover.length) {
    console.error(
      `stamp-asset-version: ${ASSET_VERSION_PLACEHOLDER} remains after stamp:\n${leftover.map((f) => `  ${f}`).join("\n")}`,
    );
    return 1;
  }
  console.log(
    `Stamped asset version ${result.version} into ${result.files.length} file(s) under ${relative(process.cwd(), root) || "."}`,
  );
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
