/** Cookie names are compatibility — do not rename. */
export const ADMIN_COOKIE = "yr_admin";
export function shareCookieName(token) {
  return "yr_share_" + token;
}

const enc = new TextEncoder();

export function cookieSet(name, value, maxAge) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function cookieClear(name) {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function getCookie(req, name) {
  const raw = req.headers.get("Cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return "";
}

export async function hmacHex(secret, text) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function ttlSec(env) {
  const n = Number(env.SESSION_TTL_SEC);
  return Number.isFinite(n) && n > 0 ? n : 7 * 24 * 3600;
}

export async function adminToken(env, exp) {
  const payload = btoa(JSON.stringify({ exp, v: 1 }));
  return `${payload}.${await hmacHex(env.SESSION_SECRET, payload)}`;
}

export async function readAdmin(req, env) {
  const tok = getCookie(req, ADMIN_COOKIE);
  if (!tok || !env.SESSION_SECRET) return null;
  const i = tok.indexOf(".");
  if (i < 0) return null;
  const payload = tok.slice(0, i);
  const sig = tok.slice(i + 1);
  if (sig !== (await hmacHex(env.SESSION_SECRET, payload))) return null;
  try {
    const data = JSON.parse(atob(payload));
    if (!data.exp || Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

export async function shareUnlocked(req, env, token) {
  const tok = getCookie(req, shareCookieName(token));
  if (!tok || !env.SESSION_SECRET) return false;
  return tok === (await hmacHex(env.SESSION_SECRET, "share:" + token));
}

export async function shareUnlockValue(env, token) {
  return hmacHex(env.SESSION_SECRET, "share:" + token);
}
