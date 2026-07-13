# 1Panel 本地部署记录

- **站点**：tools.songyuankun.top
- **1Panel 网站根目录**：`/opt/1panel/www/sites/tools.songyuankun.top/index`
- **本地方式**：从仓库根目录执行 `./deploy.sh`，向上述目录同步静态站点文件。

`deploy.sh` 是仓库内的部署入口，不是站点资源；脚本从仓库执行，并明确排除自身，因此不会进入部署后的网站目录。

## 与 GitHub Pages 的关系

| 方式 | 地址 / 说明 |
|---|---|
| **GitHub Pages** | `https://songyuankun.github.io/dev-tools-nav/`；推送 `main` 后由 [Pages 工作流](../.github/workflows/deploy-pages.yml) 发布 |
| **1Panel 本地** | `https://tools.songyuankun.top/`；在仓库根目录执行 `./deploy.sh` |
| **1Panel SSH** | 由 [SSH 工作流](../.github/workflows/deploy-1panel-ssh.yml) 在密钥配置完整时同步 |

两个站点继续并存，不能因其中一种部署方式可用而删除另一 hostname。

Pages、本地 `deploy.sh` 和 1Panel SSH 工作流各自维护排除清单及构建步骤，因此发布内容不是逐字节相同。修改部署范围时必须分别检查三个 manifest，不能假设改动会自动同步。

## 本地脚本部署

在仓库根目录执行：

```bash
./deploy.sh
```

脚本先生成 `sitemap.xml`，确认 1Panel 目标目录存在后，以 `rsync --delete --delete-excluded` 同步。当前 `deploy.sh` 的实际排除项为：

- `.git`
- `.github`
- `README.md`
- `.gitignore`
- `docs`
- `package.json`
- `package-lock.json`
- `node_modules`
- `deploy.sh`

等价的手动命令是：

```bash
rsync -av --delete --delete-excluded \
  --exclude='.git' \
  --exclude='.github' \
  --exclude='README.md' \
  --exclude='.gitignore' \
  --exclude='docs' \
  --exclude='package.json' \
  --exclude='package-lock.json' \
  --exclude='node_modules' \
  --exclude='deploy.sh' \
  ./ /opt/1panel/www/sites/tools.songyuankun.top/index/
```

## 手动文件管理

在 1Panel 打开「文件」，进入 `/opt/1panel/www/sites/tools.songyuankun.top/index`，按需上传 `index.html`、`css/`、`js/`、`pages/`、`tools/`、`data/` 和 `assets/` 等站点资源。手动上传不会自动执行 sitemap 或内容构建脚本，也不会自动删除已失效文件，发布者需要单独核对。

产品阶段、状态与后续部署相关决策统一见 [产品路线图](./roadmap.md)，本文不复制路线清单。
