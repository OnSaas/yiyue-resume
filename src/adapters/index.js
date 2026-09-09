import { emptyCanonical, sanitizeCanonical, validateCanonical } from "../schema/resume.js";
import { fromMofang, toMofang, isMofang } from "./mofang.js";
import { fromNative, isNative } from "./native.js";

export function detectFormat(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "unknown";
  if (raw.basics && typeof raw.basics === "object" && (raw.experience || raw.education || raw.projects || raw.basics.name != null)) {
    return "canonical";
  }
  if (isMofang(raw)) return "mofang";
  if (isNative(raw)) return "native";
  return "unknown";
}

export function ingest(raw) {
  if (raw == null) {
    return { ok: false, errors: ["JSON 格式错误"], format: "unknown", resume: emptyCanonical() };
  }
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return { ok: false, errors: ["JSON 格式错误"], format: "unknown", resume: emptyCanonical() };
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: ["JSON 格式错误"], format: "unknown", resume: emptyCanonical() };
  }
  const format = detectFormat(raw);
  try {
    let resume;
    if (format === "canonical") resume = sanitizeCanonical(raw);
    else if (format === "mofang") resume = fromMofang(raw);
    else if (format === "native") resume = fromNative(raw);
    else {
      return { ok: false, errors: ["不支持的版本或未知字段结构"], format, resume: emptyCanonical() };
    }
    const errors = validateCanonical(resume);
    if (errors.length) return { ok: false, errors, format, resume };
    return { ok: true, errors: [], format, resume };
  } catch (e) {
    return { ok: false, errors: [e.message || "解析失败"], format, resume: emptyCanonical() };
  }
}

export { fromMofang, toMofang, fromNative };
