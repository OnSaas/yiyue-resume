export function stripHtml(s) {
  return String(s ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function htmlToPoints(html) {
  const s = String(html ?? "");
  const lis = [...s.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => stripHtml(m[1]));
  if (lis.length) return lis.filter(Boolean);
  const t = stripHtml(s);
  return t ? [t] : [];
}

export function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function safeHref(href) {
  const h = String(href || "");
  if (/^(https?:|mailto:)/i.test(h)) return h;
  return "";
}
