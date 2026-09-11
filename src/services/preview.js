import { importPayload } from "./import.js";
import { ImportError } from "../domain/errors.js";
import { normalizePresentation } from "../schema/presentation.js";
import { renderResume } from "../renderer/engine.js";

/** Preview only. Never touches storage. */
export function previewResume(body = {}) {
  const fragment = body.fragment === true || body.fragment === 1 || body.fragment === "1";
  const rawResume = body.resume != null ? body.resume : body;
  const imported = importPayload(rawResume);
  if (!imported.ok) {
    throw new ImportError("IMPORT_INVALID_FORMAT", (imported.errors || []).join("；") || "坏 JSON", {
      errors: imported.errors,
      format: imported.format,
    });
  }
  const presentation = normalizePresentation(body.presentation || rawResume.presentation || body);
  const html = renderResume(imported.canonical, presentation, { fragment });
  return { html };
}
