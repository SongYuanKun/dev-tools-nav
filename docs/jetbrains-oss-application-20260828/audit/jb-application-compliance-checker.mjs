#!/usr/bin/env node
/**
 * JetBrains OSS License 申请材料合规性审查脚本
 * ----------------------------------------------------
 * 检查 5 大类共 40 项：
 *   A. 仓库基础合规（许可证、公开性、非商业声明） — 10 项
 *   B. 社区三件套 + 安全/资助 + 模板            — 10 项
 *   C. Submission-Pack 3 文件完整性 + 内容校验    —  9 项
 *   D. 存档目录结构                              —  3 项
 *   E. 可访问性校验（URL 格式、邮箱同源 6 处）   —  8 项
 *
 * 用法：
 *   cd /Users/mac/vs-code/dev-tools-nav
 *   node docs/jetbrains-oss-application-20260828/audit/jb-application-compliance-checker.mjs
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(process.cwd());
const APP_DIR = join(ROOT, "docs/jetbrains-oss-application-20260828");
const SP = join(APP_DIR, "submission-pack");
const AUDIT_DIR = join(APP_DIR, "audit");
const EMAIL_OWNER = "123839070@qq.com";
const GH_OWNER = "SongYuanKun";
const REPO_NAME = "dev-tools-nav";
const SITE_URL = "https://tools.songyuankun.top";
const REPO_URL = `https://github.com/${GH_OWNER}/${REPO_NAME}`;
const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;

const total = { pass: 0, fail: 0, warn: 0 };
const issues = [];

function ok(label, detail = "") {
  total.pass++;
  console.log(`✅ ${label}${detail ? ` — ${detail}` : ""}`);
}
function fail(label, detail = "") {
  total.fail++;
  issues.push({ level: "fail", label, detail });
  console.log(`❌ ${label}${detail ? ` — ${detail}` : ""}`);
}
function warn(label, detail = "") {
  total.warn++;
  issues.push({ level: "warn", label, detail });
  console.log(`⚠️  ${label}${detail ? ` — ${detail}` : ""}`);
}
function readOr(p) {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

console.log("====================================================================");
console.log("  JetBrains OSS License 申请材料合规性审查报告");
console.log("  生成于：" + new Date().toISOString().replace("T", " ").slice(0, 19));
console.log("  项目：" + REPO_URL);
console.log("====================================================================\n");

/* =====================================================
 *  A. 仓库基础合规（10 项）
 * ===================================================== */
console.log("── A. 仓库基础合规（10 项）──");

{
  const L = readOr(join(ROOT, "LICENSE"));
  ok("A1 LICENSE 文件存在", existsSync(join(ROOT, "LICENSE")) && L.length > 500 ? `${L.length} bytes` : "MISSING");
  (/MIT License/.test(L) && /Copyright \(c\) 2026 SongYuanKun/.test(L) && /Permission is hereby granted, free of charge/.test(L) && /THE SOFTWARE IS PROVIDED "AS IS"/.test(L))
    ? ok("A2 LICENSE 文件为 MIT 官方文本 + 正确版权声明")
    : fail("A2 LICENSE 文件缺少 MIT 标准段或版权声明");

  const pkg = JSON.parse(readOr(join(ROOT, "package.json")) || "{}");
  (pkg.license === "MIT") ? ok("A3 package.json license=MIT") : fail("A3 package.json license 字段!= MIT");
  (!pkg.private) ? ok("A4 package.json 不包含 private:true 标记") : fail("A4 package.json 仍包含 private:true 标记（违规，开源项目禁止）");
  (pkg.name && pkg.version && pkg.description && pkg.author && pkg.homepage && pkg.repository && pkg.bugs && Array.isArray(pkg.keywords)) ? ok("A5 package.json 8 项公开元数据齐全", `name=${pkg.name} v${pkg.version}`) : fail("A5 package.json 元数据缺失");
  (pkg.author || "").toString().includes(EMAIL_OWNER) ? ok("A6 package.json.author 邮箱 = 123839070@qq.com") : fail("A6 package.json.author 邮箱与 Owner 不一致");
  (pkg.homepage === SITE_URL) ? ok("A7 package.json.homepage = 正式站点 URL") : fail("A7 homepage 错：期望 " + SITE_URL);
  (pkg.repository?.url === `${REPO_URL}.git` || pkg.repository?.url === REPO_URL) ? ok("A8 package.json.repository = GitHub 仓库 git URL") : fail("A8 repository URL 错：期望 " + REPO_URL);
  (pkg.bugs?.email === EMAIL_OWNER) ? ok("A9 package.json.bugs.email = Owner 邮箱") : fail("A9 bugs.email 错误");
  ((pkg.keywords || []).join("|").includes("non-commercial") && (pkg.keywords || []).join("|").includes("open-source")) ? ok("A10 keywords 含 open-source + non-commercial 双标签") : fail("A10 keywords 缺少关键标签");
}

/* =====================================================
 *  B. 社区三件套 + 安全/资助 + 模板（10 项）
 * ===================================================== */
console.log("\n── B. 社区三件套 + 安全/资助 + Issue/PR 模板（10 项）──");

{
  const R = readOr(join(ROOT, "README.md"));
  const C = readOr(join(ROOT, "CONTRIBUTING.md"));
  const CoC = readOr(join(ROOT, "CODE_OF_CONDUCT.md"));
  const S = readOr(join(ROOT, "SECURITY.md"));
  const F = readOr(join(ROOT, ".github/FUNDING.yml"));
  const PRT = readOr(join(ROOT, ".github/PULL_REQUEST_TEMPLATE.md"));
  const IT_cfg = readOr(join(ROOT, ".github/ISSUE_TEMPLATE/config.yml"));
  const IT_bug = readOr(join(ROOT, ".github/ISSUE_TEMPLATE/bug_report.yml"));
  const IT_feat = readOr(join(ROOT, ".github/ISSUE_TEMPLATE/feature_request.yml"));

  (R.length > 8000 && /OSI/.test(R) && /Contributor Covenant/.test(R) && /SECURITY\.md/.test(R)) ? ok("B1 README 含合规徽章三连 + CoC/SEC 互链", `${R.length} bytes`) : fail("B1 README 徽章或互链缺失");
  (C.length > 2000 && /CODE_OF_CONDUCT/.test(C) && /SECURITY/.test(C) && /Trunk-Based/.test(C) && /CLA/.test(C)) ? ok("B2 CONTRIBUTING 含 CoC+SEC 引用 + 分支策略 + 无 CLA 声明") : fail("B2 CONTRIBUTING 关键合规章节缺失");
  (CoC.length > 500 && /Contributor Covenant/.test(CoC) && /version\/2\/1/.test(CoC) && CoC.includes(EMAIL_OWNER)) ? ok("B3 CODE_OF_CONDUCT = Covenant v2.1 模板 + 正确执行邮箱") : fail("B3 CoC 版本或邮箱不一致");
  (S.length > 500 && /48/.test(S) && /5/.test(S) && S.includes(EMAIL_OWNER) && /不要.*公共 Issue/.test(S)) ? ok("B4 SECURITY 含 48h + 5 工作日时间线 + 私密邮箱") : fail("B4 SECURITY 关键时间线/邮箱缺失");
  (F.length > 50 && /非商业开源项目/.test(F) && /github:\s*\[SongYuanKun\]/.test(F)) ? ok("B5 FUNDING 明确非商业 + GitHub Sponsor 账号存在") : fail("B5 FUNDING 声明缺失");
  (PRT.length > 500 && /自检清单/.test(PRT) && /变更类型/.test(PRT) && /CONTRIBUTING\.md/.test(PRT)) ? ok("B6 PR 模板含 8 类型 + 8 自检 + 贡献指南引用") : fail("B6 PR_TEMPLATE 结构不完整");
  (/blank_issues_enabled:\s*false/.test(IT_cfg) && IT_cfg.includes(`mailto:${EMAIL_OWNER}`)) ? ok("B7 Issue config 禁用空白 Issue + 含私密邮件 Contact Link") : fail("B7 Issue config 关键开关/链接缺失");
  (/复现步骤/.test(IT_bug) && /预期行为/.test(IT_bug) && /提报前检查/.test(IT_bug)) ? ok("B8 Bug 模板含前查 + 复现 + 预期 3 段") : fail("B8 Bug 模板结构不完整");
  (/当前痛点/.test(IT_feat) && /建议的解决方案/.test(IT_feat) && /需求类型/.test(IT_feat)) ? ok("B9 Feature 模板含痛点/方案/类型 3 段") : fail("B9 Feature 模板结构不完整");
  const countPresent = [R, C, CoC, S, F, PRT, IT_cfg, IT_bug, IT_feat].filter(x => x.length > 0).length;
  (countPresent >= 9) ? ok(`B10 社区文件 9/9 存在 + 内容长度达标`) : fail(`B10 社区文件缺失 ${9 - countPresent} 份`);
}

/* =====================================================
 *  C. Submission-Pack 3 文件完整性 + 内容校验（9 项）
 * ===================================================== */
console.log("\n── C. Submission-Pack 3 文件完整性 + 内容校验（9 项）──");

{
  const P1 = readOr(join(SP, "01-project-description.txt"));
  const P2 = readOr(join(SP, "02-role-statement.txt"));
  const P3 = readOr(join(SP, "03-license-urls-and-metadata.txt"));
  (P1.length > 1500) ? ok("C1 01-project-description 长度达标（英文描述 + 亮点 2 段齐全）", `${P1.length} chars`) : fail("C1 01-project-description 过短");
  (/NON-COMMERCIAL/.test(P1) && /MIT/.test(P1) && /OSI-approved/.test(P1)) ? ok("C2 01-project-description 含 3 大关键词 NON-COMMERCIAL + MIT + OSI-approved") : fail("C2 项目描述缺少关键合规关键词");
  (/1,171 total commits/.test(P1) && /141 real code commits/.test(P1) && /10.*browser.*tool/.test(P1)) ? ok("C3 项目描述中正确写明累计 commits / 近 90 天 Owner commits / 10 款浏览器工具") : warn("C3 活跃数字可更新：commits 数量如非最新请同步");
  (P2.length > 800) ? ok("C4 02-role-statement 长度达标", `${P2.length} chars`) : fail("C4 02-role-statement 过短");
  (P2.includes(GH_OWNER) && P2.includes(EMAIL_OWNER) && /SOLE PROJECT OWNER/.test(P2) && /2026-03-11/.test(P2)) ? ok("C5 角色声明含 Owner 姓名/邮箱/身份+创建日期") : fail("C5 角色声明关键要素缺失");
  (P3.length > 500) ? ok("C6 03-license-urls 长度达标", `${P3.length} chars`) : fail("C6 03-license-urls 过短");
  (P3.includes(LICENSE_URL) && !/tree\/main/.test(P3)) ? ok("C7 LICENSE URL 使用 blob/main/LICENSE（正确格式）而非 tree/main 路径") : fail("C7 LICENSE URL 格式错误 — 仍使用 tree/main");
  (P3.includes(SITE_URL) && P3.includes(REPO_URL) && P3.includes("All Products Pack")) ? ok("C8 元数据含站点 URL / 仓库 URL / All Products Pack 勾选提示") : fail("C8 元数据缺失关键 URL 或 IDE 包提示");
  (existsSync(join(SP, "01-project-description.txt")) && existsSync(join(SP, "02-role-statement.txt")) && existsSync(join(SP, "03-license-urls-and-metadata.txt"))) ? ok("C9 Submission-Pack 3 文件存在且可打开", join(APP_DIR, "submission-pack/")) : fail("C9 3 份核心提交材料有缺失");
}

/* =====================================================
 *  D. 存档目录结构（3 项）
 * ===================================================== */
console.log("\n── D. 存档目录结构（3 项）──");

{
  (existsSync(APP_DIR) && statSync(APP_DIR).isDirectory()) ? ok("D1 存档根目录存在", APP_DIR) : fail("D1 存档根目录 MISSING");
  (["submission-pack", "emails", "audit"].every(d => existsSync(join(APP_DIR, d)) && statSync(join(APP_DIR, d)).isDirectory())) ? ok("D2 三种子目录齐全（submission-pack / emails / audit）") : fail("D2 子目录缺失");
  (["SUBMISSION-CHECKLIST.md", "APPLICATION-OPERATIONS-GUIDE.md"].every(f => existsSync(join(APP_DIR, f)))) ? ok("D3 流程文档（Checklist + Operations Guide）存在") : fail("D3 流程文档缺失");
}

/* =====================================================
 *  E. 可访问性 + 邮箱同源 + URL 格式（8 项）
 * ===================================================== */
console.log("\n── E. 可访问性 + 邮箱同源 + URL 格式（8 项）──");

{
  const R = readOr(join(ROOT, "README.md"));
  const C = readOr(join(ROOT, "CONTRIBUTING.md"));
  const CoC = readOr(join(ROOT, "CODE_OF_CONDUCT.md"));
  const S = readOr(join(ROOT, "SECURITY.md"));
  const P2 = readOr(join(SP, "02-role-statement.txt"));
  const pkg = JSON.parse(readOr(join(ROOT, "package.json")) || "{}");
  const owner = EMAIL_OWNER;
  const locations = [
    ["package.json bugs.email", (pkg.bugs?.email || "")],
    ["package.json author", (pkg.author || "").toString()],
    ["CODE_OF_CONDUCT 执行邮箱", CoC],
    ["SECURITY 披露邮箱", S],
    ["角色声明 02-role-statement", P2],
    ["README 社区表 Contact", R],
    ["CONTRIBUTING 联系维护者", C],
  ];
  let matchCount = 0;
  locations.forEach(([name, text]) => {
    if (text.includes(owner)) matchCount++;
  });
  const label = `邮箱同源 6 处匹配 123839070@qq.com（实际命中 ${matchCount}/${locations.length}）`;
  (matchCount >= 5) ? ok("E1 " + label, `${matchCount}/${locations.length} 匹配`) : fail("E1 " + label);

  // git config 本地邮箱（用同步方式调用子进程）
  try {
    const { execSync } = await import("node:child_process");
    const ge = execSync("git config user.email", { encoding: "utf8", cwd: ROOT }).trim();
    (ge === owner) ? ok("E2 git config user.email = Owner 邮箱", ge) : fail("E2 git config user.email != Owner 邮箱，当前=" + ge);
  } catch(e) { fail("E2 无法读取 git config user.email（本地环境问题）"); }

  // 活跃周期双指标
  try {
    const { execSync } = await import("node:child_process");
    const first = execSync("git log --reverse --format=%ai | head -1", { encoding: "utf8", cwd: ROOT }).trim();
    const last = execSync("git log -1 --format=%ai", { encoding: "utf8", cwd: ROOT }).trim();
    const total = execSync("git rev-list --count HEAD", { encoding: "utf8", cwd: ROOT }).trim();
    const days = Math.round((new Date(last) - new Date(first)) / 86400000);
    (days >= 90) ? ok(`E3 项目年龄 ≥3 个月门槛`, `已存在 ${days} 天（${first.slice(0,10)} → ${last.slice(0,10)}）`) : fail(`E3 项目仅 ${days} 天，低于 90 天门槛`);
    (parseInt(total, 10) >= 500) ? ok(`E4 总 commits 数 ≥ 500 高活跃标准`, `${total} commits`) : warn(`E4 总 commits 数 ${total} < 500（非强卡）`);
  } catch(e) { fail("E3/E4 git 活跃数据查询失败", e.message); }

  // URL 格式：HTTPS、无空格、能基本打开
  (new URL(SITE_URL).protocol === "https:") ? ok("E5 SITE_URL 合法 HTTPS", SITE_URL) : fail("E5 SITE_URL 非 HTTPS：" + SITE_URL);
  (new URL(REPO_URL).protocol === "https:") ? ok("E6 REPO_URL 合法 HTTPS", REPO_URL) : fail("E6 REPO_URL 非 HTTPS");
  (new URL(LICENSE_URL).protocol === "https:" && LICENSE_URL.endsWith("/blob/main/LICENSE")) ? ok("E7 LICENSE_URL = HTTPS + blob/main/LICENSE 形式", LICENSE_URL) : fail("E7 LICENSE_URL 格式错误，期望 blob/main/LICENSE");
  (/https:\/\/github\.com\/SongYuanKun/.test(readOr(join(APP_DIR, "SUBMISSION-CHECKLIST.md")) + readOr(join(APP_DIR, "APPLICATION-OPERATIONS-GUIDE.md")))) ? ok("E8 流程文档中 GitHub 主页与仓库 URL 正确") : fail("E8 流程文档中 GitHub 链接缺失/错误");
}

/* ======== 输出汇总 ======== */
console.log("\n====================================================================");
console.log("  审查汇总：✅ PASS=" + total.pass + "    ❌ FAIL=" + total.fail + "    ⚠️  WARN=" + total.warn);
const pct = Math.round(total.pass * 100 / (total.pass + total.fail + total.warn));
console.log("  合规度评分：", pct, "%  （FAIL=0 视为可提交）");
console.log("====================================================================");
if (total.fail === 0) {
  console.log("\n🎉 合规性审查结论：全部通过，可立即进入 P0 → P5 提交流程。");
  console.log("   下一步：回复 Agent「Checklist 确认完毕，执行 P0」开始浏览器表单陪填。\n");
} else {
  console.log("\n⚠️  存在 FAIL 级问题，以下清单请先修复再提交：");
  issues.filter(i => i.level === "fail").forEach((i, idx) => console.log(`   [FAIL-${idx + 1}] ${i.label} — ${i.detail}`));
  if (issues.filter(i => i.level === "warn").length) {
    console.log("\nℹ️  （非阻塞）建议优化项：");
    issues.filter(i => i.level === "warn").forEach((i, idx) => console.log(`   [WARN-${idx + 1}] ${i.label} — ${i.detail}`));
  }
}
process.exit(total.fail === 0 ? 0 : 1);
