# yiyue-resume 架构审计（V3 Phase 1）

## 当前 → 新边界

| 现有 | 新层 | 迁移 |
|---|---|---|
| `schema/resume.js` | Domain / Schema | 增加 `schemaVersion`；sanitize 仍是 Canonical 入口 |
| `schema/presentation.js` `resolvePresentation` | Presentation Resolver | 保留，Renderer 只收 resolved |
| 无 | Canvas `domain/canvas.js` | A4 portrait/landscape，scale，不进 Layout |
| `adapters/mofang.js` + `native.js` + `ingest()` | Adapter Registry + Import Pipeline | 插件注册；`POST /api/import` 只预览不落库 |
| `renderer/engine.js` if section | Section Registry | `renderer/registry/sections.js` |
| `renderer/registry/layouts.js` | Layout Registry | 补 `supports`，不改 Canonical |
| `renderer/registry/themes.js` | Theme Registry | 补 `themeTokens()` 分组 |
| Worker 直接 ingest/KV | Service + Repository | `services/*`；KV 仍只在 repository |
| 表单整包 PUT | Editor Patch `mergeCanonical` | 未编辑字段 / extras / 项目 URL 保留 |
| HTML 即产品 | Output `output/html.js` | print 共用 HTML；PDF 未做 |

## 依赖方向

API → Service → Domain/Schema → Renderer / Adapter / Repository

禁止：Renderer → KV / Mofang JSON；Adapter → Theme；Repository → HTML。

核心 `renderResume(resume, presentation)` 可在本地 Node 无 Cloudflare 跑。

## 本阶段未迁（刻意）

- Durable Objects / D1 / GraphQL / 插件市场
- PDF / PNG Output
- Auth 抽成完整 middleware 栈（Cookie 仍在 worker）
- worker.js 大拆 api/*.js（路由仍集中，业务已进 service）
