import { ingest } from "../adapters/index.js";

export function importPayload(input) {
  const got = ingest(input);
  return {
    ok: got.ok,
    format: got.format,
    version: got.version,
    canonical: got.canonical || got.resume,
    resume: got.resume,
    warnings: got.warnings || [],
    stats: got.stats || {},
    errors: got.errors || [],
    preservedFields: got.preservedFields || [],
  };
}
