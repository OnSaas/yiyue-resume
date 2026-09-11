import { emptyCanonical, sanitizeCanonical, validateCanonical } from "../schema/resume.js";
import { migrateResume } from "../schema/migrations/index.js";
import { fromMofang, toMofang, isMofang, detectMofangVersion, preservedFields, ADAPTER_VERSION } from "./mofang.js";
import { fromNative, isNative } from "./native.js";
import { registerAdapter, detectAdapter, getAdapter, listAdapters } from "./registry.js";
import { isProject } from "../schema/project.js";

registerAdapter({
  id: "canonical",
  label: "Canonical",
  detect: (raw) =>
    !!(raw && typeof raw === "object" && raw.basics && typeof raw.basics === "object" &&
      (raw.experience || raw.education || raw.projects || raw.basics.name != null)),
  import: (raw) => sanitizeCanonical(raw),
  export: (canonical) => sanitizeCanonical(canonical),
});

registerAdapter({
  id: "mofang",
  label: "魔方简历",
  version: ADAPTER_VERSION,
  detect: isMofang,
  import: fromMofang,
  export: toMofang,
});

registerAdapter({
  id: "native",
  label: "旧版扁平 JSON",
  detect: isNative,
  import: fromNative,
  export: null,
});

export function detectFormat(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "unknown";
  if (isProject(raw)) return raw.format;
  return detectAdapter(raw).id;
}

function statsOf(resume) {
  return {
    experience: (resume.experience || []).length,
    projects: (resume.projects || []).length,
    education: (resume.education || []).length,
    skills: (resume.skills || []).length,
    certifications: (resume.certifications || []).length,
    customSections: (resume.customSections || []).length,
  };
}

function warningsOf(format, resume) {
  const warnings = [];
  if (format === "mofang") {
    const extra = resume.extras?.mofang || {};
    if (extra.globalSettings) warnings.push({ field: "globalSettings", reason: "preserved" });
    if (extra.skillContent) warnings.push({ field: "skillContent", reason: "mapped-to-skills" });
    if (extra.selfEvaluationContent) warnings.push({ field: "selfEvaluationContent", reason: "mapped-to-summary" });
    if (extra.basic?.photoConfig) warnings.push({ field: "basic.photoConfig", reason: "preserved" });
  }
  return warnings;
}

/** Import pipeline：Parse → Detect → Adapter → Validate → Migrate。不写存储。 */
export function ingest(raw) {
  if (raw == null) {
    return { ok: false, errors: ["JSON 格式错误"], format: "unknown", resume: emptyCanonical(), canonical: emptyCanonical(), warnings: [], stats: statsOf(emptyCanonical()) };
  }
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return { ok: false, errors: ["JSON 格式错误"], format: "unknown", resume: emptyCanonical(), canonical: emptyCanonical(), warnings: [], stats: statsOf(emptyCanonical()) };
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: ["JSON 格式错误"], format: "unknown", resume: emptyCanonical(), canonical: emptyCanonical(), warnings: [], stats: statsOf(emptyCanonical()) };
  }
  if (isProject(raw)) {
    raw = raw.resume;
  }
  const format = detectFormat(raw);
  try {
    const adapter = getAdapter(format);
    if (!adapter || !adapter.import) {
      return { ok: false, errors: ["不支持的版本或未知字段结构"], format, resume: emptyCanonical(), canonical: emptyCanonical(), warnings: [], stats: statsOf(emptyCanonical()) };
    }
    let resume = adapter.import(raw);
    resume = migrateResume(resume);
    const errors = validateCanonical(resume);
    if (errors.length) return { ok: false, errors, format, resume, canonical: resume, warnings: [], stats: statsOf(resume) };
    const warnings = warningsOf(format, resume);
    const version = format === "mofang" ? detectMofangVersion(raw) : "1";
    const preserved = format === "mofang" ? preservedFields(resume.extras) : [];
    return { ok: true, errors: [], format, version, resume, canonical: resume, warnings, stats: statsOf(resume), preservedFields: preserved };
  } catch (e) {
    return { ok: false, errors: [e.message || "解析失败"], format, resume: emptyCanonical(), canonical: emptyCanonical(), warnings: [], stats: statsOf(emptyCanonical()) };
  }
}

export function exportVia(format, canonical) {
  const adapter = getAdapter(format);
  if (!adapter?.export) throw new Error("该格式不支持导出");
  return adapter.export(canonical);
}

export { fromMofang, toMofang, fromNative, registerAdapter, listAdapters, getAdapter };
