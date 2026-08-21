# 贡献指南

本项目是非商业开源项目，代码与站内原创内容以 [MIT 协议](LICENSE) 公开，欢迎任何人提交 Issue 与 Pull Request。

## 贡献范围

| 欢迎 | 不接受 |
|------|--------|
| 收录、更新或修正开发者工具条目 | 商业软件的破解、序列号与许可绕过类内容 |
| 改进 `/tools/*` 浏览器内自研工具 | 广告、联盟推广、付费排名与赞助位 |
| 撰写或校订 `content/blog/*.md` 原创文章 | 弹窗、遮挡、自动播放与诱导点击 |
| 修正文档、无障碍与性能问题 | 把用户输入上传到服务端的在线工具实现 |

阶段优先级与待办只在[产品路线图](docs/roadmap.md)维护，本文件不保存第二份计划。

## 本地运行

站点是纯静态实现，装好依赖后起一个静态服务即可：

```bash
npm ci
python3 -m http.server 8080   # 打开 http://127.0.0.1:8080
```

改动 HTML / CSS / JS 后刷新浏览器就能看到效果，无需额外构建。

## 提交前自查

```bash
npm test                 # node --test scripts/*.test.mjs
npm run audit:tools      # 校验目录数量、ID 唯一性与 canonical 路径
npm run check:generated  # 重新构建并检查生成物是否漂移
```

`npm test` 含浏览器回归，首次运行前需执行 `npx playwright install chromium`。

`sitemap.xml`、`feed.xml`、`pages/blog/*.html`、`data/blog-*` 与 `js/json-workbench.bundle.js` 都是构建产物：请修改源文件后用 `npm run build` 重新生成并一并提交，不要手工编辑生成物。

新增或删除工具时，README 顶部的 `<!-- catalog-total -->` 等计数标记也要同步更新，否则 `npm run audit:tools` 会失败。工具与分类的字段格式见 README 的「添加新工具」「添加新分类」两节。

## 提交与 Pull Request

- 一个提交只做一件事，commit message 说明**为什么**改，而不是复述改了哪些文件。
- 基于最新的 `main` 建分支，PR 提回 `main`；[测试工作流](.github/workflows/test.yml)会在 push 与 PR 上运行 `npm ci`、`npm test` 和 `npm run check:generated`，需要全部通过。
- 涉及界面的改动请在 PR 中附截图，截图生成步骤见 README 的「更新预览截图」。
