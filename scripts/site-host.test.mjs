import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  CANONICAL_ORIGIN,
  GITHUB_PAGES_BASE_PATH,
  canonicalUrlForPath,
  resolveGithubPagesRedirect,
} from "./site-host.mjs";

test("resolveGithubPagesRedirect maps Pages paths onto the custom domain", () => {
  assert.equal(
    resolveGithubPagesRedirect({
      hostname: "songyuankun.github.io",
      pathname: "/dev-tools-nav/",
      search: "",
      hash: "",
    }),
    `${CANONICAL_ORIGIN}/`,
  );
  assert.equal(
    resolveGithubPagesRedirect({
      hostname: "songyuankun.github.io",
      pathname: "/dev-tools-nav/tools/json/",
      search: "?mode=tree",
      hash: "#data=1",
    }),
    `${CANONICAL_ORIGIN}/tools/json/?mode=tree#data=1`,
  );
  assert.equal(
    resolveGithubPagesRedirect({
      hostname: "songyuankun.github.io",
      pathname: "/dev-tools-nav/pages/template.html",
      search: "?id=deepseek",
      hash: "",
    }),
    `${CANONICAL_ORIGIN}/pages/template.html?id=deepseek`,
  );
});

test("resolveGithubPagesRedirect ignores custom domain and unrelated hosts", () => {
  assert.equal(
    resolveGithubPagesRedirect({
      hostname: "tools.songyuankun.top",
      pathname: "/tools/json/",
    }),
    null,
  );
  assert.equal(
    resolveGithubPagesRedirect({
      hostname: "songyuankun.github.io",
      pathname: "/other-repo/",
    }),
    null,
  );
  assert.equal(
    resolveGithubPagesRedirect({
      hostname: "localhost",
      pathname: "/dev-tools-nav/",
    }),
    null,
  );
});

test("canonicalUrlForPath always uses the custom domain origin", () => {
  assert.equal(canonicalUrlForPath("/"), `${CANONICAL_ORIGIN}/`);
  assert.equal(
    canonicalUrlForPath("pages/ai/index.html"),
    `${CANONICAL_ORIGIN}/pages/ai/index.html`,
  );
});

test("base.js keeps the GitHub Pages redirect aligned with site-host helpers", () => {
  const source = readFileSync("js/base.js", "utf8");
  assert.match(source, /hostname\.endsWith\("\.github\.io"\)/);
  assert.match(source, new RegExp(GITHUB_PAGES_BASE_PATH.replace("/", "\\/")));
  assert.match(source, /location\.replace\(/);
  assert.match(source, new RegExp(CANONICAL_ORIGIN.replace(/\./g, "\\.")));
  assert.doesNotMatch(source, /^\s*CNAME/m);
});
