const THEMES = ["paper", "ink", "night", "plain"];
const enc = new TextEncoder();

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

function html(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeHref(href) {
  const h = String(href || "");
  if (/^(https?:|mailto:)/i.test(h)) return h;
  return "";
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
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function ttlSec(env) {
  const n = Number(env.SESSION_TTL_SEC);
  return Number.isFinite(n) && n > 0 ? n : 7 * 24 * 3600;
}

async function adminToken(env, exp) {
  const payload = btoa(JSON.stringify({ exp, v: 1 }));
  const sig = await hmacHex(env.SESSION_SECRET, payload);
  return `${payload}.${sig}`;
}

async function readAdmin(req, env) {
  const tok = getCookie(req, "yr_admin");
  if (!tok || !env.SESSION_SECRET) return null;
  const i = tok.indexOf(".");
  if (i < 0) return null;
  const payload = tok.slice(0, i);
  const sig = tok.slice(i + 1);
  const expect = await hmacHex(env.SESSION_SECRET, payload);
  if (sig !== expect) return null;
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
  const expect = await hmacHex(env.SESSION_SECRET, "share:" + token);
  return tok === expect;
}

async function kvList(env, key) {
  const raw = await env.RESUME_KV.get(key);
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

async function kvListPut(env, key, list) {
  await env.RESUME_KV.put(key, JSON.stringify(list));
}

async function mergeIndex(env, prefix, indexKey) {
  const fromIndex = await kvList(env, indexKey);
  const fromKv = [];
  let cursor;
  do {
    const page = await env.RESUME_KV.list({ prefix, limit: 1000, cursor });
    for (const k of page.keys) {
      if (k.name === indexKey) continue;
      fromKv.push(k.name.slice(prefix.length));
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  const seen = new Set();
  const merged = [];
  for (const id of fromIndex.concat(fromKv)) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(id);
  }
  if (JSON.stringify(merged) !== JSON.stringify(fromIndex)) {
    await kvListPut(env, indexKey, merged);
  }
  return merged;
}

function parseExpiry(body) {
  if (body.expiresAt === null || body.expiresAt === "never" || body.ttl === "never") {
    return { expiresAt: null };
  }
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

function sharePublic(s) {
  return {
    token: s.token,
    resumeId: s.resumeId,
    theme: s.theme || "",
    hasPassword: !!s.passwordHash,
    expiresAt: s.expiresAt,
    createdAt: s.createdAt,
    revoked: !!s.revoked,
    label: s.label || "",
    url: "/s/" + s.token,
  };
}

function asString(v) {
  return v == null ? "" : String(v);
}

function asPoints(v) {
  if (!Array.isArray(v)) return [];
  return v.map(asString);
}

function asLinks(v) {
  if (!Array.isArray(v)) return [];
  return v.map((x) => ({
    label: asString(x?.label),
    href: asString(x?.href),
  }));
}

function asJobs(v) {
  if (!Array.isArray(v)) return [];
  return v.map((x) => ({
    role: asString(x?.role),
    org: asString(x?.org),
    time: asString(x?.time),
    points: asPoints(x?.points),
  }));
}

export function normalizeResume(raw, fallbackId) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("简历必须是 JSON 对象");
  }
  const theme = THEMES.includes(raw.theme) ? raw.theme : "paper";
  const id = asString(raw.id) || fallbackId || crypto.randomUUID();
  return {
    id,
    theme,
    variant: asString(raw.variant),
    name: asString(raw.name),
    nameEn: asString(raw.nameEn),
    tagline: asString(raw.tagline),
    links: asLinks(raw.links),
    contact: asLinks(raw.contact),
    skills: asPoints(raw.skills),
    experience: asJobs(raw.experience),
    projects: asJobs(raw.projects),
  };
}

function token128() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function themeOf(resume, share) {
  const t = share.theme || resume.theme || "paper";
  return THEMES.includes(t) ? t : "paper";
}

function jobsHtml(list, emptyMsg) {
  if (!list.length) return `<p class="empty">${esc(emptyMsg)}</p>`;
  return list
    .map((j) => {
      const pts = (j.points || []).filter(Boolean);
      const ul = pts.length
        ? `<ul>${pts.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`
        : "";
      return `<article class="job">
        <div class="job-head">
          <div>
            <span class="job-role">${esc(j.role)}</span>
            ${j.org ? `<span class="job-org"> · ${esc(j.org)}</span>` : ""}
          </div>
          <div class="job-time">${esc(j.time)}</div>
        </div>${ul}
      </article>`;
    })
    .join("");
}

function resumePage(resume, theme, opts = {}) {
  const links = (resume.links || [])
    .filter((l) => l.label)
    .map((l) => {
      const href = safeHref(l.href);
      return href
        ? `<div><a href="${esc(href)}">${esc(l.label)}</a></div>`
        : `<div>${esc(l.label)}</div>`;
    })
    .join("");
  const contact = (resume.contact || []).filter((c) => c.label);
  const contactHtml = contact.length
    ? contact
        .map((c) => {
          const href = safeHref(c.href);
          return href
            ? `<p><a href="${esc(href)}">${esc(c.label)}</a></p>`
            : `<p>${esc(c.label)}</p>`;
        })
        .join("")
    : `<p class="empty">未放联系方式</p>`;
  const skills = (resume.skills || []).filter(Boolean);
  const skillsHtml = skills.length
    ? `<ul>${skills.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`
    : `<p class="empty">这一版未列技能</p>`;

  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="${esc(theme)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>${esc(resume.name || "简历")}${resume.variant ? " · " + esc(resume.variant) : ""}</title>
  <link rel="stylesheet" href="/css/resume.css" />
</head>
<body class="page">
  <article class="sheet">
    <header class="top">
      <div>
        <h1 class="name">${esc(resume.name)}</h1>
        ${resume.nameEn ? `<p class="name-en">${esc(resume.nameEn)}</p>` : ""}
        ${resume.tagline ? `<p class="tagline">${esc(resume.tagline)}</p>` : ""}
      </div>
      <div class="meta">
        ${resume.variant ? `<div class="variant">${esc(resume.variant)}</div>` : ""}
        ${links}
        <div class="actions"><button type="button" onclick="window.print()">打印 / PDF</button></div>
      </div>
    </header>
    <div class="body">
      <div>
        <section>
          <h2>经历</h2>
          ${jobsHtml(resume.experience || [], "这一版还没写经历。")}
        </section>
        <section>
          <h2>项目</h2>
          ${jobsHtml(resume.projects || [], "这一版还没写项目。")}
        </section>
      </div>
      <aside class="rail">
        <section class="contact"><h2>联系</h2>${contactHtml}</section>
        <section><h2>技能</h2>${skillsHtml}</section>
      </aside>
    </div>
    ${opts.note ? `<footer class="note">${esc(opts.note)}</footer>` : ""}
  </article>
</body>
</html>`;
}

function failPage(title, msg) {
  return `<!DOCTYPE html>
<html lang="zh-CN"><head>
<meta charset="utf-8"/><meta name="robots" content="noindex"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)}</title>
<link rel="stylesheet" href="/css/resume.css"/>
</head>
<body class="page">
  <main class="gate"><h1>${esc(title)}</h1><p>${esc(msg)}</p></main>
</body></html>`;
}

function unlockPage(token, err) {
  return `<!DOCTYPE html>
<html lang="zh-CN"><head>
<meta charset="utf-8"/><meta name="robots" content="noindex"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>解锁简历</title>
<link rel="stylesheet" href="/css/resume.css"/>
</head>
<body class="page">
  <form class="gate" method="post" action="/s/${esc(token)}/unlock">
    <h1>这份简历有访问密码</h1>
    <input type="password" name="password" required autocomplete="current-password" />
    <button type="submit">查看</button>
    ${err ? `<p class="err">${esc(err)}</p>` : ""}
  </form>
</body></html>`;
}

async function requireAdmin(req, env) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
    return json({ error: "未配置 ADMIN_PASSWORD 或 SESSION_SECRET" }, 503);
  }
  const ok = await readAdmin(req, env);
  if (!ok) return json({ error: "未登录" }, 401);
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
  if (ct.includes("form")) {
    const fd = await req.formData();
    return Object.fromEntries(fd.entries());
  }
  const t = await req.text();
  if (!t) return {};
  try {
    return JSON.parse(t);
  } catch {
    return {};
  }
}

async function handleShareGet(req, env, token) {
  const raw = await env.RESUME_KV.get("share:" + token);
  if (!raw) return html(failPage("链接无效", "没有这份分享，或已被撤销。"), 404);
  const share = JSON.parse(raw);
  if (share.revoked) return html(failPage("链接无效", "分享已撤销。"), 410);
  if (share.expiresAt != null && Date.now() > Number(share.expiresAt)) {
    return html(failPage("链接已过期", "请联系分享者重新发一枚链接。"), 410);
  }
  if (share.passwordHash) {
    const unlocked = await shareUnlocked(req, env, token);
    if (!unlocked) return html(unlockPage(token), 200);
  }
  const resumeRaw = await env.RESUME_KV.get("resume:" + share.resumeId);
  if (!resumeRaw) return html(failPage("简历不存在", "分享指向的简历已删除。"), 404);
  const resume = normalizeResume(JSON.parse(resumeRaw), share.resumeId);
  const theme = themeOf(resume, share);
  return html(resumePage(resume, theme));
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const method = req.method;

    if (path === "/s" || path.startsWith("/s/")) {
      const parts = path.split("/").filter(Boolean);
      const token = parts[1] || "";
      if (!/^[0-9a-f]{32}$/.test(token)) {
        return html(failPage("链接无效", "token 格式不对。"), 400);
      }
      if (parts[2] === "unlock" && method === "POST") {
        const raw = await env.RESUME_KV.get("share:" + token);
        if (!raw) return html(failPage("链接无效", "没有这份分享。"), 404);
        const share = JSON.parse(raw);
        if (share.revoked || (share.expiresAt != null && Date.now() > Number(share.expiresAt))) {
          return html(failPage("链接无效", "分享已失效。"), 410);
        }
        const body = await readBody(req);
        const hash = await sha256hex(String(body.password || ""));
        if (!share.passwordHash || hash !== share.passwordHash) {
          return html(unlockPage(token, "密码不对"), 401);
        }
        const val = await hmacHex(env.SESSION_SECRET, "share:" + token);
        return new Response(null, {
          status: 303,
          headers: {
            Location: "/s/" + token,
            "Set-Cookie": cookieSet("yr_share_" + token, val, 12 * 3600),
          },
        });
      }
      if (method === "GET") return handleShareGet(req, env, token);
    }

    if (path === "/login" && method === "GET") return asset(env, req, "/login.html");
    if (path === "/login" && method === "POST") {
      if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
        return json({ error: "未配置 ADMIN_PASSWORD 或 SESSION_SECRET" }, 503);
      }
      const body = await readBody(req);
      if (String(body.password || "") !== env.ADMIN_PASSWORD) {
        const u = new URL(req.url);
        if ((req.headers.get("content-type") || "").includes("json")) {
          return json({ error: "密码错误" }, 401);
        }
        return new Response(null, { status: 303, headers: { Location: "/login?e=1" } });
      }
      const token = await adminToken(env, Date.now() + ttlSec(env) * 1000);
      const wantsJson = (req.headers.get("content-type") || "").includes("json") ||
        (req.headers.get("accept") || "").includes("json");
      if (wantsJson) {
        return json({ ok: true }, 200, { "Set-Cookie": cookieSet("yr_admin", token, ttlSec(env)) });
      }
      return new Response(null, {
        status: 303,
        headers: {
          Location: "/admin",
          "Set-Cookie": cookieSet("yr_admin", token, ttlSec(env)),
        },
      });
    }

    if (path === "/logout" && method === "POST") {
      return json({ ok: true }, 200, { "Set-Cookie": cookieClear("yr_admin") });
    }

    if (path === "/admin" && method === "GET") {
      const ok = await readAdmin(req, env);
      if (!ok) {
        return new Response(null, { status: 302, headers: { Location: "/login" } });
      }
      return asset(env, req, "/admin.html");
    }

    const preview = path.match(/^\/admin\/preview\/([^/]+)$/);
    if (preview && method === "GET") {
      const denied = await requireAdmin(req, env);
      if (denied) return new Response(null, { status: 302, headers: { Location: "/login" } });
      const id = decodeURIComponent(preview[1]);
      const raw = await env.RESUME_KV.get("resume:" + id);
      if (!raw) return html(failPage("没有这份简历", ""), 404);
      const resume = normalizeResume(JSON.parse(raw), id);
      let theme = url.searchParams.get("theme") || resume.theme;
      if (!THEMES.includes(theme)) theme = "paper";
      return html(resumePage(resume, theme, { note: "后台预览，不会出现在公开默认页。" }));
    }

    if (path.startsWith("/api/")) {
      if (path === "/api/login" && method === "POST") {
        const u = new URL(req.url);
        return fetch(new Request(new URL("/login", u).toString(), req));
      }
      const denied = await requireAdmin(req, env);
      if (denied) return denied;

      if (path === "/api/resumes" && method === "GET") {
        const ids = await mergeIndex(env, "resume:", "resume:index");
        const resumes = [];
        for (const id of ids) {
          const raw = await env.RESUME_KV.get("resume:" + id);
          if (!raw) continue;
          try {
            const r = normalizeResume(JSON.parse(raw), id);
            resumes.push({ id: r.id, name: r.name, variant: r.variant, theme: r.theme });
          } catch { /* skip bad */ }
        }
        return json({ resumes });
      }

      if (path === "/api/resumes" && method === "POST") {
        let body;
        try { body = await req.json(); } catch { return json({ error: "坏 JSON" }, 400); }
        let doc;
        try { doc = normalizeResume(body); } catch (e) { return json({ error: e.message }, 400); }
        await env.RESUME_KV.put("resume:" + doc.id, JSON.stringify(doc));
        const ids = await kvList(env, "resume:index");
        if (!ids.includes(doc.id)) {
          ids.unshift(doc.id);
          await kvListPut(env, "resume:index", ids);
        }
        return json(doc, 201);
      }

      const one = path.match(/^\/api\/resumes\/([^/]+)$/);
      if (one) {
        const id = decodeURIComponent(one[1]);
        if (method === "GET") {
          const raw = await env.RESUME_KV.get("resume:" + id);
          if (!raw) return json({ error: "不存在" }, 404);
          try { return json(normalizeResume(JSON.parse(raw), id)); }
          catch (e) { return json({ error: e.message }, 400); }
        }
        if (method === "PUT") {
          let body;
          try { body = await req.json(); } catch { return json({ error: "坏 JSON" }, 400); }
          let doc;
          try { doc = normalizeResume({ ...body, id }, id); } catch (e) { return json({ error: e.message }, 400); }
          await env.RESUME_KV.put("resume:" + id, JSON.stringify(doc));
          const ids = await kvList(env, "resume:index");
          if (!ids.includes(id)) {
            ids.unshift(id);
            await kvListPut(env, "resume:index", ids);
          }
          return json(doc);
        }
        if (method === "DELETE") {
          await env.RESUME_KV.delete("resume:" + id);
          const ids = (await kvList(env, "resume:index")).filter((x) => x !== id);
          await kvListPut(env, "resume:index", ids);
          return json({ ok: true });
        }
      }

      if (path === "/api/shares" && method === "GET") {
        const tokens = await mergeIndex(env, "share:", "share:index");
        const shares = [];
        for (const token of tokens) {
          const raw = await env.RESUME_KV.get("share:" + token);
          if (!raw) continue;
          shares.push(sharePublic(JSON.parse(raw)));
        }
        return json({ shares });
      }

      if (path === "/api/shares" && method === "POST") {
        let body;
        try { body = await req.json(); } catch { return json({ error: "坏 JSON" }, 400); }
        const resumeId = asString(body.resumeId);
        if (!resumeId) return json({ error: "需要 resumeId" }, 400);
        const exists = await env.RESUME_KV.get("resume:" + resumeId);
        if (!exists) return json({ error: "简历不存在" }, 400);
        let theme = asString(body.theme);
        if (theme && !THEMES.includes(theme)) return json({ error: "未知主题" }, 400);
        let expiresAt = null;
        try {
          const exp = parseExpiry(body);
          if (exp) expiresAt = exp.expiresAt;
        } catch (e) {
          return json({ error: e.message }, 400);
        }
        const token = token128();
        const share = {
          token,
          resumeId,
          theme: theme || "",
          passwordHash: body.password ? await sha256hex(String(body.password)) : null,
          expiresAt,
          createdAt: Date.now(),
          revoked: false,
          label: asString(body.label),
        };
        await env.RESUME_KV.put("share:" + token, JSON.stringify(share));
        const tokens = await kvList(env, "share:index");
        tokens.unshift(token);
        await kvListPut(env, "share:index", tokens);
        return json({ ...share, passwordHash: undefined, hasPassword: !!share.passwordHash, url: "/s/" + token }, 201);
      }

      const sh = path.match(/^\/api\/shares\/([^/]+)$/);
      if (sh) {
        const token = decodeURIComponent(sh[1]);
        if (method === "DELETE") {
          const raw = await env.RESUME_KV.get("share:" + token);
          if (raw) {
            const s = JSON.parse(raw);
            s.revoked = true;
            await env.RESUME_KV.put("share:" + token, JSON.stringify(s));
          }
          return json({ ok: true });
        }
        if (method === "PATCH") {
          const raw = await env.RESUME_KV.get("share:" + token);
          if (!raw) return json({ error: "不存在" }, 404);
          const s = JSON.parse(raw);
          if (s.revoked) return json({ error: "已撤销，不能改" }, 400);
          let body;
          try { body = await req.json(); } catch { return json({ error: "坏 JSON" }, 400); }
          if (body.resumeId != null && body.resumeId !== "") {
            const resumeId = asString(body.resumeId);
            const exists = await env.RESUME_KV.get("resume:" + resumeId);
            if (!exists) return json({ error: "简历不存在" }, 400);
            s.resumeId = resumeId;
          }
          if (body.theme != null) {
            const theme = asString(body.theme);
            if (theme && !THEMES.includes(theme)) return json({ error: "未知主题" }, 400);
            s.theme = theme;
          }
          if (body.label != null) s.label = asString(body.label);
          if (body.clearPassword) s.passwordHash = null;
          else if (body.password) s.passwordHash = await sha256hex(String(body.password));
          try {
            const exp = parseExpiry(body);
            if (exp) s.expiresAt = exp.expiresAt;
          } catch (e) {
            return json({ error: e.message }, 400);
          }
          s.token = token;
          await env.RESUME_KV.put("share:" + token, JSON.stringify(s));
          return json(sharePublic(s));
        }
      }

      return json({ error: "无此接口" }, 404);
    }

    if (path === "/") return asset(env, req, "/index.html");
    return env.ASSETS.fetch(req);
  },
};
