import { PRESERVE_MAP, IGNORED, CORE_MAP } from "./mapping.js";

export function classifyField(path) {
  if (CORE_MAP[path]) return "supported";
  if (PRESERVE_MAP.includes(path)) return "preserved";
  if (IGNORED.includes(path)) return "ignored";
  return "unknown";
}

export function preservedFields(extras) {
  const m = extras?.mofang || {};
  const out = [];
  if (m.title) out.push("title");
  if (m.templateId) out.push("templateId");
  if (m.basic?.photoConfig) out.push("basic.photoConfig");
  if (m.basic?.fieldOrder) out.push("basic.fieldOrder");
  if (m.basic?.icons) out.push("basic.icons");
  if (m.basic?.customFields) out.push("basic.customFields");
  if (m.basic?.githubKey || m.basic?.githubUseName) out.push("basic.github");
  if (m.menuSections) out.push("menuSections");
  if (m.globalSettings) out.push("globalSettings");
  if (m.certificates) out.push("certificates");
  if (m.skillContent) out.push("skillContent");
  if (m.selfEvaluationContent) out.push("selfEvaluationContent");
  if (m.customData) out.push("customData");
  return out;
}

export const COMPATIBILITY = {
  supported: Object.keys(CORE_MAP),
  preserved: PRESERVE_MAP,
  ignored: IGNORED,
};
