# 1Panel 本地部署记录

- **站点**：tools.songyuankun.top  
- **1Panel 网站根目录**：`/opt/1panel/www/sites/tools.songyuankun.top/index`  
- **1Panel 在本机**，部署方式为本地同步（与 GitHub 上的 [Pages 自动部署](../.github/workflows/deploy-pages.yml) 相互独立，可并存）。

## 与 GitHub Pages 的关系

| 方式 | 地址 / 说明 |
|------|----------------|
| **GitHub Pages** | `https://songyuankun.github.io/dev-tools-nav/` — 推送 `main` 后由 Actions 发布，见根目录 README |
| **1Panel 本机** | `tools.songyuankun.top` — 使用本文档与 `./deploy.sh` 同步到上述目录 |

两者都是纯静态文件；任选其一为主站即可。

## 部署动作

将本项目根目录下的静态文件同步到上述根目录，保留 1Panel 里该路径作为站点根目录。

### 方式一：本地脚本（推荐）

在仓库根目录执行：

```bash
./deploy.sh
```

会使用 `rsync` 把当前目录内容同步到 `/opt/1panel/www/sites/tools.songyuankun.top/index`（排除 `.git`、`.github`、README、文档等）。

### 方式二：手动 rsync

```bash
rsync -av --delete \
  --exclude='.git' \
  --exclude='.github' \
  --exclude='README.md' \
  --exclude='.gitignore' \
  --exclude='docs' \
  ./ /opt/1panel/www/sites/tools.songyuankun.top/index/
```

### 方式三：1Panel 文件管理

在 1Panel 里打开「文件」→ 进入 `/opt/1panel/www/sites/tools.songyuankun.top/index`，手动上传或粘贴 `index.html`、`css/`、`js/`、`pages/`、`data/` 等。
