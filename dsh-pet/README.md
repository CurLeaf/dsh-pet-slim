# dsh-pet-slim 🐾

一只住在 DeepSeek Harness 里的桌面宠物：一百余个透明动画、可多开、能上桌面。

这是 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet) 的**非官方 slim 分支**，
不是上游作者的发布渠道。上游的安装与完整文档仍在 <https://github.com/PC2005-cloud/dsh-pet>。

Fork 仓库：<https://github.com/CurLeaf/dsh-pet-slim>

## 安装

```bash
dsh plugin --profile web add dsh-pet-slim
```

包内自带 bundle patch（`dsh.bundle.patch`），装进 profile 后由
`dsh.profile.bundles` 组合挂载，不需要手工往 `cordis.patch.yml` 加行。
新 bundle 由 HMR 组合；若行没出现，重启一次 web 服务。

## 许可与归属

- 代码：MIT（见 `LICENSE`，保留上游版权声明）。
- 素材（`assets/` 下的动画、字体、音效、图片）：沿用上游条款——**禁止商用**，
  公开渠道的二创须署上游名（链接见上）。
- 详细说明见 `NOTICE`。

上游作者：PC2005-cloud；本 fork 维护者：curleaf。
