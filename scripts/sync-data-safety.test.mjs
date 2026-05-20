import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, "..");
const baseJs = await readFile(path.join(repoRoot, "js", "base.js"), "utf8");

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), "dev-tools-nav-test-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runPython(scriptName, env) {
  const result = spawnSync("python3", [path.join(scriptsDir, scriptName)], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });

  assert.equal(
    result.status,
    0,
    [result.stdout, result.stderr].filter(Boolean).join("\n"),
  );
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

test("sync-csdn-rss preserves existing articles when RSS is malformed", async () => {
  await withTempDir(async (dir) => {
    const outPath = path.join(dir, "csdn-articles.json");
    const rssPath = path.join(dir, "malformed.xml");
    const existing = {
      updatedAt: "2026-05-20T00:00:00Z",
      source: "old",
      items: [{ title: "kept", url: "https://example.com/post" }],
    };

    await writeFile(outPath, `${JSON.stringify(existing, null, 2)}\n`);
    await writeFile(rssPath, "<rss><channel><item>");

    runPython("sync-csdn-rss.py", {
      CSDN_OUT_PATH: outPath,
      CSDN_RSS_URL: pathToFileURL(rssPath).href,
    });

    assert.deepEqual(await readJson(outPath), existing);
  });
});

test("sync-csdn-rss preserves existing articles when RSS has no usable items", async () => {
  await withTempDir(async (dir) => {
    const outPath = path.join(dir, "csdn-articles.json");
    const rssPath = path.join(dir, "empty.xml");
    const existing = {
      updatedAt: "2026-05-20T00:00:00Z",
      source: "old",
      items: [{ title: "kept", url: "https://example.com/post" }],
    };

    await writeFile(outPath, `${JSON.stringify(existing, null, 2)}\n`);
    await writeFile(rssPath, "<rss><channel><item><title></title></item></channel></rss>");

    runPython("sync-csdn-rss.py", {
      CSDN_OUT_PATH: outPath,
      CSDN_RSS_URL: pathToFileURL(rssPath).href,
    });

    assert.deepEqual(await readJson(outPath), existing);
  });
});

test("sync-jrebel-server preserves existing server when page has no activation URL", async () => {
  await withTempDir(async (dir) => {
    const outPath = path.join(dir, "servers.json");
    const htmlPath = path.join(dir, "jrebel.html");
    const existing = {
      jrebel: {
        url: "http://42.194.149.64:8088/40edf767-1c61-4721-94ff-0be3823da65a",
        email: "574687512@qq.com",
        updatedAt: "2026-05-20T00:00:00Z",
        source: "https://www.jpy.wang/page/jrebel.html",
      },
    };

    await writeFile(outPath, `${JSON.stringify(existing, null, 2)}\n`);
    await writeFile(htmlPath, "<html><body>temporarily unavailable</body></html>");

    runPython("sync-jrebel-server.py", {
      JREBEL_OUT_PATH: outPath,
      JREBEL_HTML_PATH: htmlPath,
    });

    assert.deepEqual(await readJson(outPath), existing);
  });
});

test("sync-jrebel-server writes valid activation URL updates", async () => {
  await withTempDir(async (dir) => {
    const outPath = path.join(dir, "servers.json");
    const htmlPath = path.join(dir, "jrebel.html");

    await writeFile(outPath, `${JSON.stringify({ other: true }, null, 2)}\n`);
    await writeFile(
      htmlPath,
      "<html><body>http://127.0.0.1:8080/abc-123 user@example.com</body></html>",
    );

    runPython("sync-jrebel-server.py", {
      JREBEL_OUT_PATH: outPath,
      JREBEL_HTML_PATH: htmlPath,
      JREBEL_SOURCE_URL: "https://www.jpy.wang/page/jrebel.html",
    });

    const updated = await readJson(outPath);
    assert.equal(updated.other, true);
    assert.equal(updated.jrebel.url, "http://127.0.0.1:8080/abc-123");
    assert.equal(updated.jrebel.email, "user@example.com");
    assert.equal(updated.jrebel.source, "https://www.jpy.wang/page/jrebel.html");
    assert.match(updated.jrebel.updatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });
});

function renderBaseNav({ hostname, pathname, canonicalHref = null }) {
  const listeners = {};
  const nav = { innerHTML: "" };
  const location = { hostname, pathname, search: "", origin: `https://${hostname}` };
  const document = {
    readyState: "loading",
    referrer: "",
    title: "Test",
    documentElement: {
      getAttribute() {
        return "light";
      },
      setAttribute() {},
      classList: { add() {} },
    },
    querySelector(selector) {
      if (selector === 'link[rel="canonical"]') {
        return canonicalHref ? { href: canonicalHref } : null;
      }
      if (selector === "nav.navbar") return nav;
      return null;
    },
    getElementById() {
      return null;
    },
    addEventListener(event, callback) {
      listeners[event] = callback;
    },
  };
  const history = { pushState() {}, replaceState() {} };
  const localStorage = { getItem() { return null; }, setItem() {} };
  const window = {
    screen: { width: 1, height: 1 },
    navigator: { language: "zh-CN" },
    location,
    document,
    history,
    localStorage,
    addEventListener() {},
  };

  vm.runInNewContext(baseJs, {
    window,
    document,
    history,
    localStorage,
    URL,
    URLSearchParams,
    fetch() {
      return Promise.resolve({ json: () => Promise.resolve({}) });
    },
    setTimeout() {},
  });

  listeners.DOMContentLoaded();
  return nav.innerHTML;
}

test("base nav keeps GitHub Pages project prefix for pages without canonical", () => {
  const html = renderBaseNav({
    hostname: "songyuankun.github.io",
    pathname: "/dev-tools-nav/pages/blog/post.html",
  });

  assert.match(html, /href="\.\.\/\.\.\/index\.html"/);
  assert.doesNotMatch(html, /href="\.\.\/\.\.\/\.\.\/index\.html"/);
});
