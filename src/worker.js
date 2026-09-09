import { ingest, listAdapters } from "./adapters/index.js";
import { renderResume } from "./renderer/engine.js";
import { resumeRepository } from "./repositories/resumes.js";
import { shareRepository } from "./repositories/shares.js";
import { emptyPresentation, resolvePresentation, THEMES, LAYOUTS, ORIENTATIONS } from "./schema/presentation.js";
import { toMofang } from "./adapters/mofang.js";
import { hashPassword, verifyPassword } from "./share/security.js";
import { importPayload } from "./services/import.js";
import { mergeCanonical } from "./domain/patch.js";

const enc = new TextEncoder();

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}
function html(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}
function cookieSet(name, value, maxAge) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
function cookieClear(name) {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
function getCookie(req, name) {
  const raw = req.headers.get("Cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return "";
}
async function hmacHex(secret, text) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function ttlSec(env) {
  const n = Number(env.SESSION_TTL_SEC);
  return Number.isFinite(n) && n > 0 ? n : 7 * 24 * 3600;
}
async function adminToken(env, exp) {
  const payload = btoa(JSON.stringify({ exp, v: 1 }));
  return `${payload}.${await hmacHex(env.SESSION_SECRET, payload)}`;
}
async function readAdmin(req, env) {
  const tok = getCookie(req, "yr_admin");
  if (!tok || !env.SESSION_SECRET) return null;
  const i = tok.indexOf(".");
  if (i < 0) return null;
  const payload = tok.slice(0, i);
  const sig = tok.slice(i + 1);
  if (sig !== (await hmacHex(env.SESSION_SECRET, payload))) return null;
  try {
    const data = JSON.parse(atob(payload));
    if (!data.exp || Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}
async function shareUnlocked(req, env, token) {
  const tok = getCookie(req, "yr_share_" + token);
  if (!tok || !env.SESSION_SECRET) return false;
  return tok === (await hmacHex(env.SESSION_SECRET, "share:" + token));
}
function token128() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function asString(v) {
  return v == null ? "" : String(v);
}
function parseExpiry(body) {
  if (body.expiresAt === null || body.expiresAt === "never" || body.ttl === "never") return { expiresAt: null };
  if (body.expiresAt != null && body.expiresAt !== "") {
    const expiresAt = Number(body.expiresAt);
    if (!Number.isFinite(expiresAt)) throw new Error("expiresAt 无效");
    return { expiresAt };
  }
  if (body.ttlSec != null && body.ttlSec !== "") {
    const sec = Number(body.ttlSec);
    if (!Number.isFinite(sec) || sec <= 0) throw new Error("ttl 无效");
    return { expiresAt: Date.now() + sec * 1000 };
  }
  return undefined;
}
function failPage(title, msg) {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"/><meta name="robots" content="noindex"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${title}</title><link rel="stylesheet" href="/css/resume.css"/></head><body class="page"><main class="gate"><h1>${title}</h1><p>${msg}</p></main></body></html>`;
}
function unlockPage(token, err) {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"/><meta name="robots" content="noindex"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>解锁简历</title><link rel="stylesheet" href="/css/resume.css"/></head><body class="page"><form class="gate" method="post" action="/s/${token}/unlock"><h1>这份简历有访问密码</h1><input type="password" name="password" required autocomplete="current-password"/><button type="submit">查看</button>${err ? `<p class="err">${err}</p>` : ""}</form></body></html>`;
}
async function requireAdmin(req, env) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) return json({ error: "未配置 ADMIN_PASSWORD 或 SESSION_SECRET" }, 503);
  if (!(await readAdmin(req, env))) return json({ error: "未登录" }, 401);
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
function presentationFromQuery(url, fallback) {
  return resolvePresentation(fallback, {
    layout: url.searchParams.get("layout"),
    theme: url.searchParams.get("theme"),
    layoutVariant: url.searchParams.get("layoutVariant"),
    orientation: url.searchParams.get("orientation"),
  });
}
function presentationOverrideFromBody(body) {
  const raw = body.presentation ? { ...body, ...body.presentation } : body;
  const o = {};
  for (const k of ["layout", "layoutVariant", "theme", "orientation"]) {
    if (raw[k] === "inherit" || raw[k] === "" || raw[k] == null) o[k] = "inherit";
    else o[k] = raw[k];
  }
  if (raw.themeOverrides) o.themeOverrides = raw.themeOverrides;
  return o;
}
function presentationFromBody(body, fallback) {
  const raw = body.presentation ? { ...body, ...body.presentation } : body;
  return resolvePresentation(fallback, {
    layout: raw.layout,
    layoutVariant: raw.layoutVariant,
    theme: raw.theme,
    orientation: raw.orientation,
    themeOverrides: raw.themeOverrides,
  });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const method = req.method;
    const resumes = resumeRepository(env.RESUME_KV);
    const shares = shareRepository(env.RESUME_KV);

    if (path === "/s" || path.startsWith("/s/")) {
      const parts = path.split("/").filter(Boolean);
      const token = parts[1] || "";
      if (!/^[0-9a-f]{32}$/.test(token)) return html(failPage("链接无效", "token 格式不对。"), 400);
      if (parts[2] === "unlock" && method === "POST") {
        const share = await shares.get(token);
        if (!share) return html(failPage("链接无效", "没有这份分享。"), 404);
        if (share.revoked || (share.expiresAt != null && Date.now() > Number(share.expiresAt))) {
          return html(failPage("链接无效", "分享已失效。"), 410);
        }
        const body = await readBody(req);
        if (!(await verifyPassword(String(body.password || ""), share.passwordHash))) {
          return html(unlockPage(token, "密码不对"), 401);
        }
        const val = await hmacHex(env.SESSION_SECRET, "share:" + token);
        return new Response(null, { status: 303, headers: { Location: "/s/" + token, "Set-Cookie": cookieSet("yr_share_" + token, val, 12 * 3600) } });
      }
      if (method === "GET") {
        const share = await shares.get(token);
        if (!share) return html(failPage("链接无效", "没有这份分享，或已被撤销。"), 404);
        if (share.revoked) return html(failPage("链接无效", "分享已撤销。"), 410);
        if (share.expiresAt != null && Date.now() > Number(share.expiresAt)) {
          return html(failPage("链接已过期", "请联系分享者重新发一枚链接。"), 410);
        }
        if (share.passwordHash && !(await shareUnlocked(req, env, token))) return html(unlockPage(token), 200);
        const doc = await resumes.get(share.resumeId);
        if (!doc) return html(failPage("简历不存在", "分享指向的简历已删除。"), 404);
        const presentation = resolvePresentation(doc.presentation, share.presentation);
        return html(renderResume(doc.resume, presentation));
      }
    }

    if (path === "/login" && method === "GET") return asset(env, req, "/login.html");
    if (path === "/login" && method === "POST") {
      if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) return json({ error: "未配置 ADMIN_PASSWORD 或 SESSION_SECRET" }, 503);
      const body = await readBody(req);
      if (String(body.password || "") !== env.ADMIN_PASSWORD) {
        if ((req.headers.get("content-type") || "").includes("json")) return json({ error: "密码错误" }, 401);
        return new Response(null, { status: 303, headers: { Location: "/login?e=1" } });
      }
      const token = await adminToken(env, Date.now() + ttlSec(env) * 1000);
      const wantsJson = (req.headers.get("content-type") || "").includes("json") || (req.headers.get("accept") || "").includes("json");
      if (wantsJson) return json({ ok: true }, 200, { "Set-Cookie": cookieSet("yr_admin", token, ttlSec(env)) });
      return new Response(null, { status: 303, headers: { Location: "/admin", "Set-Cookie": cookieSet("yr_admin", token, ttlSec(env)) } });
    }
    if (path === "/logout" && method === "POST") return json({ ok: true }, 200, { "Set-Cookie": cookieClear("yr_admin") });

    if (path === "/admin" && method === "GET") {
      if (!(await readAdmin(req, env))) return new Response(null, { status: 302, headers: { Location: "/login" } });
      return asset(env, req, "/admin.html");
    }
    if (/^\/admin\/e\/[^/]+$/.test(path) && method === "GET") {
      if (!(await readAdmin(req, env))) return new Response(null, { status: 302, headers: { Location: "/login" } });
      return asset(env, req, "/edit.html");
    }
    const preview = path.match(/^\/admin\/preview\/([^/]+)$/);
    if (preview && method === "GET") {
      if (!(await readAdmin(req, env))) return new Response(null, { status: 302, headers: { Location: "/login" } });
      const doc = await resumes.get(decodeURIComponent(preview[1]));
      if (!doc) return html(failPage("没有这份简历", ""), 404);
      const presentation = presentationFromQuery(url, doc.presentation);
      return html(renderResume(doc.resume, presentation, { note: "后台预览，不会出现在公开默认页。" }));
    }

    if (path.startsWith("/api/")) {
      if (path === "/api/login" && method === "POST") {
        return fetch(new Request(new URL("/login", url).toString(), req));
      }
      const denied = await requireAdmin(req, env);
      if (denied) return denied;

      if (path === "/api/meta" && method === "GET") {
        return json({ layouts: LAYOUTS, themes: THEMES, orientations: ORIENTATIONS, adapters: listAdapters() });
      }

      if (path === "/api/import" && method === "POST") {
        let body;
        try { body = await req.json(); } catch { return json({ error: "坏 JSON", code: "IMPORT_INVALID_FORMAT" }, 400); }
        const got = importPayload(body.payload ?? body.json ?? body);
        if (!got.ok) {
          return json({ ok: false, error: got.errors.join("；"), code: "IMPORT_INVALID_FORMAT", errors: got.errors, format: got.format, warnings: got.warnings, stats: got.stats }, 400);
        }
        return json({ ok: true, format: got.format, canonical: got.canonical, warnings: got.warnings, stats: got.stats });
      }

      if (path === "/api/preview" && method === "POST") {
        let body;
        try { body = await req.json(); } catch { return json({ error: "坏 JSON" }, 400); }
        const got = ingest(body.resume || body);
        if (!got.ok) return json({ error: got.errors.join("；") }, 400);
        const presentation = presentationFromBody(body, emptyPresentation());
        return json({ html: renderResume(got.resume, presentation, { fragment: true }) });
      }

      if (path === "/api/resumes" && method === "GET") return json({ resumes: await resumes.list() });
      if (path === "/api/resumes" && method === "POST") {
        let body;
        try { body = await req.json(); } catch { return json({ error: "坏 JSON" }, 400); }
        const got = ingest(body.resume || body);
        if (!got.ok) return json({ error: got.errors.join("；"), errors: got.errors, format: got.format }, 400);
        const id = asString(body.id) || crypto.randomUUID();
        const presentation = presentationFromBody(body, emptyPresentation());
        const doc = await resumes.save(id, { resume: got.resume, presentation });
        return json(doc, 201);
      }
      const mofangPath = path.match(/^\/api\/resumes\/([^/]+)\/mofang$/);
      if (mofangPath && method === "GET") {
        const doc = await resumes.get(decodeURIComponent(mofangPath[1]));
        if (!doc) return json({ error: "不存在", code: "RESUME_NOT_FOUND" }, 404);
        return json(toMofang(doc.resume));
      }
      const projectPath = path.match(/^\/api\/resumes\/([^/]+)\/project$/);
      if (projectPath && method === "GET") {
        const doc = await resumes.get(decodeURIComponent(projectPath[1]));
        if (!doc) return json({ error: "不存在", code: "RESUME_NOT_FOUND" }, 404);
        return json({ format: "yiyue-project", version: 1, resume: doc.resume, presentation: doc.presentation });
      }
      const one = path.match(/^\/api\/resumes\/([^/]+)$/);
      if (one) {
        const id = decodeURIComponent(one[1]);
        if (method === "GET") {
          const doc = await resumes.get(id);
          return doc ? json(doc) : json({ error: "不存在" }, 404);
        }
        if (method === "PUT") {
          let body;
          try { body = await req.json(); } catch { return json({ error: "坏 JSON" }, 400); }
          const got = ingest(body.resume || body);
          if (!got.ok) return json({ error: got.errors.join("；"), errors: got.errors }, 400);
          const prev = await resumes.get(id);
          const resume = mergeCanonical(prev?.resume, got.resume);
          const presentation = presentationFromBody(body, prev?.presentation);
          const doc = await resumes.save(id, { resume, presentation, createdAt: prev?.createdAt });
          return json(doc);
        }
        if (method === "DELETE") {
          await resumes.remove(id);
          return json({ ok: true });
        }
      }

      if (path === "/api/shares" && method === "GET") {
        const list = await resumes.list();
        return json({ shares: await shares.list(list.map((r) => r.id)) });
      }
      if (path === "/api/shares" && method === "POST") {
        let body;
        try { body = await req.json(); } catch { return json({ error: "坏 JSON" }, 400); }
        const resumeId = asString(body.resumeId);
        if (!resumeId) return json({ error: "需要 resumeId" }, 400);
        const exists = await resumes.get(resumeId);
        if (!exists) return json({ error: "简历不存在" }, 400);
        let expiresAt = null;
        try {
          const exp = parseExpiry(body);
          if (exp) expiresAt = exp.expiresAt;
        } catch (e) { return json({ error: e.message }, 400); }
        const token = token128();
        const share = {
          token,
          resumeId,
          presentation: presentationOverrideFromBody(body),
          passwordHash: body.password ? await hashPassword(String(body.password)) : null,
          expiresAt,
          createdAt: Date.now(),
          revoked: false,
          label: asString(body.label),
        };
        await shares.save(token, share);
        return json(shares.publicShare(share), 201);
      }
      const sh = path.match(/^\/api\/shares\/([^/]+)$/);
      if (sh) {
        const token = decodeURIComponent(sh[1]);
        if (method === "DELETE") {
          const s = await shares.get(token);
          if (s) {
            s.revoked = true;
            await shares.save(token, s);
          }
          return json({ ok: true });
        }
        if (method === "PATCH") {
          const s = await shares.get(token);
          if (!s) return json({ error: "不存在" }, 404);
          if (s.revoked) return json({ error: "已撤销，不能改" }, 400);
          let body;
          try { body = await req.json(); } catch { return json({ error: "坏 JSON" }, 400); }
          if (body.resumeId) {
            const exists = await resumes.get(asString(body.resumeId));
            if (!exists) return json({ error: "简历不存在" }, 400);
            s.resumeId = asString(body.resumeId);
          }
          if (body.presentation || body.theme != null || body.layout != null || body.orientation != null) {
            s.presentation = presentationOverrideFromBody(body);
          }
          if (body.label != null) s.label = asString(body.label);
          if (body.clearPassword) s.passwordHash = null;
          else if (body.password) s.passwordHash = await hashPassword(String(body.password));
          try {
            const exp = parseExpiry(body);
            if (exp) s.expiresAt = exp.expiresAt;
          } catch (e) { return json({ error: e.message }, 400); }
          s.token = token;
          await shares.save(token, s);
          return json(shares.publicShare(s));
        }
      }
      return json({ error: "无此接口" }, 404);
    }

    if (path === "/") return asset(env, req, "/index.html");
    return env.ASSETS.fetch(req);
  },
};
