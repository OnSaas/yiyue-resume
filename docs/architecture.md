# Reshare 架构

Reshare — self-hosted resume management and sharing platform.

```
Reshare
├── Admin
│   ├── Resumes
│   └── Shares
├── Public
│   └── /s/:token
├── Resume
│   ├── Canonical Data
│   └── Presentation
├── Share
│   └── Share Token
├── Layout
├── Theme
└── Storage
```

Resume = 内容。Share = 访问授权。Layout = 结构。Theme = 视觉。Admin = 唯一控制面板。不要把这几层混成一个对象。

## 边界

| 层 | 职责 |
|---|---|
| Domain / Schema | Canonical Resume、`schemaVersion`、sanitize |
| Presentation Resolver | 合并 inherit / 覆盖，Renderer 只收 resolved |
| Canvas | A4 portrait/landscape，scale，不进 Layout |
| Adapter Registry + Import Pipeline | 插件注册；`POST /api/import` 只预览不落库 |
| Section / Layout / Theme Registry | 注册表扩展，不改 Canonical |
| Service + Repository | 业务；KV 只在 repository |
| Editor Patch `mergeCanonical` | 未编辑字段 / extras / 项目 URL 保留 |
| Output | HTML；print 共用；PDF 未做 |
| Product identity | `src/config/product.js`，只影响 UI/文档，不动存储键 |

## 依赖方向

API → Service → Domain/Schema → Renderer / Adapter / Repository

禁止：Renderer → KV / Mofang JSON；Adapter → Theme；Repository → HTML。

核心 `renderResume(resume, presentation)` 可在本地 Node 无 Cloudflare 跑。

## 兼容层（不要当作品牌改）

- 仓 / Worker 名：`reshare`（产品名 Reshare）
- KV binding `RESUME_KV`、key `resume:` / `share:`
- Cookie `yr_admin` / `yr_share_{token}`
- 项目 JSON `format: "yiyue-project"`（读取同时接受 `reshare-project`）

## 刻意未做

- Durable Objects / D1 / GraphQL / 插件市场
- PDF / PNG Output
- Access / Turnstile
- 自定义域
