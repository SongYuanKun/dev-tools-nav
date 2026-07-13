# Sitemap 可靠生成设计

## 背景

当前 Sitemap 存在两个相互关联的问题：

1. 生成器把首页和模板页的 `lastmod` 设为执行当天，把静态 HTML 的文件系统 `mtime` 设为更新时间。CI checkout 会重置文件系统时间，因此这些值不能稳定代表页面内容的真实更新时间，同一提交在不同日期构建也会产生不同结果。
2. GitHub Pages 在部署时运行 Sitemap 生成器，1Panel 工作流却直接发布仓库内的 `sitemap.xml`。两个 hostname 因而可能发布不同的 URL 集合与更新时间。

`lastmod` 必须表示页面最后一次重要内容更新，而不是 Sitemap 的生成时间。无法得到可信日期时，应省略该字段。

## 目标

- 同一 Git 提交连续生成得到字节级一致的 `sitemap.xml`。
- 每个 `lastmod` 都来自该 URL 对应内容源的最后 Git 提交日期。
- GitHub Pages 与 1Panel 使用同一生成器和同一映射规则。
- 保留当前 canonical URL、模板排除、XML 转义、排序和去重规则。
- 清除原工作区中仅由旧生成器日期漂移造成的未提交差异。

## 非目标

- 本任务不建立 Phase 2 Markdown 单一来源流水线。
- 不提交 Search Console、Bing Webmaster Tools 或索引 API 集成。
- 不改变站点 canonical hostname、URL 结构或工具目录。
- 不把 `changefreq`、`priority` 的清理扩展进本次修复。

## 设计

### 内容源映射

生成器先收集 URL 及其内容源相对路径，再由一个可注入的更新时间解析器返回 `YYYY-MM-DD`：

| URL 类型 | 内容源 |
|---|---|
| `/` | `index.html` |
| 普通静态页面 | 对应 `.html` 文件 |
| `/tools/<slug>/` | 对应 `tools/<slug>/index.html` |
| `/pages/template.html?id=<tool-id>` | `data/tools.js` |

默认解析器通过 Git 查询内容源最后一次提交日期。查询失败、输出为空或日期格式无效时返回空值；XML 中省略该 URL 的 `<lastmod>`，不得回退到执行当天或文件系统 `mtime`。

### 生成接口

`collectStaticUrls(root, options)` 接收可选的 `resolveLastmod(relativeSourcePath)`。测试可注入固定解析器，生产默认使用 Git 解析器。每个 URL 记录内部 `sourcePath` 只用于解析日期，不输出到 XML。

`generateSitemap(root, options)` 复用同一批 URL 数据生成 XML。命令行入口只收集一次，既写文件也用该结果输出 URL 数量，避免两次调用间产生差异。

### 部署一致性

- GitHub Pages 保留发布前生成步骤。
- 1Panel 在 rsync 前增加同一生成命令，确保发布的不是仓库中可能滞后的旧文件。
- 仓库继续跟踪 `sitemap.xml`，并提交一次由新生成器产生的基准结果，便于静态托管、代码审查和本地直接预览。

## 错误处理

- 单个内容源无法取得 Git 日期时，仅省略该 URL 的 `lastmod`，不阻断整个 Sitemap。
- Git 命令不可用时，所有 URL 仍正常输出，只是不包含不可信日期。
- URL 收集、工具目录解析或文件写入等结构性错误继续使命令失败，防止发布不完整 Sitemap。
- 日期解析器只接受 `YYYY-MM-DD`，其他格式视为不可用。

## 测试策略

按 TDD 分阶段建立以下契约：

1. 固定解析器能把首页、普通页面、自建工具页和模板页映射到正确内容源。
2. 解析器返回空值或无效日期时省略 `<lastmod>`。
3. 默认 Git 解析器返回内容源最后提交日期，而不是当前日期或文件 `mtime`。
4. 同一提交连续执行两次生成器，输出字节级一致且第二次不产生 Git 差异。
5. 工作流测试确认 GitHub Pages 与 1Panel 都在发布前运行生成器。
6. 全量 `npm test`、工具目录审计和构建保持通过，生成 URL 数量仍为 112。

## 落地与后续

实现通过后提交并直接更新 `main`，沿用非强制推送。推送前吸收远端自动同步提交并重新验证。原主工作区的旧 `sitemap.xml` 差异经确认仅为旧生成日期后恢复，使工作区回到干净状态；任何其他用户改动都必须保留。

完成本任务后，下一独立开发周期回到 Phase 1，优先验证截图 Actions 的真实运行记录，再决定是否将“截图自动化”与 Phase 1 总体验收标记为 `done`。
