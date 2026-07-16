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

async function openWorkbench({ colorScheme = "dark", reducedMotion = "no-preference", storageThrows = false, viewport } = {}) {
  const context = await browser.newContext({
    colorScheme,
    permissions: ["clipboard-read", "clipboard-write"],
    reducedMotion,
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

async function selectTheme(page, theme) {
  if (await page.locator("html").getAttribute("data-theme") !== theme) {
    await page.locator("#themeToggle").click();
  }
  assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
}

async function setDocument(page, value) {
  const editor = page.locator("[data-json-editor] .cm-content");
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await page.keyboard.insertText(value);
  await page.waitForTimeout(280);
}

async function documentText(page) {
  const text = await page.locator("[data-json-editor] .cm-content").innerText();
  return text === "\n" ? "" : text;
}

async function waitForDocumentText(page, expected) {
  await page.waitForFunction((value) => {
    const text = document.querySelector("[data-json-editor] .cm-content")?.innerText ?? "";
    return (text === "\n" ? "" : text) === value;
  }, expected);
}

async function assertVisibleFocus(control) {
  const focus = await control.evaluate((node) => {
    node.focus();
    const target = node.closest(".cm-editor, .json-file-button") ?? node;
    const style = getComputedStyle(target);
    const pixel = (color) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    };
    const composite = (foreground, background) => {
      const alpha = foreground[3] / 255;
      return [
        ...foreground.slice(0, 3).map((channel, index) => Math.round(channel * alpha + background[index] * (1 - alpha))),
        255,
      ];
    };
    const backgroundAt = (start) => {
      const layers = [];
      for (let current = start; current; current = current.parentElement) layers.push(pixel(getComputedStyle(current).backgroundColor));
      return layers.reverse().reduce((background, layer) => composite(layer, background), [255, 255, 255, 255]);
    };
    const luminance = (color) => color.slice(0, 3)
      .map((channel) => channel / 255)
      .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
      .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
    const background = backgroundAt(Number.parseFloat(style.outlineOffset) < 0 ? target : target.parentElement);
    const renderedOutline = composite(pixel(style.outlineColor), background);
    const values = [luminance(background), luminance(renderedOutline)].sort((left, right) => right - left);
    return {
      active: document.activeElement === node || node.contains(document.activeElement),
      contrast: (values[0] + 0.05) / (values[1] + 0.05),
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      boxShadow: style.boxShadow,
    };
  });
  assert.equal(focus.active, true, `control did not receive focus: ${await control.getAttribute("aria-label") || await control.textContent()}`);
  assert.ok(
    (focus.outlineStyle !== "none" && Number.parseFloat(focus.outlineWidth) >= 2) || focus.boxShadow !== "none",
    `missing visible focus: ${await control.getAttribute("aria-label") || await control.textContent()} ${JSON.stringify(focus)}`,
  );
  assert.ok(focus.contrast >= 3, `focus contrast below 3:1: ${await control.getAttribute("aria-label") || await control.textContent()} ${JSON.stringify(focus)}`);
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
  await page.getByRole("tab", { name: "树视图" }).click();
  assert.match(await page.getByRole("tabpanel", { name: "树视图" }).textContent(), /超过 1 MiB.+手动/);
  assert.ok(await page.getByRole("button", { name: "仍然生成树" }).count());
  await page.getByRole("tab", { name: "格式化" }).click();
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
  const yaml = join(directory, "input.yaml");
  const invalidYaml = join(directory, "invalid.yaml");
  await writeFile(valid, '{"uploaded":true}');
  await writeFile(oversized, Buffer.alloc(5 * 1024 * 1024 + 1, 32));
  await writeFile(yaml, "uploaded: true\nitems:\n  - 1\n");
  await writeFile(invalidYaml, "broken: [\n");
  const upload = page.locator('[data-json-action="upload"]');
  await upload.setInputFiles(valid);
  await waitForDocumentText(page, '{"uploaded":true}');
  assert.equal(await documentText(page), '{"uploaded":true}');
  await upload.setInputFiles(oversized);
  assert.match(await page.locator("[data-json-feedback]").textContent(), /不能超过 5 MiB/);
  assert.equal(await documentText(page), '{"uploaded":true}');
  await upload.setInputFiles(yaml);
  const convertedYaml = '{\n  "uploaded": true,\n  "items": [\n    1\n  ]\n}';
  await waitForDocumentText(page, convertedYaml);
  assert.equal(await documentText(page), convertedYaml);
  const beforeInvalidYaml = await documentText(page);
  await upload.setInputFiles(invalidYaml);
  await page.locator("[data-json-feedback]").filter({ hasText: /YAML.+失败|无法转换 YAML/ }).waitFor();
  assert.equal(await documentText(page), beforeInvalidYaml);
  assert.match(await page.locator("[data-json-feedback]").textContent(), /YAML.+失败|无法转换 YAML/);
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
  }), beforeInvalidYaml);
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

test("legacy q deep links migrate through a fragment, clean the URL, and do not restore on refresh", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const value = '{"plus":"a+b","unicode":"中文"}';
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(`${origin}/pages/tools/json.html?embed=1&q=${encodeURIComponent(value)}&mode=tree`);
  await page.waitForURL(/\/tools\/json\/\?mode=tree$/);
  await page.locator("[data-json-editor] .cm-content").waitFor();
  assert.equal(await documentText(page), value);
  assert.match(page.url(), /mode=tree/);
  assert.doesNotMatch(page.url(), /embed=|[?#]data=|[?&]q=/);
  const contentRequests = requests.filter((url) => url.includes(encodeURIComponent(value)) || url.includes("unicode"));
  assert.equal(contentRequests.length, 1, JSON.stringify(contentRequests));
  assert.match(contentRequests[0], /\/pages\/tools\/json\.html/);
  await page.reload();
  await page.locator("[data-json-editor] .cm-content").waitFor();
  assert.equal(await documentText(page), "");
  await context.close();
});

test("switching every analysis mode preserves the main JSON byte for byte", async () => {
  const { context, page } = await openWorkbench();
  const sentinel = '{\n  "untouched": [3, 2, 1],\n  "spacing": true\n}';
  await setDocument(page, sentinel);
  for (const name of ["树视图", "JSONPath", "YAML", "对比", "格式化"]) {
    const tab = page.getByRole("tab", { name });
    await tab.click();
    assert.equal(await tab.getAttribute("aria-selected"), "true");
    assert.equal(await page.getByRole("tabpanel", { name }).isVisible(), true);
  }
  assert.equal(await documentText(page), sentinel);

  const formatTab = page.getByRole("tab", { name: "格式化" });
  await formatTab.focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.getByRole("tab", { name: "树视图" }).evaluate((node) => document.activeElement === node), true);
  await formatTab.click();
  assert.equal(await documentText(page), sentinel);
  await context.close();
});

test("tree mode renders safe expandable values, counts, types, and copyable JSONPath", async () => {
  const { context, page } = await openWorkbench();
  await setDocument(page, '{"unsafe":"<img src=x onerror=alert(1)>","items":[{"name":"one"},2]}');
  await page.getByRole("tab", { name: "树视图" }).click();

  const tree = page.getByRole("list", { name: "JSON 数据树" });
  await tree.waitFor({ timeout: 2_000 });
  assert.match(await tree.textContent(), /object · 2 项/);
  assert.match(await tree.textContent(), /array · 2 项/);
  assert.match(await tree.textContent(), /string/);
  assert.equal(await page.locator(".json-tree img").count(), 0);

  await page.getByRole("button", { name: "全部折叠" }).click();
  assert.equal(await tree.locator('[aria-expanded="true"]').count(), 0);
  const collapsedToggle = tree.locator(".json-tree-toggle").first();
  assert.match(await collapsedToggle.getAttribute("aria-label"), /^展开 /);
  assert.equal(await collapsedToggle.textContent(), "▸");
  await page.getByRole("button", { name: "全部展开" }).click();
  assert.ok(await tree.locator('[aria-expanded="true"]').count() > 0);
  assert.match(await collapsedToggle.getAttribute("aria-label"), /^折叠 /);
  assert.equal(await collapsedToggle.textContent(), "▾");

  const pathButton = page.getByRole("button", { name: "复制路径 $.items[0].name" });
  await pathButton.click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "$.items[0].name");

  await page.getByRole("tab", { name: "格式化" }).click();
  await setDocument(page, "{invalid");
  await page.getByRole("tab", { name: "树视图" }).click();
  assert.match(await page.getByRole("tabpanel", { name: "树视图" }).textContent(), /无法生成树|JSON 无效/);

  await page.getByRole("tab", { name: "格式化" }).click();
  await setDocument(page, JSON.stringify(Array.from({ length: 2_500 }, () => 0)));
  await page.getByRole("tab", { name: "树视图" }).click();
  assert.ok(await page.locator(".json-tree-item").count() <= 2_000);
  assert.match(await page.getByRole("tabpanel", { name: "树视图" }).textContent(), /仅显示前 2000 个节点/);
  await context.close();
});

test("JSONPath runs on Enter, keeps in-memory history, reports exact errors, and copies results", async () => {
  const { context, page } = await openWorkbench();
  await setDocument(page, '{"items":[{"name":"one"},{"name":"two"}]}');
  await page.getByRole("tab", { name: "JSONPath" }).click();
  const query = page.getByLabel("JSONPath 表达式");
  await query.fill("$.items[0].name");
  await query.press("Enter");
  await page.locator("[data-jsonpath-count]").waitFor({ timeout: 2_000 });
  assert.match(await page.locator("[data-jsonpath-count]").textContent(), /1 个匹配/);
  assert.match(await page.locator("[data-jsonpath-results]").textContent(), /\$\.items\[0\]\.name/);
  assert.match(await page.locator("[data-jsonpath-results]").textContent(), /"one"/);
  await page.getByRole("button", { name: "复制 JSONPath 结果" }).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), '"one"');
  assert.ok(await page.getByRole("button", { name: "历史：$.items[0].name" }).count());

  await query.fill("$..name");
  await query.press("Enter");
  assert.match(await page.locator("[data-jsonpath-error]").textContent(), /位置 3|第 3 个字符/);
  assert.equal(await page.locator("[data-jsonpath-results]").textContent(), "");

  await query.fill("  $..name");
  await query.press("Enter");
  assert.match(await page.locator("[data-jsonpath-error]").textContent(), /位置 5/);

  await page.getByRole("tab", { name: "格式化" }).click();
  await page.keyboard.press("Control+K");
  assert.equal(await page.getByRole("tab", { name: "JSONPath" }).getAttribute("aria-selected"), "true");
  assert.equal(await query.evaluate((node) => document.activeElement === node), true);
  const storage = JSON.stringify(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage))));
  assert.doesNotMatch(storage, /items\[0\]\.name/);
  await context.close();
});

test("YAML mounts lazily and only explicit successful conversions overwrite either side", async () => {
  const { context, page } = await openWorkbench();
  const original = '{\n  "name": "workbench",\n  "items": [1, 2]\n}';
  await setDocument(page, original);
  assert.equal(await page.locator("[data-yaml-editor] .cm-editor").count(), 0);
  await page.getByRole("tab", { name: "YAML" }).click();
  const yamlMount = page.locator("[data-yaml-editor]");
  await yamlMount.locator(".cm-editor").waitFor({ timeout: 2_000 });
  assert.equal(await yamlMount.locator(".cm-content").getAttribute("aria-label"), "YAML 编辑器");
  const yamlText = async () => {
    const text = await yamlMount.locator(".cm-content").innerText();
    return text === "\n" ? "" : text;
  };
  assert.equal(await yamlText(), "");

  await page.getByRole("button", { name: "JSON 转为 YAML" }).click();
  assert.match(await yamlText(), /name: workbench/);
  assert.match(await yamlText(), /items:/);

  const setYaml = async (text) => {
    const editor = yamlMount.locator(".cm-content");
    await editor.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.insertText(text);
  };
  await setYaml("bad: [");
  await page.getByRole("button", { name: "应用 YAML 为 JSON" }).click();
  assert.match(await page.locator("[data-yaml-error]").textContent(), /YAML 转换失败.+\]/);
  assert.equal(await yamlText(), "bad: [");
  await page.getByRole("tab", { name: "格式化" }).click();
  assert.equal(await documentText(page), original);

  await page.getByRole("tab", { name: "YAML" }).click();
  await setYaml("---\na: 1\n---\nb: 2");
  await page.getByRole("button", { name: "应用 YAML 为 JSON" }).click();
  assert.match(await page.locator("[data-yaml-error]").textContent(), /单个 YAML 文档/);
  await page.getByRole("tab", { name: "格式化" }).click();
  assert.equal(await documentText(page), original);

  await page.getByRole("tab", { name: "YAML" }).click();
  await setYaml("name: applied\nitems:\n  - 3");
  await page.getByRole("button", { name: "应用 YAML 为 JSON" }).click();
  await page.getByRole("tab", { name: "格式化" }).click();
  assert.equal(await documentText(page), '{\n  "name": "applied",\n  "items": [\n    3\n  ]\n}');
  await context.close();
});

test("Diff preserves both drafts, summarizes structure, and only explicit apply changes main JSON", async () => {
  const { context, page } = await openWorkbench();
  const original = '{"keep":1,"removed":2,"changed":"old"}';
  const rightText = '{"keep":1,"added":3,"changed":"new"}';
  await setDocument(page, original);
  await page.getByRole("tab", { name: "对比" }).click();
  await page.locator("[data-diff-merge] .cm-mergeView").waitFor({ timeout: 2_000 });
  const left = page.locator("[data-diff-left] .cm-content");
  const right = page.locator("[data-diff-right] .cm-content");
  assert.equal(await left.getAttribute("aria-label"), "Diff 左侧 JSON 编辑器");
  assert.equal(await right.getAttribute("aria-label"), "Diff 右侧 JSON 编辑器");
  const editorText = async (editor) => {
    const text = await editor.innerText();
    return text === "\n" ? "" : text;
  };
  const setEditor = async (editor, text) => {
    await editor.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.insertText(text);
    await page.waitForTimeout(280);
  };
  assert.equal(await editorText(left), original);
  await setEditor(right, rightText);
  assert.match(await page.locator("[data-diff-summary]").textContent(), /新增 1.+删除 1.+修改 1/);
  const diffEvents = await page.evaluate(() => window.__umamiEvents);
  assert.ok(diffEvents.some(({ name, properties }) => name === "tool_used" && properties?.action === "diff"));
  assert.ok(diffEvents.every(({ properties }) => !properties || !JSON.stringify(properties).includes("changed")));

  await page.getByRole("tab", { name: "格式化" }).click();
  await setDocument(page, '{"main":"new source"}');
  await page.getByRole("tab", { name: "对比" }).click();
  assert.equal(await editorText(left), original);
  assert.equal(await editorText(right), rightText);

  await page.getByRole("button", { name: "以主 JSON 重置左侧" }).click();
  assert.equal(await editorText(left), '{"main":"new source"}');
  assert.equal(await editorText(right), rightText);
  await page.getByRole("button", { name: "应用右侧为主 JSON" }).click();
  await page.getByRole("tab", { name: "格式化" }).click();
  assert.equal(await documentText(page), rightText);

  await page.getByRole("tab", { name: "对比" }).click();
  await page.getByRole("button", { name: "以主 JSON 重置左侧" }).click();
  await page.waitForTimeout(280);
  assert.match(await page.locator("[data-diff-summary]").textContent(), /无结构差异/);
  await setEditor(right, "{invalid");
  await page.getByRole("button", { name: "应用右侧为主 JSON" }).click();
  assert.match(await page.locator("[data-diff-error]").textContent(), /右侧 JSON 无效/);
  await page.getByRole("tab", { name: "格式化" }).click();
  assert.equal(await documentText(page), rightText);
  await context.close();
});

test("Diff gates large input before mounting the merge editor", async () => {
  const { context, page } = await openWorkbench();
  await setDocument(page, `{"data":"${"x".repeat(1024 * 1024)}"}`);
  await page.getByRole("tab", { name: "对比" }).click();
  assert.equal(await page.locator("[data-diff-merge] .cm-mergeView").count(), 0);
  assert.match(await page.getByRole("tabpanel", { name: "对比" }).textContent(), /超过 1 MiB.+手动/);
  assert.ok(await page.getByRole("button", { name: "仍然打开对比" }).count());
  await context.close();
});

test("Diff structural summary truncates high-cardinality changes", async () => {
  const { context, page } = await openWorkbench();
  await setDocument(page, JSON.stringify(Array.from({ length: 1_500 }, () => 0)));
  await page.getByRole("tab", { name: "对比" }).click();
  const right = page.locator("[data-diff-right] .cm-content");
  await right.click();
  await page.keyboard.insertText(JSON.stringify(Array.from({ length: 1_500 }, () => 1)));
  await page.waitForTimeout(280);
  assert.match(await page.locator("[data-diff-summary]").textContent(), /修改 1000.+达到统计上限/);
  await context.close();
});

test("analysis modes remain usable without horizontal page overflow at 390px", async () => {
  const { context, page } = await openWorkbench({ viewport: { width: 390, height: 844 } });
  await setDocument(page, '{"items":[{"longPropertyName":"value"}],"enabled":true}');
  await page.getByRole("tab", { name: "树视图" }).click();
  const treeTargetHeights = await page.locator(".json-tree-toggle, .json-tree-copy").evaluateAll(
    (controls) => controls.map((control) => control.getBoundingClientRect().height),
  );
  assert.ok(treeTargetHeights.every((height) => height >= 44), `tree touch targets: ${treeTargetHeights.join(", ")}`);
  await page.getByRole("tab", { name: "JSONPath" }).click();
  const mobileQuery = page.getByLabel("JSONPath 表达式");
  await mobileQuery.fill("$.enabled");
  await mobileQuery.press("Enter");
  const historyHeight = await page.getByRole("button", { name: "历史：$.enabled" }).evaluate(
    (control) => control.getBoundingClientRect().height,
  );
  assert.ok(historyHeight >= 44, `history touch target: ${historyHeight}`);
  for (const name of ["树视图", "JSONPath", "YAML", "对比"]) {
    await page.getByRole("tab", { name }).click();
    await page.waitForTimeout(80);
    const dimensions = await page.evaluate(() => ({
      body: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
      panelOverflow: [...document.querySelectorAll('[role="tabpanel"]:not([hidden])')]
        .some((panel) => panel.scrollWidth > panel.clientWidth + 1),
    }));
    assert.ok(dimensions.body <= dimensions.viewport, `${name}: ${JSON.stringify(dimensions)}`);
    assert.equal(dimensions.panelOverflow, false, `${name} panel overflows`);
  }
  const editorPositions = await page.locator("[data-diff-merge] .cm-editor").evaluateAll((editors) => editors.map((editor) => {
    const box = editor.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, width: box.width };
  }));
  assert.equal(editorPositions.length, 2);
  assert.ok(editorPositions[1].top >= editorPositions[0].bottom - 1, JSON.stringify(editorPositions));
  await context.close();
});

for (const scenario of [
  { name: "desktop dark", viewport: { width: 1440, height: 900 }, theme: "dark" },
  { name: "desktop light", viewport: { width: 1440, height: 900 }, theme: "light" },
  { name: "mobile dark", viewport: { width: 390, height: 844 }, theme: "dark" },
  { name: "mobile light", viewport: { width: 390, height: 844 }, theme: "light" },
]) {
  test(`${scenario.name} layout has no overflow traps and keeps primary controls usable`, async () => {
    const { context, page } = await openWorkbench({ colorScheme: scenario.theme, viewport: scenario.viewport });
    await selectTheme(page, scenario.theme);
    await setDocument(page, JSON.stringify({ items: Array.from({ length: 40 }, (_, index) => ({ index, enabled: true })) }));
    await page.getByRole("button", { name: /^格式化/ }).click();

    const layout = await page.evaluate(() => {
      const app = document.querySelector(".json-app");
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        appHasVerticalScroll: app.scrollHeight > app.clientHeight + 1,
      };
    });
    assert.ok(layout.documentWidth <= layout.viewportWidth, JSON.stringify(layout));
    assert.equal(layout.appHasVerticalScroll, false, JSON.stringify(layout));

    for (const mode of ["格式化", "树视图", "JSONPath", "YAML", "对比"]) {
      await page.getByRole("tab", { name: mode }).click();
      if (mode === "YAML") await page.getByRole("button", { name: "JSON 转为 YAML" }).click();
      const scrollState = await page.getByRole("tabpanel", { name: mode }).evaluate((panel) => {
        const actualScrollers = [...panel.querySelectorAll("*")].filter((node) => {
          const style = getComputedStyle(node);
          return /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1;
        });
        const nested = actualScrollers.filter((node) => actualScrollers.some((ancestor) => ancestor !== node && ancestor.contains(node)));
        return {
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
          panelScrolls: panel.scrollHeight > panel.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(panel).overflowY),
          scrollers: actualScrollers.map((node) => node.className),
          nested: nested.map((node) => node.className),
        };
      });
      assert.ok(scrollState.documentWidth <= scrollState.viewportWidth, `${mode}: ${JSON.stringify(scrollState)}`);
      assert.equal(scrollState.panelScrolls, false, `${mode}: ${JSON.stringify(scrollState)}`);
      assert.deepEqual(scrollState.nested, [], `${mode}: ${JSON.stringify(scrollState)}`);
    }

    const primarySizes = await page.locator(".json-primary-actions .json-button").evaluateAll((controls) => controls.map((control) => {
      const box = control.getBoundingClientRect();
      return { height: box.height, width: box.width, name: control.textContent.trim() };
    }));
    assert.ok(primarySizes.every(({ height, width }) => height >= 44 && width >= 44), JSON.stringify(primarySizes));

    const touchTargets = await page.locator("a[href]:visible, button:visible, input:visible, summary:visible, [tabindex='0']:visible").evaluateAll((controls) => {
      const targets = [...new Set(controls.map((control) => control.closest("label") ?? control.closest(".cm-editor") ?? control))];
      return targets.map((target) => {
        const box = target.getBoundingClientRect();
        return { height: box.height, width: box.width, name: target.getAttribute("aria-label") || target.textContent?.trim().slice(0, 40) };
      });
    });
    assert.ok(touchTargets.every(({ height, width }) => height >= 44 && width >= 44), JSON.stringify(touchTargets.filter(({ height, width }) => height < 44 || width < 44)));

    const focusable = page.locator(".json-app button:visible, .json-app input:visible, .json-app [tabindex='0']:visible");
    for (let index = 0; index < await focusable.count(); index += 1) {
      await assertVisibleFocus(focusable.nth(index));
    }
    await context.close();
  });
}

test("interactive controls in every mode and dialog expose a strong focus indicator", async () => {
  const { context, page } = await openWorkbench();
  await setDocument(page, '{"items":[{"name":"one"}],"enabled":true}');
  await page.getByRole("tab", { name: "树视图" }).click();
  await page.getByRole("tab", { name: "JSONPath" }).click();
  const query = page.getByLabel("JSONPath 表达式");
  await query.fill("$.enabled");
  await query.press("Enter");
  for (const mode of ["格式化", "树视图", "JSONPath", "YAML", "对比"]) {
    await page.getByRole("tab", { name: mode }).click();
    const panel = page.getByRole("tabpanel", { name: mode });
    const controls = panel.locator("button:visible, input:visible, .cm-content:visible, [tabindex='0']:visible");
    for (let index = 0; index < await controls.count(); index += 1) await assertVisibleFocus(controls.nth(index));
  }

  await page.getByRole("button", { name: "设置" }).click();
  const settingsControls = page.getByRole("dialog", { name: "JSON 设置" }).locator("button:visible, input:visible");
  for (let index = 0; index < await settingsControls.count(); index += 1) await assertVisibleFocus(settingsControls.nth(index));
  await page.keyboard.press("Escape");

  await page.getByRole("tab", { name: "格式化" }).click();
  await setDocument(page, "{'repair':true,}");
  await page.getByRole("button", { name: "安全修复" }).click();
  const repairControls = page.getByRole("dialog", { name: "确认安全修复" }).locator("button:visible");
  for (let index = 0; index < await repairControls.count(); index += 1) await assertVisibleFocus(repairControls.nth(index));
  await page.keyboard.press("Escape");

  const pageControls = page.locator(".json-favorite:visible, .json-back:visible, .json-faq-list summary:visible, .json-related-grid a:visible");
  for (let index = 0; index < await pageControls.count(); index += 1) await assertVisibleFocus(pageControls.nth(index));
  const chromeControls = page.locator("body > header a:visible, body > header button:visible, body > footer a:visible");
  for (let index = 0; index < await chromeControls.count(); index += 1) await assertVisibleFocus(chromeControls.nth(index));
  await context.close();
});

test("semantic structure, names, tabs, live regions, and heading order are accessible", async () => {
  const { context, page } = await openWorkbench();
  const semantics = await page.evaluate(() => {
    const ids = [...document.querySelectorAll("[id]")].map((node) => node.id);
    const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((node) => Number(node.tagName.slice(1)));
    const unnamed = [...document.querySelectorAll("button,input,select,textarea,a[href]")].filter((node) => {
      if (node.matches('input[type="hidden"]')) return false;
      const labelledBy = node.getAttribute("aria-labelledby");
      const label = node.id && document.querySelector(`label[for="${CSS.escape(node.id)}"]`);
      const wrappingLabel = node.closest("label")?.textContent?.trim();
      return !(node.getAttribute("aria-label") || labelledBy || label || wrappingLabel || node.textContent?.trim() || node.getAttribute("title"));
    }).map((node) => node.outerHTML);
    return {
      headings,
      duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index),
      unnamed,
      mainCount: document.querySelectorAll("main").length,
      navNames: [...document.querySelectorAll("nav")].map((node) => node.getAttribute("aria-label") || node.getAttribute("aria-labelledby") || ""),
      footerCount: document.querySelectorAll("body > footer").length,
      liveCount: document.querySelectorAll('[aria-live], [role="status"], [role="alert"]').length,
    };
  });
  assert.equal(semantics.mainCount, 1);
  assert.ok(semantics.navNames.length >= 1);
  assert.ok(semantics.navNames.every(Boolean), JSON.stringify(semantics.navNames));
  assert.equal(semantics.footerCount, 1);
  assert.deepEqual(semantics.duplicateIds, []);
  assert.deepEqual(semantics.unnamed, []);
  assert.ok(semantics.liveCount >= 3);
  assert.equal(semantics.headings[0], 1);
  for (let index = 1; index < semantics.headings.length; index += 1) {
    assert.ok(semantics.headings[index] <= semantics.headings[index - 1] + 1, `heading order: ${semantics.headings.join(",")}`);
  }

  const tabs = page.getByRole("tab");
  for (let index = 0; index < await tabs.count(); index += 1) {
    const tab = tabs.nth(index);
    const panelId = await tab.getAttribute("aria-controls");
    const tabId = await tab.getAttribute("id");
    assert.ok(panelId && tabId);
    assert.equal(await page.locator(`#${panelId}`).getAttribute("aria-labelledby"), tabId);
  }
  await context.close();
});

test("dialogs trap keyboard focus, close with Escape, and return focus to their triggers", async () => {
  const { context, page } = await openWorkbench();
  const trigger = page.getByRole("button", { name: "设置" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "JSON 设置" });
  await dialog.waitFor({ state: "visible" });
  for (let index = 0; index < 10; index += 1) {
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.closest("dialog[open]") !== null), true);
  }
  await page.keyboard.press("Escape");
  assert.equal(await trigger.evaluate((node) => document.activeElement === node), true);

  await setDocument(page, "{'repair':true,}");
  const repairTrigger = page.getByRole("button", { name: "安全修复" });
  await repairTrigger.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("dialog", { name: "确认安全修复" }).waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  assert.equal(await repairTrigger.evaluate((node) => document.activeElement === node), true);
  await context.close();
});

test("keyboard-only core flow and reduced-motion preferences remain usable", async () => {
  const { context, page } = await openWorkbench({ reducedMotion: "reduce" });
  await page.locator(".cm-content").focus();
  await page.keyboard.insertText('{"keyboard":true}');
  await page.keyboard.press("Control+Enter");
  assert.match(await documentText(page), /\n  "keyboard"/);
  await page.getByRole("tab", { name: "格式化" }).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  assert.equal(await page.getByRole("tab", { name: "树视图" }).getAttribute("aria-selected"), "true");
  const motion = await page.locator(".json-button").first().evaluate((node) => {
    const style = getComputedStyle(node);
    return { animation: style.animationDuration, transition: style.transitionDuration };
  });
  assert.ok(Number.parseFloat(motion.animation) <= 0.01, JSON.stringify(motion));
  assert.ok(Number.parseFloat(motion.transition) <= 0.01, JSON.stringify(motion));
  await context.close();
});

test("user content never enters request payloads or persistent storage", async () => {
  const { context, page } = await openWorkbench();
  const sentinel = "PRIVATE_SENTINEL_7f4cf1";
  const requests = [];
  page.on("request", (request) => requests.push({ url: request.url(), body: request.postData() ?? "" }));
  await setDocument(page, JSON.stringify({ secret: sentinel }));
  await page.getByRole("button", { name: /^格式化/ }).click();
  await page.getByRole("button", { name: "校验" }).click();
  await page.getByRole("tab", { name: "树视图" }).click();
  await page.waitForTimeout(100);
  const storage = await page.evaluate(() => JSON.stringify({ local: localStorage, session: sessionStorage }));
  assert.doesNotMatch(storage, new RegExp(sentinel));
  assert.ok(requests.every(({ url, body }) => !url.includes(sentinel) && !body.includes(sentinel)), JSON.stringify(requests));
  await context.close();
});

test("representative large JSON formats successfully and reports diagnostic timing", async (t) => {
  const { context, page } = await openWorkbench({ viewport: { width: 1440, height: 900 } });
  const fixture = JSON.stringify({
    rows: Array.from({ length: 8_000 }, (_, index) => ({ index, label: `item-${index}`, active: index % 2 === 0 })),
  });
  assert.ok(new TextEncoder().encode(fixture).byteLength < 1024 * 1024);
  await setDocument(page, fixture);
  const started = performance.now();
  await page.getByRole("button", { name: /^格式化/ }).click();
  const elapsed = Math.round(performance.now() - started);
  t.diagnostic(`representative ${fixture.length}-character JSON formatted in ${elapsed} ms`);
  assert.match(await documentText(page), /\n  "rows": \[/);
  assert.match(await page.locator("[data-json-status]").textContent(), /JSON 有效|有效 JSON/);
  await context.close();
});
