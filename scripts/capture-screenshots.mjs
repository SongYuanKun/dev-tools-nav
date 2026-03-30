#!/usr/bin/env node
/**
 * 用无头浏览器截取静态站页面，输出到 assets/。
 * 本地：先在仓库根目录起 HTTP 服务，例如 python3 -m http.server 8765
 *       BASE_URL=http://127.0.0.1:8765 npm run capture-screenshots
 * CI：见 .github/workflows/update-screenshots.yml
 */

import { chromium } from "playwright";
import { mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ASSETS = join(ROOT, "assets");

const BASE_URL = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");

/** @type {{ path: string; file: string; fullPage?: boolean }[]} */
const TARGETS = [
  { path: "/index.html", file: "screenshot.png", fullPage: false },
  { path: "/pages/blog/index.html", file: "screenshot-blog.png", fullPage: false },
  { path: "/pages/tools/json.html", file: "screenshot-json-tool.png", fullPage: false },
];

async function main() {
  await mkdir(ASSETS, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    colorScheme: "light",
    deviceScaleFactor: 1,
  });

  for (const t of TARGETS) {
    const url = `${BASE_URL}${t.path.startsWith("/") ? t.path : `/${t.path}`}`;
    const out = join(ASSETS, t.file);
    const page = await context.newPage();
    try {
      const res = await page.goto(url, { waitUntil: "load", timeout: 60_000 });
      if (!res || !res.ok()) {
        throw new Error(`HTTP ${res?.status()} for ${url}`);
      }
      await new Promise((r) => setTimeout(r, 1200));
      await page.screenshot({
        path: out,
        fullPage: Boolean(t.fullPage),
        type: "png",
      });
      const st = await stat(out);
      console.log(`OK ${t.file} (${st.size} bytes) <- ${url}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
