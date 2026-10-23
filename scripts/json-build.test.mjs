import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import {
  BUNDLED_PACKAGES,
  ISC_LICENSE_TEXT,
  JSON_BUNDLED_PACKAGES,
  MIT_LICENSE_TEXT,
  QRCODE_BUNDLED_PACKAGES,
  buildLicenseBanner,
} from "./bundle-license-banner.mjs";

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

test("the tracked QR code bundle stays within the delivery budget", () => {
  const bundle = statSync("js/qrcode-tool.bundle.js");
  assert.ok(bundle.isFile());
  assert.ok(bundle.size > 0);
  assert.ok(bundle.size <= 200 * 1024, `QR bundle is ${bundle.size} bytes`);
});

test("Rollup is configured for minified browser bundles that keep the license banner", () => {
  const config = readFileSync("rollup.config.mjs", "utf8");
  assert.match(config, /js\/json-workbench\.mjs/);
  assert.match(config, /js\/json-workbench\.bundle\.js/);
  assert.match(config, /js\/qrcode-workbench\.mjs/);
  assert.match(config, /js\/qrcode-tool\.bundle\.js/);
  assert.match(config, /terser/);
  assert.match(config, /banner:\s*buildLicenseBanner\(/);
  // 剥离注释可以，但不能连 /*! */ 署名一起剥掉。
  assert.match(config, /comments:\s*\/\^!\//);
  assert.doesNotMatch(config, /comments:\s*false/);
});

test("every redistributed dependency is attributed in THIRD-PARTY-NOTICES.md", () => {
  const notices = readFileSync("THIRD-PARTY-NOTICES.md", "utf8");

  for (const { name, license, copyright } of BUNDLED_PACKAGES) {
    assert.ok(notices.includes(`\`${name}\``), `${name} is missing from THIRD-PARTY-NOTICES.md`);
    assert.ok(notices.includes(escapeAngleBrackets(copyright)), `${name} is missing its copyright notice`);
    assert.ok(license === "MIT" || license === "ISC", `${name} has an unexpected license ${license}`);
  }

  assert.ok(notices.includes(MIT_LICENSE_TEXT), "MIT license text is missing");
  assert.ok(notices.includes(ISC_LICENSE_TEXT), "ISC license text is missing");

  for (const name of Object.keys(packageJson.dependencies)) {
    assert.ok(
      BUNDLED_PACKAGES.some((pkg) => pkg.name === name),
      `runtime dependency ${name} is not declared in scripts/bundle-license-banner.mjs`,
    );
  }
});

test("recorded third-party licenses match the installed packages", () => {
  for (const { name, license } of BUNDLED_PACKAGES) {
    const installed = JSON.parse(readFileSync(`node_modules/${name}/package.json`, "utf8"));
    assert.equal(installed.license, license, `${name} now ships under ${installed.license}`);
  }
});

test("the built bundles carry the third-party attribution banner", () => {
  const jsonBundle = readFileSync("js/json-workbench.bundle.js", "utf8");
  const jsonBanner = buildLicenseBanner({ packages: JSON_BUNDLED_PACKAGES });
  assert.ok(jsonBundle.startsWith(jsonBanner), "JSON bundle does not start with the license banner");
  assert.ok(jsonBundle.includes(MIT_LICENSE_TEXT.split("\n")[0]), "JSON bundle is missing the MIT permission notice");
  for (const { copyright } of JSON_BUNDLED_PACKAGES) {
    assert.ok(jsonBundle.includes(copyright), `JSON bundle is missing a copyright notice: ${copyright}`);
  }

  const qrBundle = readFileSync("js/qrcode-tool.bundle.js", "utf8");
  const qrBanner = buildLicenseBanner({
    title: "二维码工具构建产物",
    packages: QRCODE_BUNDLED_PACKAGES,
  });
  assert.ok(qrBundle.startsWith(qrBanner), "QR bundle does not start with the license banner");
  for (const { copyright } of QRCODE_BUNDLED_PACKAGES) {
    assert.ok(qrBundle.includes(copyright), `QR bundle is missing a copyright notice: ${copyright}`);
  }
});

function escapeAngleBrackets(text) {
  return text.replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

test("two consecutive Rollup builds emit byte-identical bundles", () => {
  execFileSync("npm", ["run", "build:json"], { stdio: "ignore" });
  const firstJson = readFileSync("js/json-workbench.bundle.js");
  const firstQr = readFileSync("js/qrcode-tool.bundle.js");
  execFileSync("npm", ["run", "build:json"], { stdio: "ignore" });
  const secondJson = readFileSync("js/json-workbench.bundle.js");
  const secondQr = readFileSync("js/qrcode-tool.bundle.js");
  assert.deepEqual(secondJson, firstJson);
  assert.deepEqual(secondQr, firstQr);
});
