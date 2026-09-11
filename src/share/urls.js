/** Share URLs are host-relative. Absolute links use the current request origin, never a baked hostname. */

export function requestOrigin(reqOrUrl) {
  const raw = typeof reqOrUrl === "string" ? reqOrUrl : reqOrUrl.url;
  return new URL(raw).origin;
}

export function sharePath(token) {
  return "/s/" + token;
}

export function shareHref(origin, token) {
  const base = String(origin || "").replace(/\/$/, "");
  if (!base) return sharePath(token);
  return base + sharePath(token);
}
