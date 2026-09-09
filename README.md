# yiyue-resume

简历展示引擎：魔方 JSON → Canonical → Layout × Theme → 分享。不是完整编辑器。

OnSaas / EdgeNux Workers + KV。`/` 不展示简历；访客只走 `/s/<token>`。

## 流程

魔方导出 JSON → 后台导入 → 少量修改 → 选布局/主题 → 预览 → 分享 / 打印

## 布局 × 主题

Layout: `classic` / `sidebar` / `two-column` / `compact`  
Theme: `paper` / `ink` / `night` / `plain`  
Canvas: A4 竖版 / 横版（手机只 scale，不改 Layout）  
可自由组合。分享记录保存自己的 `presentation`（空=inherit）。

导入走 `POST /api/import`（预览，不落库），确认后再保存。

## 测试

```bash
node --test tests/*.test.js
```

## 部署

不要擅自绑自定义域。

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET
npx wrangler deploy
```
