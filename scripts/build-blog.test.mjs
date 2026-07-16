import test from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildBlogArtifacts,
  buildBlogContentModel,
  buildBlogSite,
  calculateStaleBlogArticlePaths,
  parseBlogSource,
  renderMarkdown,
  selectBlogMarkdownFiles,
} from "./build-blog.mjs";

const VALID_FRONTMATTER = `---
title: A useful post
date: 2026-03-01
description: A precise description
category: Engineering
tags: [Node.js, Testing]
slug: useful-post
---

Post body.`;

test("blog source selection excludes README documentation", () => {
  assert.deepEqual(
    selectBlogMarkdownFiles(["z-post.md", "README.md", "asset.txt", "a-post.md"]),
    ["a-post.md", "z-post.md"],
  );
});

test("content model sorts newest first with a stable slug tie-breaker", () => {
  const sourceFor = (slug, date) => ({
    sourceFile: `${slug}.md`,
    raw: VALID_FRONTMATTER
      .replace("date: 2026-03-01", `date: ${date}`)
      .replace("slug: useful-post", `slug: ${slug}`),
  });

  const posts = buildBlogContentModel([
    sourceFor("z-last", "2026-03-01"),
    sourceFor("newest", "2026-04-01"),
    sourceFor("a-first", "2026-03-01"),
  ], { today: "2026-07-16" });

  assert.deepEqual(posts.map(post => post.slug), ["newest", "a-first", "z-last"]);
});

test("content model rejects duplicate output slugs", () => {
  assert.throws(
    () => buildBlogContentModel([
      { sourceFile: "useful-post.md", raw: VALID_FRONTMATTER },
      { sourceFile: "useful-post.md", raw: VALID_FRONTMATTER },
    ], { today: "2026-07-16" }),
    /duplicate slug "useful-post" in useful-post\.md and useful-post\.md/,
  );
});

test("content model rejects slugs owned by fixed blog pages", () => {
  assert.throws(
    () => buildBlogContentModel([{
      sourceFile: "index.md",
      raw: VALID_FRONTMATTER.replace("slug: useful-post", "slug: index"),
    }], { today: "2026-07-16" }),
    /index\.md: slug "index" conflicts with a fixed blog output/,
  );
});

test("content model requires the slug to match its Markdown filename", () => {
  assert.throws(
    () => buildBlogContentModel([{
      sourceFile: "different-name.md",
      raw: VALID_FRONTMATTER,
    }], { today: "2026-07-16" }),
    /different-name\.md: slug "useful-post" must match the source filename/,
  );
});

test("valid blog source becomes a normalized content record", () => {
  const post = parseBlogSource("source.md", VALID_FRONTMATTER, {
    today: "2026-07-16",
  });

  assert.deepEqual(post, {
    sourceFile: "source.md",
    title: "A useful post",
    date: "2026-03-01",
    updated: "2026-03-01",
    description: "A precise description",
    category: "Engineering",
    tags: ["Node.js", "Testing"],
    slug: "useful-post",
    keywords: "",
    kicker: "",
    featured: false,
    body: "Post body.",
  });
});

test("invalid frontmatter fails with the source file and exact reason", () => {
  const cases = [
    ["missing frontmatter", "Post body.", /bad\.md: frontmatter is required/],
    ["missing required field", VALID_FRONTMATTER.replace("title: A useful post\n", ""), /bad\.md: missing required field "title"/],
    ["blank required field", VALID_FRONTMATTER.replace("title: A useful post", "title: \"   \""), /bad\.md: missing required field "title"/],
    ["unknown field", VALID_FRONTMATTER.replace("slug: useful-post", "slug: useful-post\nauthor: somebody"), /bad\.md: unknown frontmatter field "author"/],
    ["duplicate field", VALID_FRONTMATTER.replace("slug: useful-post", "slug: useful-post\nslug: another-post"), /bad\.md: duplicate frontmatter field "slug"/],
    ["invalid date shape", VALID_FRONTMATTER.replace("2026-03-01", "2026-3-1"), /bad\.md: invalid date "2026-3-1"/],
    ["invalid calendar date", VALID_FRONTMATTER.replace("2026-03-01", "2026-02-30"), /bad\.md: invalid date "2026-02-30"/],
    ["future date", VALID_FRONTMATTER.replace("2026-03-01", "2026-07-17"), /bad\.md: date cannot be in the future/],
    ["updated before publication", VALID_FRONTMATTER.replace("date: 2026-03-01", "date: 2026-03-01\nupdated: 2026-02-28"), /bad\.md: updated cannot be earlier than date/],
    ["invalid slug", VALID_FRONTMATTER.replace("useful-post", "Useful_Post"), /bad\.md: invalid slug "Useful_Post"/],
    ["empty tag", VALID_FRONTMATTER.replace("[Node.js, Testing]", "[Node.js, ]"), /bad\.md: tags must be a non-empty array of non-empty strings/],
    ["invalid featured", VALID_FRONTMATTER.replace("slug: useful-post", "slug: useful-post\nfeatured: yes"), /bad\.md: featured must be true or false/],
  ];

  for (const [name, source, expected] of cases) {
    assert.throws(
      () => parseBlogSource("bad.md", source, { today: "2026-07-16" }),
      expected,
      name,
    );
  }
});

test("Markdown rendering escapes raw HTML and unsafe link destinations", () => {
  const html = renderMarkdown(`## <img src=x onerror=alert(1)>

Open [safe <b>label</b>](https://example.com/?a=1&b=2), [local](/tools/json/), and [bad](javascript:alert(1)).

\`<script>alert(1)</script>\`

\`\`\`html
<script>alert(2)</script>
\`\`\``);

  assert.doesNotMatch(html, /<script|<img|javascript:/i);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /<a href="https:\/\/example\.com\/\?a=1&amp;b=2"/);
  assert.match(html, /safe &lt;b&gt;label&lt;\/b&gt;/);
  assert.match(html, /<a href="\/tools\/json\/"/);
  assert.match(html, /and bad\./);
  assert.match(html, /<code>&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/code>/);
  assert.match(html, /<pre><code class="language-html">&lt;script&gt;alert\(2\)&lt;\/script&gt;<\/code><\/pre>/);
});

test("Markdown formatting markers in a URL cannot alter generated markup", () => {
  const html = renderMarkdown("[docs](https://example.com/**section**)");

  assert.match(html, /href="https:\/\/example\.com\/\*\*section\*\*"/);
  assert.doesNotMatch(html, /href="[^"]*<strong>/);
});

test("Markdown hard breaks render explicitly without trailing whitespace", () => {
  const html = renderMarkdown("First line  \nSecond line");
  assert.match(html, /First line<br \/>\nSecond line/);
  assert.doesNotMatch(html, / +$/m);
});

function normalizedPost(slug, date, overrides = {}) {
  return {
    sourceFile: `${slug}.md`,
    title: `Title ${slug}`,
    date,
    updated: date,
    description: `Description ${slug}`,
    category: "Engineering",
    tags: ["Node.js", "Testing"],
    slug,
    keywords: "node, testing",
    kicker: "Self hosted",
    featured: false,
    body: `## ${slug}\n\nBody **${slug}**.`,
    ...overrides,
  };
}

test("artifact map deterministically contains every blog output and no body copies in data", () => {
  const posts = [
    normalizedPost("newest", "2026-03-03", { featured: true }),
    normalizedPost("middle", "2026-03-02"),
    normalizedPost("oldest", "2026-03-01"),
  ];

  const first = buildBlogArtifacts(posts);
  const second = buildBlogArtifacts(structuredClone(posts));

  assert.deepEqual(Object.keys(first), [
    "pages/blog/newest.html",
    "pages/blog/middle.html",
    "pages/blog/oldest.html",
    "pages/blog/index.html",
    "data/blog-manifest.json",
    "data/blog-posts.js",
    "feed.xml",
  ]);
  assert.deepEqual(second, first);

  const manifest = JSON.parse(first["data/blog-manifest.json"]);
  assert.equal(manifest.version, 1);
  assert.deepEqual(manifest.posts.map(post => post.slug), ["newest", "middle", "oldest"]);
  assert.ok(manifest.posts.every(post => !("body" in post)));
  assert.doesNotMatch(first["data/blog-posts.js"], /BLOG_POSTS_DATA|content:|csdn\.net/i);
  assert.match(first["data/blog-posts.js"], /^var BLOG_POSTS = /);
  assert.match(first["data/blog-posts.js"], /var BLOG_CATEGORIES = /);
});

test("article, index, manifest, compatibility data, and Atom share canonical posts and dates", () => {
  const posts = [
    normalizedPost("first", "2026-03-03", {
      updated: "2026-03-05",
      title: "Use <JSON> & APIs",
      description: "A <safe> & useful summary",
    }),
    normalizedPost("second", "2026-03-02"),
    normalizedPost("third", "2026-03-01"),
  ];
  const artifacts = buildBlogArtifacts(posts);
  const html = artifacts["pages/blog/first.html"];
  const canonical = "https://tools.songyuankun.top/pages/blog/first.html";

  assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
  assert.match(html, /rel="alternate" type="application\/atom\+xml" href="https:\/\/tools\.songyuankun\.top\/feed\.xml"/);
  const jsonLdText = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  const jsonLd = JSON.parse(jsonLdText);
  assert.equal(jsonLd.headline, "Use <JSON> & APIs");
  assert.equal(jsonLd.datePublished, "2026-03-03");
  assert.equal(jsonLd.dateModified, "2026-03-05");
  assert.equal(jsonLd.mainEntityOfPage["@id"], canonical);
  assert.match(html, /href="https:\/\/tools\.songyuankun\.top\/pages\/blog\/second\.html"/);

  const index = artifacts["pages/blog/index.html"];
  for (const post of posts) assert.match(index, new RegExp(`href="${post.slug}\\.html"`));
  assert.match(index, /src="\.\.\/\.\.\/data\/blog-posts\.js"/);
  assert.match(index, /src="\.\.\/\.\.\/js\/blog-list\.js"/);
  assert.match(index, /<footer class="footer"><\/footer>/);
  assert.match(index, /href="https:\/\/blog\.csdn\.net\/syk123839070"/);

  const feed = artifacts["feed.xml"];
  assert.match(feed, /<author>\s*<name>Koen<\/name>\s*<uri>https:\/\/koen\.songyuankun\.top\/<\/uri>\s*<\/author>/);
  assert.match(feed, /<title>Use &lt;JSON&gt; &amp; APIs<\/title>/);
  assert.match(feed, /<summary>A &lt;safe&gt; &amp; useful summary<\/summary>/);
  assert.match(feed, /<published>2026-03-03T00:00:00Z<\/published>/);
  assert.match(feed, /<updated>2026-03-05T00:00:00Z<\/updated>/);
  assert.match(feed, new RegExp(`<id>${canonical}<\\/id>`));
});

test("stale cleanup removes manifest and filesystem orphans while preserving fixed pages", () => {
  const previous = {
    version: 1,
    posts: [{ slug: "kept" }, { slug: "removed" }, { slug: "index" }, { slug: "post" }],
  };
  const current = [normalizedPost("kept", "2026-03-01")];

  assert.deepEqual(calculateStaleBlogArticlePaths(previous, current, [
    "kept.html", "orphan.html", "index.html", "post.html", "notes.txt",
  ]), [
    "pages/blog/orphan.html",
    "pages/blog/removed.html",
  ]);
});

test("an empty Markdown source set rebuilds empty artifacts and removes every old article", () => {
  const root = mkdtempSync(join(tmpdir(), "blog-empty-"));
  try {
    mkdirSync(join(root, "content", "blog"), { recursive: true });
    mkdirSync(join(root, "data"), { recursive: true });
    mkdirSync(join(root, "pages", "blog"), { recursive: true });
    writeFileSync(join(root, "content", "blog", "README.md"), "documentation only\n");
    writeFileSync(join(root, "pages", "blog", "old-post.html"), "old body\n");
    writeFileSync(join(root, "pages", "blog", "orphan.html"), "orphan body\n");
    writeFileSync(join(root, "pages", "blog", "post.html"), "compatibility\n");
    writeFileSync(join(root, "data", "blog-manifest.json"), JSON.stringify({
      version: 1,
      posts: [{ slug: "old-post" }],
    }));

    const result = buildBlogSite(root, { today: "2026-07-16" });

    assert.equal(result.posts.length, 0);
    assert.deepEqual(result.removed, [
      "pages/blog/old-post.html",
      "pages/blog/orphan.html",
    ]);
    assert.deepEqual(
      JSON.parse(readFileSync(join(root, "data", "blog-manifest.json"), "utf8")).posts,
      [],
    );
    assert.equal(existsSync(join(root, "pages", "blog", "old-post.html")), false);
    assert.equal(existsSync(join(root, "pages", "blog", "orphan.html")), false);
    assert.equal(existsSync(join(root, "pages", "blog", "post.html")), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
