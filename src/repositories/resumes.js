import { ingest } from "../adapters/index.js";
import { emptyCanonical, sanitizeCanonical } from "../schema/resume.js";
import { normalizePresentation } from "../schema/presentation.js";

function asDoc(id, parsed) {
  if (parsed && parsed.resume && parsed.resume.basics) {
    return {
      id,
      schemaVersion: parsed.schemaVersion || 1,
      createdAt: parsed.createdAt,
      updatedAt: parsed.updatedAt,
      resume: sanitizeCanonical(parsed.resume),
      presentation: normalizePresentation(parsed.presentation || parsed),
    };
  }
  const got = ingest(parsed);
  const presentation = normalizePresentation({
    theme: parsed?.theme,
    layout: parsed?.layout,
    layoutVariant: parsed?.layoutVariant,
    themeOverrides: parsed?.themeOverrides,
    ...(parsed?.presentation || {}),
  });
  return {
    id,
    schemaVersion: 1,
    createdAt: parsed?.createdAt,
    updatedAt: parsed?.updatedAt,
    resume: got.ok ? got.resume : emptyCanonical(),
    presentation,
  };
}

export function resumeRepository(kv) {
  async function listIds() {
    const ids = [];
    let cursor;
    do {
      const page = await kv.list({ prefix: "resume:", limit: 1000, cursor });
      for (const k of page.keys) {
        if (k.name === "resume:index") continue;
        ids.push(k.name.slice("resume:".length));
      }
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
    return ids;
  }

  return {
    async get(id) {
      const raw = await kv.get("resume:" + id);
      if (!raw) return null;
      try {
        return asDoc(id, JSON.parse(raw));
      } catch {
        return null;
      }
    },
    async save(id, { resume, presentation, createdAt }) {
      const now = Date.now();
      const doc = {
        id,
        schemaVersion: 1,
        createdAt: createdAt || now,
        updatedAt: now,
        resume: sanitizeCanonical(resume || emptyCanonical()),
        presentation: normalizePresentation(presentation),
      };
      await kv.put("resume:" + id, JSON.stringify(doc));
      return doc;
    },
    async remove(id) {
      await kv.delete("resume:" + id);
    },
    async list() {
      const ids = await listIds();
      const docs = await Promise.all(ids.map((id) => this.get(id)));
      return docs.filter(Boolean).map((d) => ({
        id: d.id,
        name: d.resume.basics.name,
        variant: d.resume.basics.headline,
        theme: d.presentation.theme,
        layout: d.presentation.layout,
      }));
    },
  };
}
