import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { mkdtemp, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve } from "node:path";
import test, { after, before } from "node:test";
import { chromium } from "playwright";

const root = resolve(new URL("..", import.meta.url).pathname);
const errors = [];
let browser;
let origin;
let server;

const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

before(async () => {
  server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const relative = pathname === "/"
      ? "index.html"
      : `${pathname.replace(/^\/+/, "")}${pathname.endsWith("/") ? "index.html" : ""}`;
    const file = normalize(resolve(root, relative));
    if (!file.startsWith(`${root}/`)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    const stream = createReadStream(file);
    stream.once("error", () => response.writeHead(404).end("Not found"));
    stream.once("open", () => {
      response.writeHead(200, { "content-type": mime[extname(file)] ?? "application/octet-stream" });
      stream.pipe(response);
    });
  });
  await new Promise((resolveReady) => server.listen(0, "127.0.0.1", resolveReady));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser?.close();
  await new Promise((resolveClosed) => server?.close(resolveClosed));
  assert.deepEqual(errors, [], `browser emitted errors:\n${errors.join("\n")}`);
});

async function openWorkbench({ storageThrows = false, viewport } = {}) {
  const context = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
    ...(viewport ? { viewport } : {}),
  });
  const events = [];
  await context.addInitScript(({ throws }) => {
    window.__umamiEvents = [];
    window.umami = { track: (name, properties) => window.__umamiEvents.push({ name, properties }) };
    window.umamiTrack = (name, properties) => window.__umamiEvents.push({ name, properties });
    if (throws) window.ToolsPrefs = null;
  }, { throws: storageThrows });
  const page = await context.newPage();
  await page.route("https://umami.songyuankun.top/**", (route) => route.fulfill({
    status: 200,
    contentType: route.request().resourceType() === "script" ? "text/javascript" : "application/json",
    body: route.request().resourceType() === "script" ? "" : "{}",
  }));
  if (storageThrows) {
    await page.route("**/js/tools-prefs.js", (route) => route.fulfill({
      status: 200,
      contentType: "text/javascript",
      body: `window.ToolsPrefs={
        addRecent(){throw new DOMException("storage disabled","SecurityError")},
        hasFavorite(){throw new DOMException("storage disabled","SecurityError")},
        toggleFavorite(){throw new DOMException("storage disabled","SecurityError")}
      };`,
    }));
  }
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) => {
    if (!request.url().startsWith("https://umami.songyuankun.top/")) {
      errors.push(`requestfailed: ${request.url()} ${request.failure()?.errorText}`);
    }
  });
  await page.goto(`${origin}/tools/json/`);
  await page.locator(".cm-content").waitFor();
  await page.evaluate(() => {
    window.__umamiEvents = [];
    window.umami = { track: (name, properties) => window.__umamiEvents.push({ name, properties }) };
    window.umamiTrack = (name, properties) => window.__umamiEvents.push({ name, properties });
  });
  return { context, events, page };
}

async function setDocument(page, value) {
  const editor = page.locator(".cm-content");
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await page.keyboard.insertText(value);
  await page.waitForTimeout(280);
}

async function documentText(page) {
  const text = await page.locator(".cm-content").innerText();
  return text === "\n" ? "" : text;
}

test("core commands, shortcuts, undo, feedback, status, and private analytics work", async () => {
  const { context, page } = await openWorkbench();
  await page.getByRole("button", { name: "示例" }).click();
  assert.match(await documentText(page), /"project"/);
  await setDocument(page, '{"name":"JSON 工作台","items":[1,2]}');
  await page.keyboard.press("Control+Enter");
  assert.match(await documentText(page), /\n  "name"/);
  assert.match(await page.locator("[data-json-counts]").textContent(), /字符 · \d+ B/);

  await page.getByRole("button", { name: "压缩" }).click();
  assert.equal(await documentText(page), '{"name":"JSON 工作台","items":[1,2]}');
  await page.keyboard.press("Control+z");
  assert.match(await documentText(page), /\n  "name"/);

  await setDocument(page, "");
  await page.keyboard.press("Shift+M");
  assert.equal(await documentText(page), "M");

  await setDocument(page, '{\n  "name": "JSON 工作台",\n  "items": [1, 2]\n}');
  await page.keyboard.press("Control+Shift+M");
  assert.equal(await documentText(page), '{"name":"JSON 工作台","items":[1,2]}');

  await setDocument(page, '{"z":"中文","a":{"b":2,"a":1}}');
  await page.getByRole("button", { name: "Key 排序" }).click();
  assert.equal(await documentText(page), '{\n  "a": {\n    "a": 1,\n    "b": 2\n  },\n  "z": "中文"\n}');
  await page.getByRole("button", { name: "Unicode" }).click();
  assert.match(await documentText(page), /\\u4e2d\\u6587/);
  await page.getByRole("button", { name: "Unicode" }).click();
  assert.match(await documentText(page), /中文/);
  await page.getByRole("button", { name: "校验" }).click();
  assert.match(await page.locator("[data-json-feedback]").textContent(), /校验通过/);

  await setDocument(page, '{"name":"JSON 工作台","items":[1,2]}');
  await page.getByRole("button", { name: "复制" }).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), '{"name":"JSON 工作台","items":[1,2]}');
  assert.match(await page.locator("[data-json-feedback]").textContent(), /已复制/);
  await page.getByRole("button", { name: "清空" }).click();
  assert.equal(await documentText(page), "");

  const tracked = await page.evaluate(() => window.__umamiEvents);
  assert.ok(tracked.some(({ name, properties }) => name === "tool_used" && properties?.tool === "json" && properties?.action === "format"));
  assert.ok(tracked.some(({ name, properties }) => name === "tool_used" && properties?.tool === "json" && properties?.action === "minify"));
  assert.ok(tracked.every(({ properties }) => !properties || !JSON.stringify(properties).includes("JSON 工作台")));
  await context.close();
});

test("diagnostics expose a line and column, lint marker, and focusable location", async () => {
  const { context, page } = await openWorkbench();
  await setDocument(page, '{\n  "ok": true,\n  "broken": ]\n}');
  const banner = page.locator("[data-json-error]");
  await assert.doesNotReject(() => banner.waitFor({ state: "visible" }));
  assert.match(await banner.textContent(), /第 3 行，第 \d+ 列/);
  assert.ok(await page.locator(".cm-lintRange-error").count());
  await page.getByRole("button", { name: "定位错误" }).click();
  assert.equal(await page.evaluate(() => document.activeElement?.closest(".cm-editor") !== null), true);
  assert.match(await page.locator("[data-json-selection-status]").textContent(), /第 3 行/);
  await context.close();
});

test("large documents skip automatic diagnostics and repair never overwrites on failure", async () => {
  const { context, page } = await openWorkbench();
  await setDocument(page, `{"data":"${"x".repeat(1024 * 1024)}"`);
  assert.match(await page.locator("[data-json-status]").textContent(), /超过 1 MiB|已暂停自动校验/);
  await setDocument(page, "{'broken': nope}");
  const before = await documentText(page);
  await page.getByRole("button", { name: "安全修复" }).click();
  assert.equal(await documentText(page), before);
  assert.match(await page.locator("[data-json-feedback]").textContent(), /修复失败/);
  await context.close();
});

test("repair uses an accessible confirmation dialog and only applies after confirmation", async () => {
  const { context, page } = await openWorkbench();
  await setDocument(page, "{'name':'Koen',}");
  await page.getByRole("button", { name: "安全修复" }).click();
  const dialog = page.getByRole("dialog", { name: "确认安全修复" });
  await dialog.waitFor({ state: "visible" });
  assert.match(await dialog.textContent(), /将修改|字符/);
  assert.equal(await documentText(page), "{'name':'Koen',}");
  await dialog.getByRole("button", { name: "应用修复" }).click();
  assert.equal(await documentText(page), '{\n  "name": "Koen"\n}');
  await context.close();
});

test("settings persist only allowlisted preferences and content does not survive reload", async () => {
  const { context, page } = await openWorkbench();
  await setDocument(page, '{"secret":"must-not-persist",}');
  assert.ok(await page.locator(".cm-lintRange-error").count());
  const trigger = page.getByRole("button", { name: "设置" });
  await trigger.click();
  const settings = page.getByRole("dialog", { name: "JSON 设置" });
  await settings.getByLabel("4 空格").check();
  await settings.getByLabel("宽松解析").check();
  await page.waitForFunction(() => document.querySelectorAll(".cm-lintRange-error").length === 0);
  assert.equal(await page.locator(".cm-lintRange-error").count(), 0);
  await settings.getByLabel("保留 Unicode 转义").check();
  await page.keyboard.press("Escape");
  assert.equal(await trigger.evaluate((node) => document.activeElement === node), true);
  await setDocument(page, '{"quote":"\\u0022",}');
  await page.getByRole("button", { name: "Unicode" }).click();
  assert.equal(await documentText(page), '{\n    "quote": "\\\""\n}');
  const saved = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  const serialized = JSON.stringify(saved);
  assert.doesNotMatch(serialized, /must-not-persist|secret|quote|u0022/);
  const workbenchPrefs = JSON.parse(saved["json-workbench-prefs-v1"]);
  assert.deepEqual(workbenchPrefs, { indent: 4, relaxed: true, escapeUnicode: true });
  await page.reload();
  await page.locator(".cm-content").waitFor();
  assert.equal(await documentText(page), "");
  await context.close();
});

test("valid uploads load locally, oversized uploads are rejected, and download is deterministic", async () => {
  const { context, page } = await openWorkbench();
  const directory = await mkdtemp(join(tmpdir(), "json-workbench-"));
  const valid = join(directory, "input.json");
  const oversized = join(directory, "oversized.json");
  await writeFile(valid, '{"uploaded":true}');
  await writeFile(oversized, Buffer.alloc(5 * 1024 * 1024 + 1, 32));
  const upload = page.locator('[data-json-action="upload"]');
  await upload.setInputFiles(valid);
  assert.equal(await documentText(page), '{"uploaded":true}');
  await upload.setInputFiles(oversized);
  assert.match(await page.locator("[data-json-feedback]").textContent(), /不能超过 5 MiB/);
  assert.equal(await documentText(page), '{"uploaded":true}');
  const downloadPromise = page.waitForEvent("download");
  await page.evaluate(() => {
    const createObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      window.__downloadMime = blob.type;
      return createObjectURL(blob);
    };
  });
  await page.getByRole("button", { name: "下载" }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "formatted.json");
  assert.equal(await page.evaluate(() => window.__downloadMime), "application/json;charset=utf-8");
  assert.equal(await download.createReadStream().then(async (stream) => {
    let output = "";
    for await (const chunk of stream) output += chunk;
    return output;
  }), '{"uploaded":true}');
  await context.close();
});

test("ToolsPrefs storage failures are isolated from the editor", async () => {
  const { context, page } = await openWorkbench({ storageThrows: true });
  await setDocument(page, '{"works":true}');
  await page.getByRole("button", { name: /^格式化/ }).click();
  assert.match(await documentText(page), /\n  "works"/);
  await context.close();
});

test("settings controls keep 44px touch targets on a narrow viewport", async () => {
  const { context, page } = await openWorkbench({ viewport: { width: 390, height: 844 } });
  await page.getByRole("button", { name: "设置" }).click();
  const heights = await page.getByRole("dialog", { name: "JSON 设置" }).locator("fieldset label").evaluateAll(
    (labels) => labels.map((label) => label.getBoundingClientRect().height),
  );
  assert.ok(heights.length > 0);
  assert.ok(heights.every((height) => height >= 44), `touch target heights: ${heights.join(", ")}`);
  await context.close();
});
