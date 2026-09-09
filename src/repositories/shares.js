import { normalizePresentation, emptyPresentation } from "../schema/presentation.js";

function publicShare(s) {
  const presentation = normalizePresentation(s.presentation || { theme: s.theme });
  return {
    token: s.token,
    resumeId: s.resumeId,
    theme: presentation.theme,
    layout: presentation.layout,
    layoutVariant: presentation.layoutVariant,
    presentation,
    hasPassword: !!s.passwordHash,
    expiresAt: s.expiresAt,
    createdAt: s.createdAt,
    revoked: !!s.revoked,
    label: s.label || "",
    url: "/s/" + s.token,
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
      if (!s.presentation) s.presentation = { ...emptyPresentation(), theme: s.theme || "paper" };
      else s.presentation = normalizePresentation(s.presentation);
      return s;
    },
    async save(token, share) {
      await kv.put("share:" + token, JSON.stringify(share));
      return share;
    },
    async list() {
      const tokens = await listTokens();
      const rows = await Promise.all(tokens.map((t) => this.get(t)));
      return rows.filter(Boolean).map(publicShare);
    },
    publicShare,
  };
}
