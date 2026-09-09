# yiyue-resume

楚扉月个人简历。OnSaas 仓，EdgeNux Workers + KV。默认 `/` 不展示任何简历；只有后台生成的 `/s/<token>` 能看某一份。

## 流程

1. `/` 私有占位，noindex
2. `/login` 管理员（`ADMIN_PASSWORD` → Cookie `yr_admin`）
3. `/admin` 简历 JSON CRUD、生成分享（主题 / 密码 / 有效期）
4. `/s/<token>` 访客；过期或撤销失效；有密码先解锁

## 部署

账号 EdgeNux，`*.onw.workers.dev`。不要擅自绑自定义域。

```bash
npx wrangler kv namespace create RESUME_KV
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET
npx wrangler deploy
```

KV 已绑 `RESUME_KV`。仓库 `resumes/*.json` 只是源文件，上线以 KV 为准。
