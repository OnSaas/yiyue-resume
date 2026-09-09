# yiyue-resume

楚扉月对外个人简历。OnSaas 仓，部署 EdgeNux Workers。

公开页是纸质编辑风单页；数据用 **魔方简历（Magic Resume）JSON**（`JOYCEQL/magic-resume` 的 `ResumeData`）。每份简历独立，不堆全部履历。

## 地址

- 后台：`/admin`
- 公开：`/r/<slug>`（后台打开「对外公开」）
- 默认：`/` 读 slug=`default`，没有则取第一份公开的

## 和魔方的关系

兼容字段：`basic` / `education` / `experience` / `projects` / `certificates` / `customData` / `skillContent` / `selfEvaluationContent` / `menuSections` / `globalSettings`。

额外字段：`slug`、`isPublic`。导出 JSON 可再导入魔方（多出来的键一般会被忽略）。

后台覆盖：多份 CRUD、复制、导入/导出 JSON、板块增删排序、条目显隐、HTML 详情、头像、证书图、版式色/字号、实时预览、打印 PDF。

**不对齐、也不抄魔方源码的：** AI 润色、语法检查、PDF 识图导入、GitHub 贡献墙、魔方那套皮肤。公开页固定现在这套样式。

## 部署

```bash
npx wrangler kv namespace create RESUME_KV
# 把 id 写入 wrangler.toml
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET
npx wrangler deploy
```

不要擅自绑自定义域。密码不要提交进 git。
