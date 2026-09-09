import { shareRepository } from "../repositories/shares.js";
import { resolvePresentation } from "../schema/presentation.js";
import { hashPassword, verifyPassword } from "../share/security.js";
import { ShareError } from "../domain/errors.js";

function inheritToken(v) {
  return v === null || v === undefined || v === "" || v === "inherit";
}

export function presentationOverrideFromBody(body) {
  const raw = body?.presentation ? { ...body, ...body.presentation } : body || {};
  const out = {};
  for (const k of ["layout", "layoutVariant", "theme", "orientation"]) {
    out[k] = inheritToken(raw[k]) ? "inherit" : raw[k];
  }
  if (raw.themeOverrides && typeof raw.themeOverrides === "object") out.themeOverrides = raw.themeOverrides;
  return out;
}

export function shareService(kv) {
  const repo = shareRepository(kv);
  return {
    get: (token) => repo.get(token),
    list: (ids) => repo.list(ids),
    publicShare: repo.publicShare,
    resolvePresentation,
    presentationOverrideFromBody,
    async create(body, exists) {
      if (!exists) throw new ShareError("RESUME_NOT_FOUND", "简历不存在", 404);
      const token = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
      const passwordHash = body.password ? await hashPassword(body.password) : null;
      const share = {
        token,
        resumeId: exists.id,
        presentation: presentationOverrideFromBody(body),
        passwordHash,
        expiresAt: body.expiresAt ?? null,
        createdAt: Date.now(),
        revoked: false,
        label: body.label || "",
      };
      await repo.save(token, share);
      return share;
    },
    async patch(token, body) {
      const s = await repo.get(token);
      if (!s) throw new ShareError("SHARE_NOT_FOUND", "不存在", 404);
      if (s.revoked) throw new ShareError("SHARE_REVOKED", "已撤销，不能改", 400);
      if (body.resumeId) s.resumeId = body.resumeId;
      if (body.label != null) s.label = body.label;
      if (body.presentation || body.theme != null || body.layout != null || body.orientation != null) {
        s.presentation = presentationOverrideFromBody(body);
      }
      if (body.clearPassword) s.passwordHash = null;
      else if (body.password) s.passwordHash = await hashPassword(body.password);
      if (body.expiresAt !== undefined) s.expiresAt = body.expiresAt;
      else if (body.ttl === "never") s.expiresAt = null;
      else if (body.ttlSec) s.expiresAt = Date.now() + Number(body.ttlSec) * 1000;
      await repo.save(token, s);
      return s;
    },
    async revoke(token) {
      const s = await repo.get(token);
      if (!s) throw new ShareError("SHARE_NOT_FOUND", "不存在", 404);
      s.revoked = true;
      await repo.save(token, s);
      return s;
    },
    async verifyUnlock(share, password) {
      if (!share.passwordHash) return true;
      return verifyPassword(password || "", share.passwordHash);
    },
  };
}
