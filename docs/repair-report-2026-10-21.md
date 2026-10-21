# 2026-10-21 项目修复报告

- JWT 签名内容写入 `#signatureBody`，保留区块标题；JWT 与 Base64 从 iframe 跳转 JSON 时优先导航同源顶层窗口，无法访问顶层时回退当前窗口。
- JSON 工作台暴露实际 CodeMirror view；JSON→JWT 将原始 JSON 写入一次性 sessionStorage key，JWT 端读取后立即消费、校验 JSON 对象、填入生成器并切换到“生成”。无效输入会被丢弃并提示。
- 搜索看板生成器、现有产物和 README 都明确当前为模拟演示样本；本轮没有接入或伪造真实 Search Console 数据。
- 首访 Tour 改为首页按钮主动开启，仍保留“跳过引导”；路线图和贡献规范同步为不自动遮挡的约定。
- 补充实际执行 `js/toast.js` 的 Node/VM 回归；新增现有 Playwright 依赖的无障碍与 DOMContentLoaded 基线门禁并接入 CI。工作流未在本轮外部运行。
- 已保留既有交接文档和 `handover-privacy.test.mjs` 脱敏改动；脱敏测试描述的是公开文档中主机路径/IP 的暴露，不把该类信息表述为凭据泄露。
