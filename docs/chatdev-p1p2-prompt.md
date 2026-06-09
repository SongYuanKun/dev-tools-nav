# ChatDev 任务提示词：个人IP站点迭代升级（P1+P2）

以下提示词直接粘贴到 ChatDev 前端 UI 的任务输入框中，使用 `general_problem_solving_team.yaml` 工作流。

---

## 提示词

```
我有一个个人IP开发者工具导航站（纯静态 HTML/CSS/JS，零构建零依赖），需要完成以下5项升级。请为每项输出完整可用的代码文件。

【项目信息】
- 站点名：Koen的工具箱（tools.songyuankun.top）
- 作者：Koen，Java后端7年，全栈独立开发者
- 技术栈：纯 HTML5 + CSS3 + Vanilla JS，零构建
- CSS变量体系：--color-primary:#6366f1, --bg-page:#f8fafc, --bg-card:#ffffff, --text-primary:#0f172a, --text-secondary:#64748b, --border-color:#e2e8f0, --radius-md:10px, --radius-sm:6px, --shadow-card, --transition:0.2s ease
- 暗色模式：[data-theme="dark"]
- 导航栏：工具导航 / 🤖 AI专题 / 在线工具 / 技术博客 / 作品集 / 关于我
- 路径规范：页面在pages/，数据在data/，CSS在css/，logo在assets/logo.svg

【任务1：Newsletter/邮件订阅入口组件】
创建一个可复用的邮件订阅组件，嵌入到首页底部和博客文章底部。

输出文件：components/newsletter.html（HTML片段 + 内联CSS + JS）

要求：
- 组件包含：标题"📬 订阅 Koen 的技术周刊"、副标题"每周精选工具推荐 + 独立开发心得，不定期发送，拒绝垃圾邮件"、邮箱输入框、订阅按钮
- 表单 action 指向 "https://formspree.io/f/YOUR_FORM_ID"（占位符，用户自行替换）
- 提交后显示"✅ 订阅成功！请查收确认邮件"
- 样式：卡片式设计，渐变背景（primary色系），白色文字，圆角，居中
- 响应式：移动端输入框和按钮竖排
- 暗色模式适配
- 输入验证：邮箱格式校验，按钮loading状态

【任务2：「关于我」页定位语优化】
重写 pages/about.html 的 Hero 区域文案，使其更具差异化。

输出：一段替换文案（不需要整个文件，给出 HTML 片段即可）

当前定位语："后端深耕7年，正在探索全栈与独立开发"
需要改为更锐利的定位，要求：
- 体现"源码级深度 × 独立开发实践 × 工具思维"的独特交叉点
- 不超过20个字的主标语
- 一句话副标语说明价值主张
- 3个标签重新设计（当前是：🧠 源码级探索者 / 🚀 独立开发实践者 / 💡 技术原理控）

【任务3：产品/副业入口突出 + 商业化路径】
升级 pages/products.html，从"即将上线"的占位状态变成有说服力的产品页。

输出文件：pages/products.html（完整HTML）

要求：
- Hero区：标题"技术深度 × 实战经验 = 可复用的知识产品"
- 产品卡片（3个）：
  1. 「Java 源码精读指南」电子书（开发中）- 从 MyBatis/Spring Boot/Redis 源码中提炼设计模式，面向3-5年Java开发者
  2. 「独立开发者启动模板」（筹备中）- 工具站脚手架 + SEO模板 + 部署方案，帮新手2小时搭好第一个站
  3. 「异步技术咨询」（可预约）- 1v1 代码审查/架构设计/副业规划，48h内异步文字回复
- 每个卡片：名称、描述、状态徽章（开发中/筹备中/可预约）、价格（待定/免费/¥199起）、CTA按钮
- 底部：信任指标（7年经验/19篇深度文章/5.9w+阅读）
- 底部：微信公众号引导（"关注「Koen的工具箱」第一时间获取上线通知"）
- 导航、页脚与全站一致
- SEO完整
- 复用CSS变量

【任务4：在线工具页SEO流量钩子优化】
升级 pages/tools/index.html 工具列表页的SEO和引流能力。

输出：pages/tools/index.html 需要添加/修改的代码片段

要求：
- 为每个工具子页面（json.html, regex.html, timestamp.html等）添加交叉引流区：
  - "你可能还需要"推荐模块（3个相关工具卡片链接）
  - "← 返回在线工具" + "更多开发工具 →"（链回主站）
  - **2026-06 已落地**：各 `pages/tools/*.html` 底部 `tool-footer-nav` 互链；JSON 工具已重构（实时校验、树形视图、行号定位）
- 在 tools/index.html 列表页添加：
  - 完整 JSON-LD（SoftwareApplication 类型，每个工具一个）
  - 每个工具卡片增加"免费在线使用"徽章
  - 底部 FAQ 折叠块（"这些工具免费吗？" / "数据会上传到服务器吗？" / "支持哪些浏览器？"），用 <details> 实现

【任务5：社交证明模块】
创建一个社交证明/推荐语组件，嵌入首页和关于页。

输出文件：components/testimonials.html（HTML片段 + 内联CSS + JS）

要求：
- 3条推荐语（虚拟但合理）：
  1. "工具整理得很全面，每个都有使用场景说明，比纯链接聚合有价值多了。" — 某独立开发者
  2. "MyBatis 源码那篇帮我搞懂了困扰半年的缓存问题，写得真好。" — 某3年Java后端
  3. "终于找到一个不花哨、加载快的工具导航，收藏了。" — 某前端工程师
- 卡片式横向滚动/网格布局
- 每张卡片：引用文字、作者名、作者身份标签
- 引号装饰（"）大字体背景
- hover微动效
- 响应式（移动端竖排）
- 暗色模式

【通用要求】
- 所有代码零依赖零构建，纯HTML/CSS/JS
- CSS使用上面列出的变量名
- 暗色模式通过 [data-theme="dark"] 实现
- 所有页面的导航栏链接统一：
  - ../../index.html（或../index.html取决于层级）→ 工具导航
  - ../ai/index.html → 🤖 AI专题
  - ../tools/index.html → 在线工具
  - ../blog/index.html → 技术博客
  - ../portfolio.html → 作品集
  - ../about.html → 关于我
- 新建完整页面需包含SEO（meta/og/twitter/canonical/JSON-LD）
- 代码块用反引号标注文件路径，方便我定位放置位置

请按任务编号依次输出每个文件的完整代码。
```

---

## 使用方式

1. 打开 http://localhost:5173
2. 选择工作流：`general_problem_solving_team.yaml`
3. 粘贴上面 ``` 之间的提示词
4. 运行，观看小人协作 🎉
5. 任务完成后，输出的文件在容器的 `/app/WareHouse/` 目录下

## 取回结果

任务完成后执行：
```bash
# 查看最新输出目录
docker exec chatdev_backend ls /app/WareHouse/ | sort | tail -1

# 复制文件到项目（替换 <dir> 为上一步的目录名）
docker cp chatdev_backend:/app/WareHouse/<dir>/code_workspace/ /tmp/chatdev-output/
```
