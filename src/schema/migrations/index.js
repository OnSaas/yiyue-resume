import { sanitizeCanonical } from "../resume.js";

export const CURRENT_SCHEMA_VERSION = 1;

/** 旧数据 → 最新 Canonical。Renderer 只吃最新版。 */
export function migrateResume(raw) {
  const version = Number(raw?.schemaVersion) || 1;
  let doc = raw && typeof raw === "object" ? { ...raw } : {};
  if (version < 1) doc = { ...doc, schemaVersion: 1 };
  const out = sanitizeCanonical(doc);
  out.schemaVersion = CURRENT_SCHEMA_VERSION;
  return out;
}
