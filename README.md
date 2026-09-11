# Reshare

Self-hosted resume management and sharing platform.

Reshare 不是「一份在线简历页」，而是可以自行部署到 Cloudflare Workers 的**个人简历管理与安全分享平台**。

单管理员。多份简历。每份分享是独立 token，互不串页。访客永远走 `/s/<token>`，根路径不展示任何简历。

## 它做什么

- **Admin**：唯一管理后台。Resumes 管内容，Shares 管访问授权。
- **Resume**：Canonical 简历数据。不管布局、颜色、纸张。
- **Presentation**：怎么展。Layout × Theme × Canvas（纸张方向）。
- **Share**：token / 密码 / 过期 / 可覆盖 Presentation。`inherit` 沿用简历默认。
- **Public**：`/s/:token`。与后台预览同一 Renderer、同一 Canvas。
- **Storage**：Cloudflare KV。一份简历一个 key，一条分享一个 key。

不是完整在线编辑器。内容主编辑可以在魔方简历里做，这里负责导入、排版、主题、分享、打印。

## 架构分层

```
External JSON → Adapter → Canonical Resume
                         → Presentation → Canvas → Layout × Theme → Renderer → Output
Share = token / password / expiry / presentation override
```

| 对象 | 只管 | 不管 |
|---|---|---|
| Resume | 内容 | layout / theme / orientation / KV / HTML |
| Presentation | 怎么展 | 富文本正文 |
| Canvas | 纸张尺寸与方向 | 分栏 / section 顺序 |
| Layout | section 怎么排 | 颜色 / 字体 |
| Theme | 色字边影 | columns / orientation |
| Share | 访问控制 + inherit/覆盖 | 渲染 |

## 核心功能

- 单管理员 Cookie 会话（HttpOnly，默认 7 天）
- 多份简历，互不影响
- 导入预览：`POST /api/import` 不写 KV，确认后再保存
- Layout：`classic` / `sidebar` / `two-column` / `compact`
- Theme：`paper` / `ink` / `night` / `plain`
- Canvas：A4 竖版 / 横版。手机只 scale，不把横版改成竖版或单栏
- 独立分享链接，可设密码、有效期、撤销
- 分享可覆盖 Layout / Theme / 方向，空值 = inherit
- 公开页与后台预览同一套渲染
- 项目 JSON 往返导出；魔方 JSON 导入/导出（未映射字段进 `extras`）

## 自部署

需要：Cloudflare 账号、Workers、一个 KV namespace。

1. Clone 本仓库
2. 在 `wrangler.toml` 填入你的 KV namespace id（`RESUME_KV`）
3. 配置 secrets，再部署：

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET
npm test
npx wrangler deploy
```

可选：`SESSION_TTL_SEC` 覆盖管理员 Cookie 秒数。

默认 Worker 名与仓库 slug 均为 `reshare`（`*.workers.dev` 主机名由此决定）。改 `name` 会部署成另一条 Worker，已有分享链接不会自动搬家。

不要把密码写进前端 JS 或 git。

## 路由

| 路径 | 谁能进 |
|---|---|
| `/` | 私有占位，不展简历 |
| `/login` | 管理员登录 |
| `/admin` | 工作台：Resumes / Shares |
| `/admin/e/:id` | 编辑 |
| `/admin/preview/:id` | 后台预览 |
| `/s/:token` | 公开分享。密码解锁后发短时 Cookie |
| `POST /api/import` | 解析预览，不落库 |
| `GET /api/resumes/:id/mofang` | 魔方导出 |
| `GET /api/resumes/:id/project` | 项目 JSON（历史 format id 保留） |

禁止 `?id=` 直出简历。禁止访客用 `?theme=` 改公开页。

## 数据存储

KV 一份一 key：

- `resume:{id}`
- `share:{token}`

列表用 prefix scan。删简历不级联删分享（分享会变成指向缺失）。撤销优先于过期。过期只信 Worker `Date.now()`。

## 配置

| 项 | 位置 | 说明 |
|---|---|---|
| `ADMIN_PASSWORD` | secret | 唯一管理员密码 |
| `SESSION_SECRET` | secret | 签 Cookie |
| `SESSION_TTL_SEC` | env，可选 | 管理员会话秒数，默认 7 天 |
| `RESUME_KV` | wrangler binding | KV |

产品显示名在 `src/config/product.js`。内部格式 id `yiyue-project`、Cookie `yr_admin`、KV key 前缀属于兼容层，不是品牌。

## 测试

```bash
node --test tests/*.test.js
```

不依赖 Cloudflare。通过后再 `wrangler deploy`。
