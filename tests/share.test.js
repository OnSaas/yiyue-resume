import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/share/security.js";

test("pbkdf2 roundtrip", async () => {
  const h = await hashPassword("secret");
  assert.match(h, /^pbkdf2\$/);
  assert.equal(await verifyPassword("secret", h), true);
  assert.equal(await verifyPassword("nope", h), false);
});

test("legacy sha256 still verifies", async () => {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode("oldpw"));
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  assert.equal(await verifyPassword("oldpw", hex), true);
  assert.equal(await verifyPassword("x", hex), false);
});
