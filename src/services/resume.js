import { resumeRepository } from "../repositories/resumes.js";
import { importPayload } from "./import.js";
import { mergeCanonical } from "../domain/patch.js";
import { emptyCanonical } from "../schema/resume.js";
import { emptyPresentation, normalizePresentation } from "../schema/presentation.js";
import { toMofang } from "../adapters/mofang.js";
import { ImportError } from "../domain/errors.js";

function presentationFrom(body, fallback) {
  const raw = body?.presentation ? { ...body, ...body.presentation } : body || {};
  return normalizePresentation({ ...emptyPresentation(), ...fallback, ...raw });
}

export function resumeService(kv) {
  const repo = resumeRepository(kv);
  return {
    list: () => repo.list(),
    get: (id) => repo.get(id),
    async create(body) {
      const imported = importPayload(body.resume || body);
      if (!imported.ok) throw new ImportError("IMPORT_INVALID_FORMAT", imported.errors.join("；"), { errors: imported.errors, format: imported.format });
      const id = body.id || crypto.randomUUID();
      return repo.save(id, {
        resume: imported.canonical,
        presentation: presentationFrom(body, emptyPresentation()),
      });
    },
    async update(id, body) {
      const imported = importPayload(body.resume || body);
      if (!imported.ok) throw new ImportError("IMPORT_INVALID_FORMAT", imported.errors.join("；"), { errors: imported.errors, format: imported.format });
      const prev = await repo.get(id);
      const merged = mergeCanonical(prev?.resume || emptyCanonical(), imported.canonical);
      return repo.save(id, {
        resume: merged,
        presentation: presentationFrom(body, prev?.presentation),
        createdAt: prev?.createdAt,
      });
    },
    remove: (id) => repo.remove(id),
    exportMofang(doc) {
      return toMofang(doc.resume);
    },
    exportProject(doc) {
      return {
        format: "yiyue-project",
        version: 1,
        resume: doc.resume,
        presentation: doc.presentation,
      };
    },
  };
}
