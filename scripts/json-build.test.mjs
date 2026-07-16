import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

test("package scripts expose the JSON and complete generated builds", () => {
  assert.equal(packageJson.scripts["build:json"], "rollup --config");
  assert.equal(
    packageJson.scripts.build,
    "npm run build:json && node scripts/build-blog.mjs && npm run generate-sitemap",
  );
  assert.equal(packageJson.scripts["check:generated"], "npm run build && node scripts/check-generated.mjs");
  assert.ok(packageJson.dependencies["@codemirror/state"]);
});

test("the tracked JSON workbench bundle stays within the delivery budget", () => {
  const bundle = statSync("js/json-workbench.bundle.js");
  assert.ok(bundle.isFile());
  assert.ok(bundle.size > 0);
  assert.ok(bundle.size <= 750 * 1024, `bundle is ${bundle.size} bytes`);
});

test("Rollup is configured for one minified browser bundle", () => {
  const config = readFileSync("rollup.config.mjs", "utf8");
  assert.match(config, /js\/json-workbench\.mjs/);
  assert.match(config, /js\/json-workbench\.bundle\.js/);
  assert.match(config, /terser/);
  assert.match(config, /comments:\s*false/);
});

test("two consecutive Rollup builds emit byte-identical bundles", () => {
  execFileSync("npm", ["run", "build:json"], { stdio: "ignore" });
  const first = readFileSync("js/json-workbench.bundle.js");
  execFileSync("npm", ["run", "build:json"], { stdio: "ignore" });
  const second = readFileSync("js/json-workbench.bundle.js");
  assert.deepEqual(second, first);
});
