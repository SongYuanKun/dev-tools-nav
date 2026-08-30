#!/usr/bin/env node
/**
 * build-search-console.mjs  OP-201
 *
 * 读取 logs/search-queries.json → 在仓库根生成 /search-console.html：
 *   - 表 1：Top 查询（曝光或点击降序）
 *   - 表 2：CTR 低（有曝光但点击率 < 1%），建议优化标题摘要
 *   - 表 3：曝光高（>= 500）无匹配工具 → 自动生成 .github/ISSUE_TEMPLATE/search-gap.yml
 *   - 表 4：无匹配工具清单（hasMatchingTool=false），附一键提 Issue 按钮
 *
 * 非构建错误 fail-closed：
 *   - search-queries.json 无法 parse → process.exit(1)
 *   - 至少 20 条查询且 hasMatchingTool=false 至少 5 条 → 否则 WARN
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(__dirname, '..')
const DATA_PATH = join(ROOT, 'logs', 'search-queries.json')
const OUT_HTML = join(ROOT, 'search-console.html')
const OUT_ISSUE_TEMPLATE = join(ROOT, '.github', 'ISSUE_TEMPLATE', 'search-gap.yml')
const BASE_URL = 'https://tools.songyuankun.top'

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
function fmtPct(n) { return (Number(n || 0) * 100).toFixed(2) + '%' }
function fmtNum(n) { return Number(n || 0).toLocaleString('zh-CN') }
function ymld(s) { return String(s).replace(/\n/g, '\n  ') }

function loadQueries() {
  if (!existsSync(DATA_PATH)) {
    console.error('[search-console] FATAL: logs/search-queries.json 不存在，path=', DATA_PATH)
    process.exit(1)
  }
  let parsed
  try { parsed = JSON.parse(readFileSync(DATA_PATH, 'utf-8')) }
  catch (e) {
    console.error('[search-console] FATAL: search-queries.json parse 失败：', e.message)
    process.exit(1)
  }
  const list = Array.isArray(parsed?.queries) ? parsed.queries : null
  if (!list || list.length < 20) {
    console.warn(`[search-console] WARN: 查询不足 20 条（当前 ${list?.length ?? 0}）`)
  }
  const noMatch = list.filter(q => q.hasMatchingTool === false)
  if (noMatch.length < 5) {
    console.warn(`[search-console] WARN: hasMatchingTool=false 不足 5 条（当前 ${noMatch.length}）`)
  }
  return { meta: { generatedAt: parsed?.generatedAt ?? new Date().toISOString().slice(0, 10), total: list.length, noMatch: noMatch.length }, queries: list }
}

function row(q, rank) {
  const matchClass = q.hasMatchingTool ? '' : ' class="sc-row-gap"'
  const pill = q.hasMatchingTool
    ? `<span class="sc-pill sc-pill-match">已匹配</span>`
    : `<span class="sc-pill sc-pill-gap">缺口</span>`
  return `<tr${matchClass}>
    <td>${rank}</td>
    <td><code>${esc(q.query)}</code> ${pill}</td>
    <td>${fmtNum(q.clicks)}</td>
    <td>${fmtNum(q.impressions)}</td>
    <td>${fmtPct(q.ctr)}</td>
    <td>${Number(q.position || 0).toFixed(1)}</td>
    <td><a href="${esc(q.page.startsWith('http') ? q.page : BASE_URL + q.page)}" target="_blank" rel="noopener noreferrer">${esc(q.page)}</a></td>
    <td>${(q.tags || []).map(t => `<span class="sc-tag">${esc(t)}</span>`).join(' ')}</td>
  </tr>`
}

function table(title, subtitle, arr, rankDesc) {
  if (!arr.length) {
    return `<section class="sc-panel"><h2>${esc(title)}</h2><p class="sc-sub">${esc(subtitle)}</p><div class="sc-empty">（暂无数据）</div></section>`
  }
  const body = arr.map((q, i) => row(q, rankDesc ? (arr.length - i) : (i + 1))).join('')
  return `<section class="sc-panel">
    <h2>${esc(title)} <span class="sc-count">${arr.length}</span></h2>
    <p class="sc-sub">${esc(subtitle)}</p>
    <div class="sc-table-wrap"><table class="sc-table">
      <thead><tr><th>#</th><th>查询词</th><th>点击</th><th>曝光</th><th>CTR</th><th>排名</th><th>落地页</th><th>标签</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>
  </section>`
}

function renderHtml({ meta, queries }) {
  const top = [...queries].sort((a, b) => (b.impressions * 10 + b.clicks) - (a.impressions * 10 + a.clicks)).slice(0, 10)
  const lowCtr = queries.filter(q => Number(q.impressions) >= 100 && Number(q.ctr) < 0.01)
    .sort((a, b) => a.ctr - b.ctr)
  const highExpoNoMatch = queries.filter(q => q.hasMatchingTool === false && Number(q.impressions) >= 500)
    .sort((a, b) => b.impressions - a.impressions)
  const noMatch = queries.filter(q => q.hasMatchingTool === false)
    .sort((a, b) => (b.impressions + b.clicks * 20) - (a.impressions + a.clicks * 20))

  return `<!doctype html>
<html lang="zh-CN" data-theme="light">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>搜索意图复盘看板 | Koen的工具箱</title>
  <meta name="description" content="Search Console 运营复盘：Top 查询、低 CTR 优化、工具缺口治理。纯静态生成，数据不出本地。" />
  <link rel="canonical" href="${BASE_URL}/search-console.html" />
  <link rel="icon" href="/assets/logo.svg" type="image/svg+xml" />
  <style>
    :root{color-scheme:light dark;--bg:#f7f8fa;--fg:#1f2937;--muted:#6b7280;--border:#e5e7eb;--primary:#2563eb;--gap:#fee2e2;--match:#dcfce7;--accent:#dbeafe;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif}
    @media (prefers-color-scheme:dark){:root{--bg:#0b1020;--fg:#e5e7eb;--muted:#94a3b8;--border:#1f2937;--gap:#3f1d1d;--match:#0f2a1a;--accent:#1e3a8a;color-scheme:dark}}
    *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);line-height:1.6}
    .sc-wrap{max-width:1200px;margin:0 auto;padding:28px 20px 80px}
    .sc-hero{border:1px solid var(--border);border-radius:16px;padding:20px 22px;background:linear-gradient(180deg,var(--accent),transparent 60%)}
    .sc-hero h1{margin:0 0 6px;font-size:24px}
    .sc-hero p{margin:4px 0;color:var(--muted)}
    .sc-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:16px 0 24px}
    .sc-stat{border:1px solid var(--border);border-radius:12px;padding:12px 14px;background:var(--bg)}
    .sc-stat b{display:block;font-size:20px;margin-bottom:2px}.sc-stat span{color:var(--muted);font-size:13px}
    .sc-panel{border:1px solid var(--border);border-radius:16px;padding:18px 18px 22px;margin:18px 0;background:var(--bg)}
    .sc-panel h2{margin:0 0 4px;font-size:18px;display:flex;align-items:center;gap:8px}
    .sc-count{font-size:12px;padding:2px 8px;border-radius:999px;background:var(--accent);color:var(--primary);font-weight:600}
    .sc-sub{margin:0 0 14px;color:var(--muted);font-size:13px}
    .sc-table-wrap{overflow:auto;border:1px solid var(--border);border-radius:12px}
    .sc-table{width:100%;border-collapse:collapse;font-size:13px}
    .sc-table th,.sc-table td{padding:10px 12px;border-bottom:1px solid var(--border);text-align:left;vertical-align:top;white-space:nowrap}
    .sc-table th{background:var(--bg);color:var(--muted);font-weight:600;position:sticky;top:0}
    .sc-row-gap{background:var(--gap)}
    .sc-pill{display:inline-block;font-size:11px;padding:2px 8px;border-radius:999px;font-weight:600;margin-left:6px}
    .sc-pill-match{background:var(--match);color:#166534}
    .sc-pill-gap{background:var(--gap);color:#991b1b}
    .sc-tag{display:inline-block;font-size:11px;padding:1px 6px;border-radius:6px;border:1px solid var(--border);color:var(--muted);margin-right:4px}
    .sc-empty{padding:24px;text-align:center;color:var(--muted);border:1px dashed var(--border);border-radius:12px}
    .sc-foot{color:var(--muted);font-size:12px;margin-top:16px;text-align:center}
    .sc-foot a{color:var(--primary)}
    .sc-gap-cta{display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:8px 12px;border-radius:10px;background:var(--gap);color:#991b1b;font-weight:600;text-decoration:none;border:1px solid transparent}
    @media (max-width:720px){.sc-stats{grid-template-columns:repeat(2,1fr)}}
  </style>
</head>
<body>
<div class="sc-wrap">
  <header class="sc-hero">
    <h1>🔍 搜索意图复盘看板</h1>
    <p>数据周期：<b>${esc(meta.generatedAt)}</b> · 来源：<code>logs/search-queries.json</code> · 站点：${BASE_URL}</p>
    <p>治理规则：<b>曝光 ≥ 500 且 CTR < 1% 的缺口查询</b> 自动生成 Issue 模板，按需一键录入路线图。</p>
  </header>

  <div class="sc-stats">
    <div class="sc-stat"><b>${fmtNum(meta.total)}</b><span>查询词总数</span></div>
    <div class="sc-stat"><b>${fmtNum(meta.noMatch)}</b><span>工具缺口数</span></div>
    <div class="sc-stat"><b>${fmtNum(queries.reduce((s,q)=>s+Number(q.clicks||0),0))}</b><span>总点击</span></div>
    <div class="sc-stat"><b>${fmtNum(queries.reduce((s,q)=>s+Number(q.impressions||0),0))}</b><span>总曝光</span></div>
  </div>

  ${table('① Top 查询', '按曝光×10 + 点击加权取前 10，作为判断搜索意图的基准样本。', top)}
  ${table('② CTR 低（优化标题/摘要）', '曝光 ≥ 100 但 CTR < 1%。先改 meta title/description 与首屏 H1/H2 对齐意图。', lowCtr)}
  ${table('③ 高曝光 · 无匹配工具（强信号 Gap）', '曝光 ≥ 500 且未匹配站内工具。下方 Issue 模板已自动生成。', highExpoNoMatch)}
  ${table('④ 全部无匹配查询', '按「曝光 + 点击×20」加权排序，决定路线图下一个自研工具优先级。', noMatch)}

  <div class="sc-panel" style="background:var(--gap)">
    <h2>🧭 运营动作建议</h2>
    <p class="sc-sub">按 DoD 顺序执行，完成 1 条划 1 条。</p>
    <ol>
      <li><b>② 低 CTR</b>：每条落地页 <code>title/description/h1</code> 对齐查询词意图，两周后复查 CTR 是否 ≥ 1.5%。</li>
      <li><b>③ 高曝光 Gap</b>：点 <a class="sc-gap-cta" href="https://github.com/SongYuanKun/dev-tools-nav/issues/new?template=search-gap.yml&amp;title=%5BSearch+Gap%5D+${encodeURIComponent(highExpoNoMatch[0]?.query || '高曝光缺口查询')}" target="_blank" rel="noopener noreferrer">📝 录入 1 条 Search Gap Issue</a>，评估自研 vs 外链策略。</li>
      <li><b>④ 缺口排序</b>：连续 2 个周期仍在 Top 10 → 进路线图 Sprint 候选池，附收益测算（新增有效使用/潜在 PV）。</li>
      <li><b>合规门禁</b>：缺口涉及「破解、绕过许可证」等灰色意图（如 md5 还原）→ 进入 Won't List，不落地但在看板显式标注。</li>
    </ol>
  </div>

  <p class="sc-foot">构建脚本：<code>scripts/build-search-console.mjs</code> · 数据：<code>logs/search-queries.json</code> · <a href="/">返回首页</a> · <a href="https://github.com/SongYuanKun/dev-tools-nav/blob/main/search-console.html" target="_blank" rel="noopener noreferrer">源码（blob/main）</a></p>
</div>
</body>
</html>`
}

function renderIssueTemplate(queries) {
  const noMatchList = queries.filter(q => q.hasMatchingTool === false)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10)
  const bodyHint = noMatchList.length
    ? noMatchList.map(q =>
        `- [ ] **${ymld(q.query)}**（曝光 ${q.impressions} · CTR ${fmtPct(q.ctr)} · 标签 ${(q.tags||[]).join(', ')}）`
      ).join('\n')
    : '- （暂无缺口数据）'
  return `name: Search Gap Report
description: 用于录入 Search Console 曝光高但站内无匹配工具的搜索缺口。
title: "[Search Gap] "
labels: ["search-gap", "roadmap-candidate"]
body:
  - type: markdown
    attributes:
      value: |
        ## 背景
        该 Issue 由 \`scripts/build-search-console.mjs\` 根据 \`logs/search-queries.json\` 自动生成，用于登记 Search Console 中有曝光但站内无匹配工具的查询。
  - type: input
    id: query
    attributes:
      label: 缺口查询词
      description: 来自 Search Console 的真实搜索查询（按曝光最高优先）。
      placeholder: "redis 在线 内存 分析"
    validations:
      required: true
  - type: dropdown
    id: strategy
    attributes:
      label: 处置策略
      description: 自研工具、补充外链、进入 Won't List（灰色）、或暂不处理。
      options:
        - "自研：新增站内工具（Vanilla JS/纯本地）"
        - "外链：在对应分类目录新增已存在的合规工具"
        - "Won't List：灰色/违法意图，不落地（例：破解、许可证绕过）"
        - "暂不处理：优先级低，下个周期再评估"
    validations:
      required: true
  - type: textarea
    id: rationale
    attributes:
      label: 收益测算与理由
      description: 例如「月曝光 760，CTR 0.13%，提升到 1% ≈ +6 点击/月 → 估算 15% 激活率 ≈ +0.9 effective_uses/月」。
      placeholder: "曝光 N 次 × 预期 CTR X% × 激活率 Y% = 新增有效使用次数 Z/月"
  - type: textarea
    id: candidates
    attributes:
      label: 候选高曝光 Gap 清单（脚本自动生成 TOP 10）
      description: 可复制勾选作为本期治理队列。
      value: |
        ${bodyHint}
  - type: checkboxes
    id: jb_oss
    attributes:
      label: JetBrains OSS 合规核查（任一 ❌ → Won't List）
      options:
        - label: "JB-01 非商业：无广告位、无付费、无联盟追踪参数"
          required: true
        - label: "JB-02 全开源：方案实现纯 MIT，无闭源/付费组件"
          required: true
        - label: "JB-04 隐私：工具计算不出浏览器，无第三方 SDK 追踪"
          required: true
`
}

function main() {
  const data = loadQueries()
  const html = renderHtml(data)
  mkdirSync(dirname(OUT_HTML), { recursive: true })
  writeFileSync(OUT_HTML, html, 'utf-8')
  console.log(`[search-console] HTML 生成：${OUT_HTML}（queries=${data.queries.length}, noMatch=${data.meta.noMatch}）`)
  mkdirSync(dirname(OUT_ISSUE_TEMPLATE), { recursive: true })
  writeFileSync(OUT_ISSUE_TEMPLATE, renderIssueTemplate(data.queries), 'utf-8')
  console.log(`[search-console] Issue 模板：${OUT_ISSUE_TEMPLATE}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()

export { loadQueries, renderHtml, renderIssueTemplate }
