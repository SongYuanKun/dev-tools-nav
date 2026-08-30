# 联想 Y480 本地部署操作手册（6 步一次性 + 10 分钟自驱轮询）

> 严格 JB-OSS 7 铁律：纯静态零后端 / 零广告零付费 / 零第三方追踪 / 本地计算 / 100% MIT。

## 0. Y480 最低配置确认

| 硬件 | 最低 | 推荐 | 检查命令 |
|---|---|---|---|
| CPU | i3-2330M 双核（Y480 最低配） | i7-3630QM 四核 | `nproc` |
| 内存 | 2 GB | 8 GB DDR3（本机最大 16GB） | `free -h` |
| 磁盘空余 | 3 GB（HDD 足够） | 10 GB SSD | `df -h /` |
| OS | Debian 11 / Ubuntu 22.04 LTS (64-bit) | Debian 12 Bookworm | `cat /etc/os-release` |
| 网卡/出网 | 有线/无线皆可，443 TCP 出网（GitHub） | 千兆有线 + 内网可达 | `curl -I https://github.com` |

### 0.1 网络要求（二选一）

- **内网使用（默认推荐）**：Y480 局域网 IP 192.168.x.y，家人/设备访问 `http://192.168.x.y/`
- **公网使用（可选）**：路由器端口映射 80/443 → Y480 + DDNS + certbot 免费证书

## 1. 第一步：环境核验（1 分钟）

```bash
# 将仓库整个 scripts/deploy-y480 目录 scp 到 Y480：
scp -r scripts/deploy-y480  USER@Y480_IP:~/y480-deploy/
ssh USER@Y480_IP
cd ~/y480-deploy
chmod +x 0*.sh
bash 01-env-check.sh
# 输出末尾 ✅ ENV_OK 才继续；❌ 按提示装包
```

## 2. 第二步：安装 Nginx + UFW + Node 22（5 分钟）

```bash
cd ~/y480-deploy
sudo bash 02-install-nginx-ufw.sh
# 纯内网且无外网攻击风险可跳防火墙： sudo bash 02-install-nginx-ufw.sh --no-firewall
```

## 3. 第三步：部署 Nginx 站点 + 首次 oneshot 构建发布（5-15 分钟 Y480 HDD 慢）

```bash
cd ~/y480-deploy

# 3.1 cp 站点配置到 nginx 启用
sudo cp dev-tools-nav-nginx.conf /etc/nginx/sites-available/dev-tools-nav.conf
sudo ln -sf /etc/nginx/sites-available/dev-tools-nav.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 3.2 首次拉 main 最新 + Test Green 门禁通过 + rsync 到 /var/www/dev-tools-nav
bash 03-deploy-pull.sh
# 日志：cat ~/.local/state/dev-tools-nav-y480/deploy.log
# 如门禁 = GitHub Actions Test 没跑（第一次 push 已经是 green 则跳过），手动门禁：
#   bash 03-deploy-pull.sh $(git ls-remote https://github.com/SongYuanKun/dev-tools-nav.git main|awk '{print $1}')
```

## 4. 第四步：启用 user systemd 每 10 分钟轮询（可选但推荐）

```bash
cd ~/y480-deploy
bash 04-systemd-setup.sh

# 让 user timer 开机也自启（即使 $USER 没登录，需要 root 一次）：
sudo loginctl enable-linger $USER

# 验证 oneshot：
systemctl --user start dev-tools-nav-y480.service
journalctl --user -u dev-tools-nav-y480.service -n 30 -f
```

## 5. 第五步：本地验收（2 分钟）

```bash
cd ~/y480-deploy
# 默认验 http://127.0.0.1 vs GitHub Pages songyuankun.github.io/dev-tools-nav
bash 05-verify.sh

# 如果用局域网 IP 验：
bash 05-verify.sh http://192.168.1.123/ https://songyuankun.github.io/dev-tools-nav/
# 末尾：📊 验收 PASS=X FAIL=0 = 通过
```

## 6. 第六步：公网 HTTPS（可选，内网跳过）

```bash
# 假设你已有 A 记录 = tools-y480.example.com → 家公网 IP + 路由器端口映射 80/443→Y480
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tools-y480.example.com --non-interactive --agree-tos -m 123839070@qq.com
sudo nginx -t && sudo systemctl reload nginx
bash 05-verify.sh https://tools-y480.example.com
```

## 7. 常见问题排查表（F.A.Q.）

| 现象 | 原因 | 一键解决 |
|---|---|---|
| `03-deploy-pull.sh` 死在 npm ci | HDD 慢 / npm registry 超时 | `npm config set registry https://registry.npmmirror.com` 重跑 |
| GHA Status=pending 永久不部署 | main 最新 SHA 上的 Test workflow 没 green | `systemctl --user start dev-tools-nav-y480.service` 等下一轮；或手动 `bash 03-deploy-pull.sh <已知green_SHA>` |
| 局域网其他机器访问被拒绝 | UFW 没放 80/443 | `sudo ufw allow 80/tcp && sudo ufw allow 443/tcp` |
| Nginx 403 Forbidden | /var/www/dev-tools-nav 权限 0700 root | `sudo chmod -R a+rX /var/www/dev-tools-nav` |
| Tour 没弹/MRU 空 | 清 localStorage 刷新；首次访问才触发 Tour | DevTools → Application → Local Storage → 清 |
| 端口 80 被 Apache 占用 | apt 默认 apache2 | `sudo systemctl disable --now apache2` 再 `sudo systemctl restart nginx` |
| 404 跳首页 CSS/JS 路径错 | Y480 没部署到域名根，部署到 `/subpath/` | nginx 改 `location /subpath { alias /var/www/dev-tools-nav; ... }`；并对应加 `<base href="/subpath/">` 到 index.html |
| Playwright 无法截图/Y480 无显示 | 无头模式 | `npx playwright install chromium --with-deps` 用 xvfb-run |

## 8. 文件清单（scripts/deploy-y480/ 目录 = 7 文件）

| 文件名 | 功能 | 是否需 sudo |
|---|---|---|
| `01-env-check.sh` | 只读环境核验 | 否 |
| `02-install-nginx-ufw.sh` | apt 安装依赖 | 是 |
| `03-deploy-pull.sh` | 拉 main + build + rsync + nginx reload | 写 /var/www 要 |
| `04-systemd-setup.sh` | user systemd units 安装 | 否（linger 需 sudo 1 次） |
| `05-verify.sh` | 本地 + GitHub Pages 双验 | 否 |
| `dev-tools-nav-nginx.conf` | 站点配置模板（安全头+gzip+长缓存） | 安装时 sudo |
| `README-y480-deploy.md` | 本操作手册 | 否 |

## 9. 回滚预案（5 秒）

```bash
# 1. 把 /var/www 回滚到上一个 good SHA
LAST_GOOD=$(cat ~/.local/state/dev-tools-nav-y480/last-deployed-sha~ 2>/dev/null || echo "上次 SHA 备份")
# 2. 或者直接快速切：03-deploy-pull.sh 传 good SHA
bash ~/y480-deploy/03-deploy-pull.sh 50d039d  # ← 这里换任何已知好的 SHA
```
