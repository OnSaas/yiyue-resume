/**
 * Reshare — Cloudflare Worker entry.
 * HTTP only. Business in services. Frozen: Worker name, KV keys, cookies, SESSION_SECRET.
 */
import { listAdapters } from "./adapters/index.js";
import { renderResume } from "./renderer/engine.js";
import { THEMES, LAYOUTS, ORIENTATIONS } from "./schema/presentation.js";
import { importPayload } from "./services/import.js";
import { resumeService } from "./services/resume.js";
import { shareService } from "./services/share.js";
import { layoutMetadata } from "./renderer/registry/layouts.js";
import { themeMetadata } from "./renderer/registry/themes.js";
import { PAGE_SIZES } from "./config/pageSizes.js";
import { FEATURE_FLAGS } from "./config/featureFlags.js";
import { PRODUCT } from "./config/product.js";
import { AppError, ImportError } from "./domain/errors.js";
import { requestOrigin } from "./share/urls.js";
import {
  ADMIN_COOKIE,
  shareCookieName,
  cookieSet,
  cookieClear,
  readAdmin,
  adminToken,
  ttlSec,
  shareUnlocked,
  shareUnlockValue,
} from "./services/auth.js";

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}
function jsonErr(code, message, status = 400, extra = {}) {
  return json({ error: { code, message }, ...extra }, status);
}
function html(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}
function failPage(title, msg) {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"/><meta name="robots" content="noindex"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${PRODUCT.name} · ${title}</title><link rel="stylesheet" href="/css/resume.css"/></head><body class="page"><main class="gate"><h1>${title}</h1><p>${msg}</p><p class="muted">${PRODUCT.name}</p></main></body></html>`;
}
function unlockPage(token, err) {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"/><meta name="robots" content="noindex"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${PRODUCT.name} · 解锁简历</title><link rel="stylesheet" href="/css/resume.css"/></head><body class="page"><form class="gate" method="post" action="/s/${token}/unlock"><h1>这份简历有访问密码</h1><input type="password" name="password" required autocomplete="current-password"/><button type="submit">查看</button>${err ? `<p class="err">${err}</p>` : ""}</form></body></html>`;
}
function serviceErr(e) {
  if (e instanceof ImportError) return jsonErr(e.code, e.message, e.status, { errors: e.errors, format: e.format });
  if (e instanceof AppError) return jsonErr(e.code, e.message, e.status);
  return jsonErr("INTERNAL", e?.message || "内部错误", 500);
}
async function requireAdmin(req, env) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) return jsonErr("CONFIG_MISSING", "未配置 ADMIN_PASSWORD 或 SESSION_SECRET", 503);
  if (!(await readAdmin(req, env))) return jsonErr("UNAUTHENTICATED", "未登录", 401);
  return null;
}
async function asset(env, req, path) {
  const u = new URL(req.url);
  u.pathname = path;
  return env.ASSETS.fetch(new Request(u.toString(), req));
}
async function readBody(req) {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) return req.json();
  if (ct.includes("form")) return Object.fromEntries((await req.formData()).entries());
  const t = await req.text();
  if (!t) return {};
  try { return JSON.parse(t); } catch { return {}; }
}
function presentationFromQuery(url, fallback, resolvePresentation) {
  return resolvePresentation(fallback, {
    layout: url.searchParams.get("layout"),
    theme: url.searchParams.get("theme"),
    layoutVariant: url.searchParams.get("layoutVariant"),
    orientation: url.searchParams.get("orientation"),
  });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = requestOrigin(req);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const method = req.method.toUpperCase();
    const resumes = resumeService(env.RESUME_KV);
    const shares = shareService(env.RESUME_KV);

    if (path === "/login") {
      if (method === "GET") {
        if (await readAdmin(req, env)) return Response.redirect(new URL("/admin", url).toString(), 302);
        return asset(env, req, "/login.html");
      }
      if (method === "POST") {
        const body = await readBody(req);
        if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) return jsonErr("CONFIG_MISSING", "未配置密钥", 503);
        if (body.password !== env.ADMIN_PASSWORD) {
          if ((req.headers.get("content-type") || "").includes("json")) return jsonErr("INVALID_PASSWORD", "密码错误", 401);
          return Response.redirect(new URL("/login?e=1", url).toString(), 302);
        }
        const exp = Date.now() + ttlSec(env) * 1000;
        const tok = await adminToken(env, exp);
        return new Response(null, { status: 303, headers: { Location: "/admin", "Set-Cookie": cookieSet(ADMIN_COOKIE, tok, ttlSec(env)) } });
      }
    }

    if (path === "/logout" && (method === "POST" || method === "GET")) {
      return new Response(null, { status: 303, headers: { Location: "/login", "Set-Cookie": cookieClear(ADMIN_COOKIE) } });
    }

    if (path === "/s" || path.startsWith("/s/")) {
      const parts = path.split("/").filter(Boolean);
      const token = parts[1];
      const action = parts[2];
      if (!token) return html(failPage("链接无效", "没有这份分享。"), 404);
      const share = await shares.get(token);
      if (!share) return html(failPage("链接无效", "没有这份分享，或已被撤销。"), 404);
      if (share.revoked) return html(failPage("已关闭", "这份分享已撤销。"), 403);
      if (share.expiresAt && Date.now() > share.expiresAt) return html(failPage("已过期", "链接超过有效期。"), 403);

      if (action === "unlock" && method === "POST") {
        const body = await readBody(req);
        if (!(await shares.verifyUnlock(share, body.password))) return html(unlockPage(token, "密码不对"), 401);
        const val = await shareUnlockValue(env, token);
        return new Response(null, { status: 303, headers: { Location: "/s/" + token, "Set-Cookie": cookieSet(shareCookieName(token), val, 12 * 3600) } });
      }

      if (share.passwordHash && !(await shareUnlocked(req, env, token))) return html(unlockPage(token));

      const doc = await resumes.get(share.resumeId);
      if (!doc) return html(failPage("简历不存在", "分享还在，对应简历已删。"), 404);
      const presentation = shares.resolvePresentation(doc.presentation, share.presentation);
      return html(renderResume(doc.resume, presentation, { share: true }));
    }

    if (path === "/admin") {
      if (!(await readAdmin(req, env))) return Response.redirect(new URL("/login", url).toString(), 302);
      return asset(env, req, "/admin.html");
    }
    if (path.startsWith("/admin/e/")) {
      if (!(await readAdmin(req, env))) return Response.redirect(new URL("/login", url).toString(), 302);
      return asset(env, req, "/edit.html");
    }
    if (path.startsWith("/admin/preview/")) {
      if (!(await readAdmin(req, env))) return jsonErr("UNAUTHENTICATED", "未登录", 401);
      const id = path.slice("/admin/preview/".length);
      const doc = await resumes.get(id);
      if (!doc) return html(failPage("没有这份简历", ""), 404);
      const presentation = presentationFromQuery(url, doc.presentation, shares.resolvePresentation);
      return html(renderResume(doc.resume, presentation, { fragment: url.searchParams.get("fragment") === "1" }));
    }

    if (path.startsWith("/api/")) {
      if (path === "/api/login" && method === "POST") {
        return fetch(new Request(new URL("/login", url).toString(), req));
      }
      const denied = await requireAdmin(req, env);
      if (denied) return denied;

      if (path === "/api/meta" && method === "GET") {
        return json({
          product: PRODUCT,
          layouts: layoutMetadata(),
          themes: themeMetadata(),
          orientations: ORIENTATIONS,
          adapters: listAdapters(),
          canvas: PAGE_SIZES,
          flags: FEATURE_FLAGS,
        });
      }

      if (path === "/api/import" && method === "POST") {
        let body;
        try { body = await req.json(); } catch { return jsonErr("IMPORT_INVALID_FORMAT", "坏 JSON"); }
        const got = importPayload(body.payload ?? body.json ?? body);
        if (!got.ok) {
          return json({
            ok: false,
            error: { code: "IMPORT_INVALID_FORMAT", message: got.errors.join("；") },
            errors: got.errors,
            format: got.format,
          }, 400);
        }
        return json({ ok: true, format: got.format, version: got.version, resume: got.canonical, warnings: got.warnings, stats: got.stats, preservedFields: got.preservedFields });
      }

      if (path === "/api/resumes" && method === "GET") return json({ resumes: await resumes.list() });

      if (path === "/api/resumes" && method === "POST") {
        try {
          const body = await req.json();
          const doc = await resumes.create(body);
          return json(doc, 201);
        } catch (e) { return serviceErr(e); }
      }

      const one = path.match(/^\/api\/resumes\/([^/]+)$/);
      if (one && method === "GET") {
        const doc = await resumes.get(one[1]);
        if (!doc) return jsonErr("RESUME_NOT_FOUND", "不存在", 404);
        return json(doc);
      }
      if (one && method === "PUT") {
        try {
          const body = await req.json();
          return json(await resumes.update(one[1], body));
        } catch (e) { return serviceErr(e); }
      }
      if (one && method === "DELETE") {
        await resumes.remove(one[1]);
        return json({ ok: true });
      }

      const mofang = path.match(/^\/api\/resumes\/([^/]+)\/mofang$/);
      if (mofang && method === "GET") {
        const doc = await resumes.get(mofang[1]);
        if (!doc) return jsonErr("RESUME_NOT_FOUND", "不存在", 404);
        return json(resumes.exportMofang(doc));
      }
      const project = path.match(/^\/api\/resumes\/([^/]+)\/project$/);
      if (project && method === "GET") {
        const doc = await resumes.get(project[1]);
        if (!doc) return jsonErr("RESUME_NOT_FOUND", "不存在", 404);
        return json(resumes.exportProject(doc));
      }

      if (path === "/api/shares" && method === "GET") {
        const list = await resumes.list();
        return json({ shares: await shares.list(list.map((r) => r.id), origin) });
      }
      if (path === "/api/shares" && method === "POST") {
        try {
          const body = await req.json();
          const resumeId = body.resumeId;
          if (!resumeId) return jsonErr("RESUME_REQUIRED", "缺 resumeId");
          const exists = await resumes.get(resumeId);
          const share = await shares.create(body, exists);
          return json(shares.publicShare(share, origin), 201);
        } catch (e) { return serviceErr(e); }
      }

      const sh = path.match(/^\/api\/shares\/([^/]+)$/);
      if (sh && method === "PATCH") {
        try {
          const body = await req.json();
          if (body.resumeId) {
            const exists = await resumes.get(body.resumeId);
            if (!exists) return jsonErr("RESUME_NOT_FOUND", "简历不存在", 400);
          }
          const share = await shares.patch(sh[1], body);
          return json(shares.publicShare(share, origin));
        } catch (e) { return serviceErr(e); }
      }
      if (sh && method === "DELETE") {
        try {
          await shares.revoke(sh[1]);
          return json({ ok: true });
        } catch (e) { return serviceErr(e); }
      }

      return jsonErr("NOT_FOUND", "没有这个接口", 404);
    }

    if (path === "/") return asset(env, req, "/index.html");
    return env.ASSETS.fetch(req);
  },
};

export { THEMES, LAYOUTS, ORIENTATIONS };
