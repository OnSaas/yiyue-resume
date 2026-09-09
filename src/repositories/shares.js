import { emptyPresentation } from "../schema/presentation.js";

function publicShare(s) {
  const p = s.presentation || {};
  return {
    token: s.token,
    resumeId: s.resumeId,
    theme: p.theme || s.theme || "inherit",
    layout: p.layout || "inherit",
    layoutVariant: p.layoutVariant || "inherit",
    orientation: p.orientation || "inherit",
    presentation: p,
    hasPassword: !!s.passwordHash,
    expiresAt: s.expiresAt,
    createdAt: s.createdAt,
    revoked: !!s.revoked,
    label: s.label || "",
    url: "/s/" + s.token,
    resumeMissing: !!s.resumeMissing,
  };
}

export function shareRepository(kv) {
  async function listTokens() {
    const tokens = [];
    let cursor;
    do {
      const page = await kv.list({ prefix: "share:", limit: 1000, cursor });
      for (const k of page.keys) {
        if (k.name === "share:index") continue;
        tokens.push(k.name.slice("share:".length));
      }
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
    return tokens;
  }

  return {
    async get(token) {
      const raw = await kv.get("share:" + token);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s.presentation) s.presentation = { layout: "inherit", theme: s.theme || "inherit", orientation: "inherit", layoutVariant: "inherit" };
      return s;
    },
    async save(token, share) {
      await kv.put("share:" + token, JSON.stringify(share));
      return share;
    },
    async list(resumeIds) {
      const tokens = await listTokens();
      const rows = await Promise.all(tokens.map((t) => this.get(t)));
      const set = resumeIds ? new Set(resumeIds) : null;
      return rows.filter(Boolean).map((s) => publicShare({ ...s, resumeMissing: set ? !set.has(s.resumeId) : false }));
    },
    publicShare,
  };
}
