import test from "node:test";
import assert from "node:assert/strict";

import { selectBlogMarkdownFiles } from "./build-blog.mjs";

test("blog source selection excludes README documentation", () => {
  assert.deepEqual(
    selectBlogMarkdownFiles(["z-post.md", "README.md", "asset.txt", "a-post.md"]),
    ["a-post.md", "z-post.md"],
  );
});
