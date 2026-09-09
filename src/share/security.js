const enc = new TextEncoder();

function hex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(h) {
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 }, key, 256);
  return `pbkdf2$${hex(salt)}$${hex(bits)}`;
}

export async function verifyPassword(password, stored) {
  if (!stored) return false;
  if (stored.startsWith("pbkdf2$")) {
    const [, saltHex, hashHex] = stored.split("$");
    const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: fromHex(saltHex), iterations: 100000 },
      key,
      256
    );
    return hex(bits) === hashHex;
  }
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(password));
  return hex(buf) === stored;
}
