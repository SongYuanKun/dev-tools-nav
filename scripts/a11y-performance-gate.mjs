#!/usr/bin/env node
import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import { extname, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve(new URL("..", import.meta.url).pathname);
const pages = ["/", "/tools/json/", "/tools/jwt/", "/tools/regex/", "/pages/ai/"];
const mime = { ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".svg": "image/svg+xml" };
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const relative = pathname === "/" ? "index.html" : `${pathname.replace(/^\/+/, "")}${pathname.endsWith("/") ? "index.html" : ""}`;
  const file = normalize(resolve(root, relative));
  if (!file.startsWith(`${root}/`)) return response.writeHead(403).end("Forbidden");
  const stream = createReadStream(file);
  stream.once("error", () => response.writeHead(404).end("Not found"));
  stream.once("open", () => { response.writeHead(200, { "content-type": mime[extname(file)] ?? "application/octet-stream" }); stream.pipe(response); });
});

await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
try {
  for (const pathname of pages) {
    const page = await browser.newPage();
    await page.route(/^(?!http:\/\/127\.0\.0\.1:)/, (route) => route.abort());
    await page.goto(`${origin}${pathname}`, { waitUntil: "domcontentloaded" });
    const frameElement = page.locator("#toolFrame");
    let documentTarget = page;
    if (await frameElement.count()) {
      await frameElement.waitFor({ state: "attached" });
      const frameHandle = await frameElement.elementHandle();
      assert.ok(frameHandle, `${pathname}: tool iframe element is unavailable`);
      try {
        documentTarget = await frameHandle.contentFrame();
      } finally {
        await frameHandle.dispose();
      }
      assert.ok(documentTarget, `${pathname}: tool iframe did not create a browsing context`);
      await documentTarget.waitForLoadState("domcontentloaded");
      await documentTarget.locator("body").waitFor();
    }
    const report = await documentTarget.evaluate(() => {
      const labelText = (element) => [...document.querySelectorAll("label")].some((label) => label.htmlFor === element.id && label.textContent.trim());
      const unnamed = [...document.querySelectorAll("a, button, input, select, textarea")]
        .filter((element) => !element.closest("[hidden]") && element.type !== "hidden")
        .filter((element) => !element.getAttribute("aria-label") && !element.textContent.trim() && !element.getAttribute("title") && !labelText(element))
        .map((element) => element.outerHTML.slice(0, 120));
      const imagesWithoutAlt = [...document.images].filter((image) => !image.hasAttribute("alt")).map((image) => image.src);
      const navigation = performance.getEntriesByType("navigation")[0];
      return { lang: document.documentElement.lang, title: document.title, unnamed, imagesWithoutAlt, domContentLoaded: navigation?.domContentLoadedEventEnd ?? Infinity };
    });
    const targetName = documentTarget === page ? pathname : `${pathname} iframe`;
    assert.ok(report.lang, `${targetName}: missing document language`);
    assert.ok(report.title.trim(), `${targetName}: missing document title`);
    assert.deepEqual(report.unnamed, [], `${targetName}: interactive control has no accessible name`);
    assert.deepEqual(report.imagesWithoutAlt, [], `${targetName}: image has no alt attribute`);
    assert.ok(report.domContentLoaded < 2500, `${targetName}: DOMContentLoaded exceeded 2.5s (${report.domContentLoaded}ms)`);
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((closed) => server.close(closed));
}
