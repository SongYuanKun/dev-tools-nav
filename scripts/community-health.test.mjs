import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import YAML from "yaml";

test("SUPPORT routes users to public questions and private security reports", () => {
  const support = readFileSync("SUPPORT.md", "utf8");

  assert.match(support, /\.github\/ISSUE_TEMPLATE\/question\.yml/);
  assert.match(support, /SECURITY\.md/);
  assert.match(support, /CONTRIBUTING\.md/);
});

test("question issue form collects context, attempted solutions, and environment", () => {
  const form = YAML.parse(readFileSync(".github/ISSUE_TEMPLATE/question.yml", "utf8"));
  const fields = new Map(form.body.filter((item) => item.id).map((item) => [item.id, item]));

  assert.equal(form.name, "❓ 使用问题");
  assert.equal(form.title, "[Question]: ");
  assert.deepEqual(form.labels, ["question", "triage"]);
  for (const id of ["question", "attempted", "environment", "expected"]) {
    assert.equal(fields.get(id)?.type, "textarea", `${id} must be a textarea`);
    assert.equal(fields.get(id)?.validations?.required, true, `${id} must be required`);
  }
});

test("README publicly acknowledges JetBrains non-commercial open-source support", () => {
  const readme = readFileSync("README.md", "utf8");

  assert.match(readme, /JetBrains-Non--Commercial%20Open%20Source/);
  assert.match(readme, /^## 🔧 致谢 · 开发工具支持$/m);
  assert.match(readme, /WebStorm \(Non-Commercial Open Source License\)/);
  assert.match(readme, /https:\/\/www\.jetbrains\.com\/community\/opensource\//);
  assert.doesNotMatch(readme, /PROGRESS-TRACKER\.md/);
});

test("README reports the same five-workday security response target as SECURITY", () => {
  const readme = readFileSync("README.md", "utf8");
  const security = readFileSync("SECURITY.md", "utf8");

  assert.match(security, /5 个工作日/);
  assert.match(readme, /5 个工作日/);
  assert.doesNotMatch(readme, /48h/);
});
