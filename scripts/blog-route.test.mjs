import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const html = await readFile(new URL("../pages/blog/post.html", import.meta.url), "utf8");
const redirectScript = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .find((script) => /location\.replace/.test(script));

function redirectFor(search) {
  assert.ok(redirectScript, "legacy blog redirect script is missing");
  const redirects = [];
  vm.runInNewContext(redirectScript, {
    URLSearchParams,
    location: {
      search,
      replace(value) { redirects.push(value); },
    },
  });
  assert.equal(redirects.length, 1, "legacy route must issue exactly one redirect");
  return redirects[0];
}

test("known legacy slugs redirect to their standalone article pages", () => {
  for (const slug of [
    "ai-free-tokens-handbook",
    "why-build-dev-tools-nav",
    "java-source-mybatis",
  ]) {
    assert.equal(redirectFor(`?slug=${slug}`), `./${slug}.html`);
  }
});

test("unknown and empty legacy slugs redirect to the blog index", () => {
  assert.equal(redirectFor("?slug=not-a-post"), "./index.html");
  assert.equal(redirectFor("?slug="), "./index.html");
  assert.equal(redirectFor(""), "./index.html");
});

test("relative redirects preserve the production and GitHub Pages deployment bases", () => {
  const target = redirectFor("?slug=java-source-mybatis");
  assert.equal(
    new URL(target, "https://tools.songyuankun.top/pages/blog/post.html?slug=java-source-mybatis").href,
    "https://tools.songyuankun.top/pages/blog/java-source-mybatis.html",
  );
  assert.equal(
    new URL(target, "https://songyuankun.github.io/dev-tools-nav/pages/blog/post.html?slug=java-source-mybatis").href,
    "https://songyuankun.github.io/dev-tools-nav/pages/blog/java-source-mybatis.html",
  );
});

test("legacy page is a minimal noindex compatibility route without article data or body", () => {
  assert.match(html, /<meta[^>]+name=["']robots["'][^>]+content=["']noindex,follow["']/i);
  assert.doesNotMatch(html, /data\/blog-posts\.js|BLOG_POSTS_DATA|post-content|articleBody/i);
  assert.match(html, /<a[^>]+href=["']\.\/index\.html["']/i);
});
