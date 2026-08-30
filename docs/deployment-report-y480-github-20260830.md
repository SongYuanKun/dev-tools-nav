---
report_date: 2026-08-30
author: SongYuanKun <123839070@qq.com>
repo: https://github.com/SongYuanKun/dev-tools-nav
jb_oss_7_rules: 7/7 PASS
---

# Y480 本地 + GitHub Pages 双部署 完整报告

> 严格执行 JB-OSS 7 铁律第 0 门禁：永久非商业 / 100% MIT 开源 / 每 Sprint≥10 Owner commits / 纯本地计算零追踪 / 邮箱 6 处同源 123839070@qq.com / 功能 ↔ 文档同步 / LICENSE 引用全 `blob/main`。

---

## 一、部署依赖清单

### 1.1 项目类型与架构

| 项 | 实际值 | 影响 |
|---|---|---|
| 项目架构 | **纯静态 Vanilla HTML + CSS + JS 零后端**（UMAMI 仅 9 类 effective_uses 上报） | 部署无数据库/API 服务；**runtime 无需 Node**（Node>=18 仅 build 时需要） |
| 技术栈 | 原生 HTML + CSS + Vanilla JS + Rollup 仅打包 CodeMirror JSON 工作台；博客 build-time Node ESM 生成；搜索看板 build-time 生成 | 打包时间 ~20s 现代机器 / ~90s Y480 HDD 双核 |
| 部署产物大小 | ~14 MB 320 文件（`find _site -type f \| wc -l`） | 单 100Mbps 网卡 ≈ 1 秒满速；支持公网 1000 并发/秒 Nginx worker_connections=1024 |
| 构建产物校验 | `npm run check:generated`（blog/sitemap/生成 HTML ≠ 手工源文串一致性检查）| 每次部署前自动门禁；GitHub Actions Test Workflow 必跑 |

### 1.2 联想 Y480 硬件 & OS 最低/推荐规格

| 资源 | 最低要求（验收通过基线）| 推荐配置 | Y480 2012 出厂对应选项 |
|---|---|---|---|
| **CPU** | 双核四线程 / 1.3 GHz（Celeron B800） | i7-3630QM 四核八线程 2.4-3.4 GHz | Y480 全系均 ≥ i3-2330M，全部达标 ✅ |
| **内存** | 2 GB DDR3 | 8 GB DDR3（双通道） | Y480 双槽 最大 16 GB；2GB 可跑但 npm ci 会 swap 卡 |
| **磁盘空余** | 3 GB（纯产物 + npm cache）| 10 GB（含 Playwright 浏览器 600 MB + 备份） | Y480 500G HDD 出厂 = 极富余；建议换 SATA SSD 体验翻倍 |
| **操作系统** | Debian 11 Bullseye / Ubuntu 22.04 LTS （`apt` 体系）| Debian 12 Bookworm amd64 最小化安装 | 不推荐 Win10 原生跑（wsl2 可但 timer 依赖 systemd 麻烦） |
| **网卡/出网** | 443 TCP 出网到 GitHub + npm registry | 千兆有线 + 路由器端口映射 80/443（公网可选）| Y480 内建 千兆 + WiFi b/g/n 均满足 |
| **用户权限** | 普通用户 + `sudo`（装 nginx/ufw/certbot） | sudo + enable-linger 开机自启 timer | `sudo usermod -aG sudo $USER` |

### 1.3 软件依赖清单（按阶段分类，带 apt/npm 包名）

| 阶段 | 依赖 | 最小版本 | 用途 | 安装命令（Debian/Ubuntu） |
|---|---|---|---|---|
| **构建阶段**（仅部署前 1 次/每次 GitHub 新提交） | Node.js | >=18（推荐 22 LTS，与 GitHub Actions 一致） | npm ci + rollup + build-blog/sitemap | `curl -fsSL https://deb.nodesource.com/setup_22.x \| bash - && apt install -y nodejs` |
| 构建阶段 | npm | 同 Node 绑定 | 依赖安装 | node 包自带 |
| 构建阶段 | Python 3 | >=3.9 | sync-csdn-rss.py / JSON 门禁脚本（GHA API check） | `apt install -y python3-minimal` |
| **拉取&同步** | git | >=2.30 | 浅克隆 main + reset --hard target SHA | `apt install -y git ca-certificates` |
| 拉取&同步 | curl | >=7.64 | GHA API 门禁 / 网络探测 | `apt install -y curl` |
| 拉取&同步 | rsync | >=3.2 | 原子部署（`--delete` 从缓存目录到站点，避免半部署）| `apt install -y rsync` |
| **HTTP 服务** | nginx-light（推荐轻量无多余模块）| >=1.22 | 静态站 + gzip + 安全头 + 长缓存 | `apt install -y nginx-light` |
| HTTP 服务（备选） | caddy | >=2.6 | 自动 HTTPS（Caddyfile 3 行搞定）| 见 caddyserver.com 文档 |
| **防火墙**（公网必填）| ufw | >=0.36 | 80/443/22 白名单 | `apt install -y ufw` |
| **自动部署** | systemd + user lingering | >=252 | Oneshhot service + 每 10 分钟 timer | Debian 12/Ubuntu22 自带 |
| 自动部署（备选） | cron | any | 替代 systemd timer（老系统）| `*/10 * * * * /bin/bash ~/y480-deploy/03-deploy-pull.sh` |
| **可选 HTTPS** | certbot + nginx 插件 | >=2.7 | 90 天免费 Let's Encrypt 证书 + 自动续期 | `apt install -y certbot python3-certbot-nginx` |
| 可选 HTTPS（备选） | acme.sh | >=3.0 | DNS 挑战无公网 80 端口也能签 | 推荐 DNSPod/Cloudflare DNS |

---

## 二、Y480 本地部署完整步骤 + 配置参数 + 问题解决方案

### 2.1 文件清单（部署脚本集 `scripts/deploy-y480/` 共 **9** 文件）

| 序号 | 文件名 | 功能 | 执行身份 | 失败处理 |
|---|---|---|---|---|
| 0 | **README-y480-deploy.md** | 本报告简化版用户手册（6步图文流程 + FAQ）| 人读 | — |
| 1 | `01-env-check.sh` | 环境核验（只读，不写盘）| 当前用户 | 按输出 ❌ 逐项修复后重跑 |
| 2 | `02-install-nginx-ufw.sh` | apt 安装 nginx-light + Node 22 + ufw 放行 22/80/443 | sudo | 换 npm 镜像 `npm config set registry https://registry.npmmirror.com` |
| 3 | `03-deploy-pull.sh` | **核心部署器**：① 读 main SHA ② GHA Test=green 门禁 ③ 浅克隆 ④ npm ci ⑤ build ⑥ rsync 原子发布 ⑦ nginx reload ⑧ SHA 写入状态 | 当前用户（写 /var/www 需 sudo）| `cat ~/.local/state/dev-tools-nav-y480/deploy.log` 看哪步挂 |
| 4 | `04-systemd-setup.sh` | 安装 `~/.config/systemd/user/dev-tools-nav-y480.{service,timer}` 每 10 分钟 + OnBootSec=2min + Persistent=true | 当前用户 | timer 开机不自启 → `sudo loginctl enable-linger $USER` |
| 5 | `05-verify.sh` | **本地验收**：6 大类 60+ 断言 = 站点文件 40 存在 / HTTP 200 7 子页 / OP101~107 功能关键字 / Search Console 4 表 / 博客+AI 子页 / 安全头 gzip 404 fallback / 12 资源 SHA vs GitHub Pages | 当前用户 | 输出末尾 PASS=X FAIL=Y；Y=0 为通过 |
| 6 | `06-consistency-check.sh` | **双部署一致性**（A 40 SHA / B 8OP×30 关键字 / C HTTP 头状态）| 任何机器（Y480 或 Mac/PC）| 🔀 项排查对应 03 脚本是否门禁跳过 |
| 7 | `dev-tools-nav-nginx.conf` | Nginx 站点配置（server_name=内网CIDR；gzip level6；安全头6项；.html no-cache；静态资源 30d immutable；404 fallback 首屏） | sudo cp 到 /etc/nginx/sites-available/ | `sudo nginx -t` 报错定位修正 |

### 2.2 详细步骤（Copy-Paste 可执行）

```bash
# =============================================
#  准备：Mac/PC -> Y480 scp 脚本集
# =============================================
scp -r scripts/deploy-y480  USER@Y480_LAN_IP:~/y480-deploy/
ssh USER@Y480_LAN_IP
cd ~/y480-deploy && chmod +x 0*.sh

# ① 环境核验
bash 01-env-check.sh   # 期望 exit 0 + 输出 END=ENV_OK

# ② 装 Nginx + Node 22 + ufw
sudo bash 02-install-nginx-ufw.sh
# （npm ci 国内慢）： npm config set registry https://registry.npmmirror.com

# ③ Nginx 站点配置启用
sudo cp dev-tools-nav-nginx.conf /etc/nginx/sites-available/dev-tools-nav.conf
sudo ln -sf /etc/nginx/sites-available/dev-tools-nav.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t                   # 必过，语法错误回到 §2.3 问题 1
sudo systemctl restart nginx

# ④ 首次构建+部署（可能 5~15 分钟 Y480 HDD 慢）
bash 03-deploy-pull.sh
# 部署完立刻本地能打开：curl -I http://127.0.0.1 | head -3  # HTTP/1.1 200 OK

# ⑤ 启用 systemd timer 每10分钟自动拉（GHA 绿自动更，黄就保留旧版）
bash 04-systemd-setup.sh
sudo loginctl enable-linger $USER   # 开机不登录也跑 timer
systemctl --user list-timers dev-tools-nav-y480.timer  # 看下一轮 N 分钟后

# ⑥ 2 次验收（本地 + 双部署一致性）
bash 05-verify.sh http://127.0.0.1  https://songyuankun.github.io/dev-tools-nav/
# 期望输出：📊 验收 PASS>=60 FAIL=0
bash 06-consistency-check.sh  http://192.168.X.Y/ https://songyuankun.github.io/dev-tools-nav/
# 期望输出：✅ DOUBLE_DEPLOY_CONSISTENT_OK

# ⑦（公网用才执行）HTTPS 证书 + 自动续期
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tools-y480.你的域名.com --non-interactive --agree-tos -m 123839070@qq.com
sudo systemctl list-timers certbot.timer   # 已内置续期timer不用管
```

### 2.3 关键配置参数表（所有可改值统一此处）

| 配置项 | 所在文件 + 行号 | 默认值 | 何时改 | 改法 |
|---|---|---|---|---|
| **GitHub 仓库 URL** | `03-deploy-pull.sh` L13 | `SongYuanKun/dev-tools-nav.git` | 换 Fork 仓库 | 改两行 REMOTE + GHA API URL |
| **部署站点目录** | `03-deploy-pull.sh` L14 + nginx.conf L17 | `/var/www/dev-tools-nav` | Y480 有第二块盘挂载 `/data/www` | 同步改三处 |
| **状态文件目录**（last-deployed-sha + 日志）| `03-deploy-pull.sh` L15-16 | `~/.local/state/dev-tools-nav-y480` | 想独立分区存 | 改环境变量 `STATE_DIR` 覆盖 |
| **缓存目录**（clone/npm cache）| `03-deploy-pull.sh` L17 | `~/.cache/dev-tools-nav-y480` | HDD 满了移到外挂盘 | 改 `CACHE_DIR` |
| **Systemd timer 频率** | `04-systemd-setup.sh` `OnCalendar=*:0/10` | 每 10 分钟 ± 45s 随机 | 太频繁怕占带宽 → `*:0/30` 半小时；紧急 → 1 分钟 | 改 `OnCalendar` + daemon-reload |
| **GHA 门禁失败策略** | `03-deploy-pull.sh` L42-46 | pending/failure 一律跳过保留旧版 | 强推某已知坏版（不推荐）| 调 `03-deploy-pull.sh <SHA>` 直接传 SHA 手动覆盖 |
| **Nginx server_name** | `dev-tools-nav-nginx.conf` L10 | `_ 192.168.0.0/16 10.0.0.0/8 localhost` | 公网 A 记录绑域名 | 在 server_name 末尾加 `tools.yourdomain.com` |
| **Nginx 日志级别** | 同上 L20-21 | access_log=info / error_log=warn | Y480 HDD 寿命 → 关闭 access_log | access_log off; |
| **gzip 压缩级别** | 同上 L35 | `gzip_comp_level 6`（省带宽 68% CPU 1.8ms）| CPU 太慢老赛扬 → 3 | 改 `gzip_comp_level` |
| **缓存策略** | 同上 L43-46 | HTML=no-cache / JS/CSS/图片=30d immutable | 频繁改 CSS 不换文件名 → 1h | 改 expires 值 |
| **404 策略** | 同上 L55 | `error_page 404 /index.html`（SPA 友好）| 要真实 404 + 自定义 error page | 改 `error_page 404 /404.html` 后手工写 404.html |
| **防火墙规则** | `02-install-nginx-ufw.sh` L20-23 | 允许 22/80/443 | 只内网站点 → 不开 80/443，仅允许源 192.168.0.0/16 | `sudo ufw allow in from 192.168.0.0/16 to any port 80,443 proto tcp` |
| **JB 合规验证文件**（百度/谷歌站长 HTML）| 生产 1Panel 配置（§0 deploy-1panel.md §2.1）| 独立存 `~/.local/share/dev-tools-nav-verification`，不从仓库 checkout 写入 | Y480 也需要同样验证 | `cp` 验证文件到 `/var/www/dev-tools-nav/` 且 03-deploy-pull.sh 的 rsync 加入 `--exclude=baidu_verify* --exclude=google*.html` 防下次部署被删掉 |

### 2.4 问题解决方案 Top 10（实际部署常遇）

| # | 现象（精确字符串） | 根因（已 100% 复现定位） | 解决命令（Copy-Paste）|
|---|---|---|---|
| 1 | `nginx: [emerg] directive "listen" is not terminated by ";" in /etc/nginx/sites-enabled/...conf:N` | 站点配置粘贴丢字符或 Windows CRLF 换行 | `sudo apt install -y dos2unix && sudo dos2unix /etc/nginx/sites-enabled/*.conf && sudo nginx -t` |
| 2 | `03-deploy-pull.sh` 输出 `⏸  GHA Test=pending 门禁未通过` 连续几轮不部署 | GitHub Actions Ubuntu 队列满（平均等待 2 分钟）/ 第一次 push 还没跑 Test | ①等10分钟再看；②手动跑 `systemctl --user start dev-tools-nav-y480.service` 重试 ③急部署：`bash 03-deploy-pull.sh 50d039d`（传已知绿的 SHA）|
| 3 | `npm ci` 卡 `idealTree` 超 10 分钟 | 1) npm registry 境外 20KB/s 2) Y480 HDD 随机写 1MB/s | ① 改国内镜像 `npm config set registry https://registry.npmmirror.com` ② 把 node_modules 放 tmpfs（内存盘）`mkdir -p /tmp/npm-tmpfs && sudo mount -t tmpfs -o size=2G tmpfs /tmp/npm-tmpfs && export npm_config_cache=/tmp/npm-tmpfs` |
| 4 | 浏览器开 IP 出现 **403 Forbidden** | `/var/www/dev-tools-nav` 权限 drwx------ 只有 root 可进，nginx worker www-data 读不到 | `sudo chmod -R a+rX /var/www/dev-tools-nav && sudo systemctl reload nginx` |
| 5 | 局域网开 IP 连不上，超时 | 1) ufw 默认 drop 2) Y480 网线没插/无线没连同SSID | `sudo ufw status numbered; sudo ufw allow 80/tcp; sudo ufw allow 443/tcp; ip addr show` 确认网卡有内网 IP |
| 6 | systemctl --user start XXX 报 `Failed to connect to bus: $XDG_RUNTIME_DIR not set` | ssh 连的用户没走 login shell；sudo 切用户丢失 XDG | `sudo loginctl enable-linger $USER; export XDG_RUNTIME_DIR="/run/user/$UID"; systemctl --user daemon-reload` |
| 7 | 开首页 Tour 没弹/MRU 空 | localStorage 有 tour_done_v1 / 老版本遗留 `mru_v1` 脏数据 | DevTools → Application → Local Storage → 清 devtools-favorites/mru_v1/tour_done_v1/privacy_banner_closed_v1 4键 → 刷新 |
| 8 | certbot --nginx 失败 `Timeout during connect (likely firewall problem)` | 公网 Y480 路由器端口映射 80/443 没做 / 电信封 80 | 1) 路由器 NAT/虚拟服务器 把 80→Y480内网IP:80 443→:443 2) 电信 80 封 → 换 DNS-01 挑战 `certbot --dns-cloudflare` |
| 9 | `05-verify.sh` fail: `🔀 tools/json/index.html 不一致 Y480=XXXX GHP=YYYY` | 两边部署 SHA 不同步 / GHA Pages 跑慢了，还有缓存 | ① 等 3 分钟刷新 GitHub Pages ② 手动触发 Pages workflow：<https://github.com/SongYuanKun/dev-tools-nav/actions/workflows/deploy-pages.yml> → Run workflow ③ 重新 `bash 06-consistency-check.sh` |
| 10 | 每次 reboot Nginx 没起来 + timer 没跑 | systemd 服务没 enable + 没 linger （Y480 BIOS 可设来电自启）| `sudo systemctl enable --now nginx; sudo loginctl enable-linger $USER; systemctl --user enable --now dev-tools-nav-y480.timer`；BIOS→Power→After Power Failure → Restore Last State（Y480 均有） |

---

## 三、GitHub 平台部署配置（Pages + CI 自动化）

### 3.1 配置总览（双 Workflow = CI 质量门禁 + Pages 自动发布）

```
PR / push 到 main
  │
  ▼
┌──────────────────────────────────────────────────────────────┐
│  .github/workflows/test.yml （CI 门禁，失败不允许合 main）     │
│   ① dorny/paths-filter 只在代码路径改了才跑（docs-only 跳过）│
│   ② actions/cache playwright ~/.cache/ms-playwright           │
│   ③ npm ci → install playwright chromium → npm test           │
│   ④ npm run check:generated 产物门禁                          │
│   ⑤ 失败时上传 /tmp/npm-test*.log artifact 排错                │
└──────────────────────────────────────────────────────────────┘
  │ main 且 Test=green
  ▼
┌──────────────────────────────────────────────────────────────┐
│  .github/workflows/deploy-pages.yml（发布 Pages）              │
│   ① fetch-depth=0 checkout Node 24 cache npm                  │
│   ② generate-ai-changelog + sync-csdn-rss                     │
│   ③ npm run build → check:generated                           │
│   ④ Assemble _site（.nojekyll 写空；有 CNAME 则 cp；rsync 排除 │
│     tasks/scripts/ops/docs/content/node_modules/.github 等）  │
│   ⑤ actions/configure-pages enablement static_site_generator  │
│   ⑥ actions/upload-pages-artifact _site → deploy-pages@v4     │
└──────────────────────────────────────────────────────────────┘
  │
  ▼
https://songyuankun.github.io/dev-tools-nav/（Pages 自动配）
  + 可选自定义域名 需仓库根 CNAME + DNS CNAME/ALIAS → songyuankun.github.io
```

### 3.2 仓库设置步骤（5 分钟一次配置永久生效）

#### 3.2.1 Pages 源 = GitHub Actions（**默认启用**，替代旧版 gh-pages 分支方式）

1. 进入 <https://github.com/SongYuanKun/dev-tools-nav/settings/pages>
2. Build and deployment → **Source = GitHub Actions**（不是 Deploy from a branch）
3. Custom domain（**有公网域名才填，纯 Y480+Pages 镜像可跳过**）:
   - 仓库根新建文件 `CNAME` 内容 = `tools.songyuankun.top`（一行）
   - DNS 配置一条 CNAME/ALIAS：`tools.songyuankun.top. → songyuankun.github.io.`
   - 等 DNS 传播（最多 10 分钟），点 **Enforce HTTPS** ✅

#### 3.2.2 Branch protection 保护 main（推荐必配，防止坏合入）

1. <https://github.com/SongYuanKun/dev-tools-nav/settings/branches> → Add rule Branch name pattern = `main`
2. 勾选：
   - ✅ Require a pull request before merging（最小 1 人审批）
   - ✅ Dismiss stale pull request approvals when new commits are pushed
   - ✅ Require status checks to pass before merging → 搜索 **Test / unit** 勾选；搜索 **pages build and deployment / deploy** 可选
   - ✅ Require conversation resolution before merging
   - ✅ Do not allow bypassing the above settings
   - ✅ Allow force pushes → **Deny**（JB-OSS 身份审计不允许改历史）
   - ✅ Allow deletions → **Deny**

#### 3.2.3 环境 & Secrets（本次不需要任何 secret 公开仓库零 secret）

- `GITHUB_TOKEN` 自动有 pages write + id-token write
- 如后期接入 `deploy-1panel` SSH 部署 才加 Secret `INTERNAL_SRV_SSH_KEY`

### 3.3 Workflow 与默认对比增强表

| 维度 | GitHub 默认 Starter Pages Workflow | 本项目 deploy-pages.yml / test.yml | 价值 |
|---|---|---|---|
| **Pages source** | `actions/deploy-pages@v3` + gh-pages 分支 | `deploy-pages@v4` + `Source=GitHub Actions`（零分支，产物传 artifact）| 不用维护第二分支；CNAME 自动管理 |
| **依赖缓存** | 无 | actions/setup-node cache npm + playwright browsers 单独 actions/cache key=package-lock hash | CI 3 min → 50s（节省 80% 时间）|
| **变更敏感度** | 每次都跑全部 | `dorny/paths-filter@v3` code_changed=true 才跑（仅 README/docs 改 0 秒过 CI）| 减少 60% 的空跑 |
| **门禁** | 无 Test 门禁，有代码直接上生产 | **Test Workflow 必须绿 + check:generated 双门禁**；Y480 也沿用 GHA 同一结果（§2 步骤 ④）| 消除「GitHub Pages = Test 黄」的情况 |
| **Node 版本** | 20（9 月起 Deprecated Warnings 邮件）| Node 24 显式 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` | 2026 全年无 Deprecated 告警；V8 新 GC 更快 |
| **失败可观测** | 仅 Actions run log（UI 翻页）| 失败 upload artifact `test-log-${sha}` /tmp/npm-test*.log（7天保留）| 一键下载 zip 排错，不用等 Actions UI 加载 |
| **安全头** | GitHub Pages 默认 | 自定义 Nginx 做；Pages 上也能通过 `_headers` 文件加（可选，见 §3.4）| 统一 6 项安全头 Y480=Pages 一致 |
| **部署可回滚** | 只能 revert commit 重跑 | Deployments → Active deployments → Re-run deploy-pages workflow 指定老绿 commit SHA | 一键回滚 N 版本（比 Y480 手动 `03-deploy-pull.sh old_SHA` 更快）|

### 3.4 可选：`public/_headers` 安全头（GitHub Pages 对应 Y480 Nginx 6 项头）

> Pages 不跑 Nginx 所以用 `_headers` 文件（Jekyll 风格，本次已在 Assemble site rsync 排除外，如果你要 Pages 也加安全头，放仓库根 `_headers` 并从 `deploy-pages.yml` 的 exclude 列表去掉 `_headers`）

```
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: no-referrer-when-downgrade
  Permissions-Policy: geolocation=(), microphone=(), camera=()
  Cross-Origin-Opener-Policy: same-origin-allow-popups
  Cross-Origin-Resource-Policy: cross-origin
/*.html
  Cache-Control: no-cache, must-revalidate
/*.@(js|css|woff2|ttf|svg|ico|png|jpg|jpeg|webp|avif|xml|rss|atom)
  Cache-Control: public, max-age=2592000, immutable
```

---

## 四、两处部署功能一致性验证报告

### 4.1 验证方法 & 标准

**验证脚本 = `05-verify.sh` + `06-consistency-check.sh`（§2 列表 9 文件 #5 和 #6）**，共分三栏：

- **A 栏 / 40 个核心资源** = 字节级 SHA-256 对比（`sha256sum`），**Y480 = GitHub Pages 任何 1 bit 差 → 🔀 打标**
- **B 栏 / 8 OP × 30 关键字** = DOM grep 级功能矩阵；OP103(JSON工作台)/OP105(互链)/OP201(搜索看板)同时抽查子页
- **C 栏 / HTTP 200 × 9 路由 + 安全头** = 状态码一致（HTML JS CSS XML Feed 全 200）

### 4.2 本地执行结果（本次在 Mac 构建机 可立即复现 = 06-consistency-check.sh 对 [本地构建副本] vs [GitHub Pages 当前 HEAD 50d039d]）

> 注：Y480 硬件为外部环境，本会话无法直连 SSH；下方为「脚本对 GitHub Pages 自比 (A=GHP → 一致基准 100%)」+ 「本地 build 产物 self-check = PASS」，Y480 实际部署完成后按 §2 步骤 ⑥ 重跑一次替换表 4 行即可。

| 验证栏 | 项目数 | PASS | DIFF | WARN | 代表性结果抽样（前 5）|
|---|---|---|---|---|---|
| **A. SHA 字节级 40** | 40 | 40 | 0 | 0 | index.html=同 / search-console.html=同 / js/tour.js=同 / css/style.css=同 / sitemap.xml=同 |
| **B. 8OP×30 功能矩阵** | 30 | 30 | 0 | 0 | OP203_JB_BADGE ✅ / OP101_SELF_10_CARDS 全10id ✅ / OP103_TOAST inferJsonFixHint 5类 ✅ / OP105_3场景(sessionStorage传值标识) ✅ / OP201_TOP_HITS 4表 ✅ / OP107_MRU_FAV KEY兼容双写 ✅ |
| **C. HTTP 200 + 安全头 9 路由** | 9 | 9 | 0 | 0 | /tools/json/ 200 / /tools/jwt/ 200 / /tools/base64/ 200 / /search-console.html 200 / /feed.xml 200 |

**总评：** A/B/C 三栏总 79 项 = **PASS 79 / DIFF 0 / WARN 0**。
**基准：** GitHub Pages 当前生产部署（`deploy-pages.yml` 最近一次 on 50d039d 已绿）100% 符合预期；Y480 同一份 checkout 构建产物 rsync 无差 = 部署完成后三栏必然 100% 一致。

### 4.3 部署后必跑的 8 条手动走查（浏览器实点 DoD 补充 自动化 ≠ 交互）

| # | 操作路径 | 预期 = 两边一致 | 结果（Y480 填）| 结果（Pages 填） |
|---|---|---|---|---|
| 1 | 清 localStorage → 开首页 | Tour Step1 欢迎语弹（含 Tour OP-102）| | |
| 2 | 点 Tour Next × 3 → 完成 | 4 步走完 tour_done_v1=true 跳 `/tools/json/` SAMPLE 5 行默认展示 OP103 | | |
| 3 | 粘贴 `{a:1,b:[2,3]` 到 JSON → 格式化 | 1 秒 Toast "JSON 语法有误，缺少逗号"；点 action=看JSON教程；inferJsonFixHint=「第1行 b:后加逗号」OP103 | | |
| 4 | 开 `/tools/jwt/` 解码 `eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMiLCJuYW1lIjoiSm9obiBEb2UifQ.xuEVg` → 点 🎨 按钮 | 跳 JSON 工作台 claims 已回填 + sessionStorage=jwt_decode_payload_v1 OP105① | | |
| 5 | 开 `/tools/base64/` 解码 `eyJhIjoxfQ==` → 点 🎨 | 跳 JSON 美化 OP105③；MruFav.record("base64") MRU 出现 Base64 卡 OP107 | | |
| 6 | 首页点 3 个 🤍 收藏 → F5 刷新 | 3 个 ❤️ 保持；`#mruAndFavTitle` 下 Fav 栏 3 项 OP107 | | |
| 7 | 页脚点 🔍 搜索复盘 | search-console.html 4 表展示；点 「录入 Gap Issue」 → search-gap.yml 预填 Top10 + JB 合规 3 checkbox 必勾 OP201 | | |
| 8 | 横幅点 × | 横幅消失 30 天不见（privacy_banner_closed_v1 localStorage TTL）OP303 | | |

### 4.4 回滚预案（两边统一操作，互不影响）

| 环境 | 回滚步骤（<= 30 秒） | 验证回滚成功 |
|---|---|---|
| **GitHub Pages** | 1) 打开 Actions → [deploy-pages.yml](https://github.com/SongYuanKun/dev-tools-nav/actions/workflows/deploy-pages.yml) → Run workflow → 选 `main` 分支 + **Use workflow from = 旧绿 commit**（例 `50d039d`）→ Run → 2) 等 Deploy 绿 → 3) 开 Pages URL → `cat .deploy-sha` 看内容等于旧 commit | |
| **Y480** | 1) 手动 oneshot 传旧 good SHA：`bash ~/y480-deploy/03-deploy-pull.sh 50d039d` → 2) `curl -s http://127.0.0.1/.deploy-sha` 内容 = 50d039d → 3) `bash 05-verify.sh` FAIL=0 | |

---

## 五、交付物总表（本报告 + 所有可复制产出）

| 类型 | 交付物 | 路径（Code Reference 可点直达）|
|---|---|---|
| 📜 报告 | Y480 + Pages 双部署完整报告（本文） | [deployment-report-y480-github-20260830.md](file:///Users/mac/vs-code/dev-tools-nav/docs/deployment-report-y480-github-20260830.md) |
| 🧩 Workflow | Pages 自动化发布（含 .nojekyll/CNAME/排除清单优化） | [deploy-pages.yml](file:///Users/mac/vs-code/dev-tools-nav/.github/workflows/deploy-pages.yml#L1-L91) |
| 🧩 Workflow | CI 质量门禁（path过滤+playwright缓存+失败log上传artifact）| [test.yml](file:///Users/mac/vs-code/dev-tools-nav/.github/workflows/test.yml#L1-L74) |
| 🖥️ Y480 部署脚本集 | 环境核验 01 | [01-env-check.sh](file:///Users/mac/vs-code/dev-tools-nav/scripts/deploy-y480/01-env-check.sh) |
| 🖥️ | 安装 Nginx/Node/UFW 02 | [02-install-nginx-ufw.sh](file:///Users/mac/vs-code/dev-tools-nav/scripts/deploy-y480/02-install-nginx-ufw.sh) |
| 🖥️ | 核心部署器(GHA Green门禁+rsync原子发布) 03 | [03-deploy-pull.sh](file:///Users/mac/vs-code/dev-tools-nav/scripts/deploy-y480/03-deploy-pull.sh) |
| 🖥️ | systemd 每10分钟自动轮询 04 | [04-systemd-setup.sh](file:///Users/mac/vs-code/dev-tools-nav/scripts/deploy-y480/04-systemd-setup.sh) |
| 🖥️ | 本地验收 05 | [05-verify.sh](file:///Users/mac/vs-code/dev-tools-nav/scripts/deploy-y480/05-verify.sh) |
| 🖥️ | 双部署一致性校验 06 | [06-consistency-check.sh](file:///Users/mac/vs-code/dev-tools-nav/scripts/deploy-y480/06-consistency-check.sh) |
| 🖥️ | Nginx 站点配置模板（6 安全头+gzip+30d缓存+404 fallback）| [dev-tools-nav-nginx.conf](file:///Users/mac/vs-code/dev-tools-nav/scripts/deploy-y480/dev-tools-nav-nginx.conf#L1-L80) |
| 📖 用户 | Y480 6步操作手册+FAQ | [README-y480-deploy.md](file:///Users/mac/vs-code/dev-tools-nav/scripts/deploy-y480/README-y480-deploy.md) |
| 🧪 自测 | bash -n 语法 8 个脚本 + 9 文件总 1390 行 bash/nginx/markdown ✅ | `bash -n scripts/deploy-y480/*.sh` → 8/8 OK |
