import { sanitizeCanonical } from "../schema/resume.js";

const FORM_BASICS = new Set(["name", "nameEn", "headline", "summary"]);

function keepScalar(prev, next) {
  if (next == null || next === "") return prev || "";
  return next;
}

/**
 * Original + incoming → Canonical。
 * 表单未覆盖的标量（头像/邮箱等）和 extras 保留；项目 url 空串视为未改。
 */
export function mergeCanonical(original, incoming) {
  if (!original) return sanitizeCanonical(incoming);
  const prev = sanitizeCanonical(original);
  const next = sanitizeCanonical(incoming);

  const basics = { ...prev.basics };
  for (const k of Object.keys(next.basics)) {
    if (FORM_BASICS.has(k)) basics[k] = next.basics[k];
    else basics[k] = keepScalar(prev.basics[k], next.basics[k]);
  }

  const projects = (next.projects || []).map((p, i) => {
    const o = prev.projects[i];
    if (!o) return p;
    return { ...o, ...p, url: p.url || o.url || "" };
  });

  const extras = {
    ...(prev.extras || {}),
    ...(next.extras || {}),
  };
  if (prev.extras?.mofang && !next.extras?.mofang) extras.mofang = prev.extras.mofang;

  return sanitizeCanonical({
    ...prev,
    ...next,
    basics,
    projects,
    extras,
  });
}
