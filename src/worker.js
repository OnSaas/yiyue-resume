const enc = new TextEncoder();

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extra.headers,
    },
  });
}

function cookie(token, maxAge) {
  const parts = [
    `yr_session=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  return parts.join("; ");
}

async function hmac(secret, text) {
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

async function makeToken(env, exp) {
  const payload = btoa(JSON.stringify({ exp }));
  const sig = await hmac(env.SESSION_SECRET || env.ADMIN_PASSWORD, payload);
  return `${payload}.${sig}`;
}

async function readToken(env, token) {
  if (!token) return null;
  const i = token.indexOf(".");
  if (i < 0) return null;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expect = await hmac(env.SESSION_SECRET || env.ADMIN_PASSWORD, payload);
  if (sig !== expect) return null;
  try {
    const data = JSON.parse(atob(payload));
    if (!data.exp || Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

function getCookie(req, name) {
  const raw = req.headers.get("Cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return "";
}

async function requireAuth(req, env) {
  if (!env.ADMIN_PASSWORD) return json({ error: "未配置 ADMIN_PASSWORD" }, 503);
  const tok = getCookie(req, "yr_session");
  const ok = await readToken(env, tok);
  return ok ? null : json({ error: "未登录" }, 401);
}

async function indexGet(env) {
  const raw = await env.RESUME_KV.get("meta:index");
  if (!raw) return { ids: [] };
  try {
    return JSON.parse(raw);
  } catch {
    return { ids: [] };
  }
}

async function indexPut(env, idx) {
  await env.RESUME_KV.put("meta:index", JSON.stringify(idx));
}

async function resumeGet(env, id) {
  const raw = await env.RESUME_KV.get(`resume:${id}`);
  return raw ? JSON.parse(raw) : null;
}

async function resumePut(env, doc) {
  await env.RESUME_KV.put(`resume:${doc.id}`, JSON.stringify(doc));
  const idx = await indexGet(env);
  if (!idx.ids.includes(doc.id)) idx.ids.unshift(doc.id);
  await indexPut(env, idx);
}

async function resumeDel(env, id) {
  await env.RESUME_KV.delete(`resume:${id}`);
  const idx = await indexGet(env);
  idx.ids = idx.ids.filter((x) => x !== id);
  await indexPut(env, idx);
}

function summary(doc) {
  return {
    id: doc.id,
    title: doc.title || "未命名",
    slug: doc.slug || "",
    isPublic: !!doc.isPublic,
    updatedAt: doc.updatedAt,
    name: doc.basic?.name || "",
  };
}

async function handleApi(req, env) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = req.method;

  if (method === "POST" && path === "/api/login") {
    if (!env.ADMIN_PASSWORD) return json({ error: "未配置 ADMIN_PASSWORD" }, 503);
    let body = {};
    try {
      body = await req.json();
    } catch {
      return json({ error: "无效 JSON" }, 400);
    }
    if (body.password !== env.ADMIN_PASSWORD) return json({ error: "密码错误" }, 401);
    const token = await makeToken(env, Date.now() + 30 * 24 * 3600 * 1000);
    return json(
      { ok: true },
      200,
      { headers: { "Set-Cookie": cookie(token, 30 * 24 * 3600) } }
    );
  }

  if (method === "POST" && path === "/api/logout") {
    return json({ ok: true }, 200, { headers: { "Set-Cookie": cookie("", 0) } });
  }

  if (method === "GET" && path.startsWith("/api/public/")) {
    const slug = decodeURIComponent(path.slice("/api/public/".length));
    const idx = await indexGet(env);
    for (const id of idx.ids) {
      const doc = await resumeGet(env, id);
      if (!doc || !doc.isPublic) continue;
      if ((doc.slug || "") === slug || (slug === "default" && doc.slug === "default")) {
        return json(doc);
      }
    }
    if (slug === "default") {
      for (const id of idx.ids) {
        const doc = await resumeGet(env, id);
        if (doc?.isPublic) return json(doc);
      }
    }
    return json({ error: "没有这份公开简历" }, 404);
  }

  const denied = await requireAuth(req, env);
  if (denied) return denied;

  if (method === "GET" && path === "/api/me") return json({ ok: true });

  if (method === "GET" && path === "/api/resumes") {
    const idx = await indexGet(env);
    const list = [];
    for (const id of idx.ids) {
      const doc = await resumeGet(env, id);
      if (doc) list.push(summary(doc));
    }
    return json({ resumes: list });
  }

  if (method === "POST" && path === "/api/resumes") {
    let body = {};
    try {
      body = await req.json();
    } catch {
      return json({ error: "无效 JSON" }, 400);
    }
    const now = new Date().toISOString();
    const id = body.id || crypto.randomUUID();
    const doc = {
      ...body,
      id,
      createdAt: body.createdAt || now,
      updatedAt: now,
    };
    await resumePut(env, doc);
    return json(doc, 201);
  }

  const one = path.match(/^\/api\/resumes\/([^/]+)$/);
  if (one) {
    const id = decodeURIComponent(one[1]);
    if (method === "GET") {
      const doc = await resumeGet(env, id);
      return doc ? json(doc) : json({ error: "不存在" }, 404);
    }
    if (method === "PUT") {
      const prev = await resumeGet(env, id);
      if (!prev) return json({ error: "不存在" }, 404);
      let body = {};
      try {
        body = await req.json();
      } catch {
        return json({ error: "无效 JSON" }, 400);
      }
      const doc = { ...prev, ...body, id, updatedAt: new Date().toISOString() };
      await resumePut(env, doc);
      return json(doc);
    }
    if (method === "DELETE") {
      await resumeDel(env, id);
      return json({ ok: true });
    }
  }

  const dup = path.match(/^\/api\/resumes\/([^/]+)\/duplicate$/);
  if (dup && method === "POST") {
    const src = await resumeGet(env, decodeURIComponent(dup[1]));
    if (!src) return json({ error: "不存在" }, 404);
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const doc = {
      ...JSON.parse(JSON.stringify(src)),
      id,
      title: (src.title || "简历") + " 副本",
      slug: src.slug ? src.slug + "-copy" : "",
      isPublic: false,
      createdAt: now,
      updatedAt: now,
    };
    await resumePut(env, doc);
    return json(doc, 201);
  }

  return json({ error: "无此接口" }, 404);
}

function assetRequest(req, pathname) {
  const u = new URL(req.url);
  u.pathname = pathname;
  return new Request(u.toString(), req);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) return handleApi(req, env);
    if (url.pathname === "/admin" || url.pathname === "/admin/") {
      return env.ASSETS.fetch(assetRequest(req, "/admin.html"));
    }
    if (url.pathname.startsWith("/r/")) {
      return env.ASSETS.fetch(assetRequest(req, "/index.html"));
    }
    return env.ASSETS.fetch(req);
  },
};
