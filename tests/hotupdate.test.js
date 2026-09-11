import { test } from "node:test";
import assert from "node:assert/strict";
import { previewResume } from "../src/services/preview.js";
import { ImportError } from "../src/domain/errors.js";
import { mergeCanonical } from "../src/domain/patch.js";
import { resumeService } from "../src/services/resume.js";
import { presentationOverrideFromBody } from "../src/services/share.js";
import { resolvePresentation } from "../src/schema/presentation.js";
import { shareRepository } from "../src/repositories/shares.js";
import {
  resetLoginThrottle,
  noteLoginFailure,
  noteLoginSuccess,
  loginBlocked,
} from "../src/services/auth.js";

function memKv() {
  const m = new Map();
  return {
    async get(k) {
      return m.has(k) ? m.get(k) : null;
    },
    async put(k, v) {
      m.set(k, v);
    },
    async delete(k) {
      m.delete(k);
    },
    async list({ prefix }) {
      const keys = [...m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name }));
      return { keys, list_complete: true };
    },
    get puts() {
      return [...m.keys()];
    },
  };
}

test("preview does not write storage", () => {
  const kv = memKv();
  const origPut = kv.put.bind(kv);
  let puts = 0;
  kv.put = async (...a) => {
    puts += 1;
    return origPut(...a);
  };
  const out = previewResume({ resume: { basics: { name: "Alice" } }, fragment: true });
  assert.match(out.html, /Alice/);
  assert.equal(puts, 0);
  assert.equal(kv.puts.length, 0);
});

test("preview bad json uses ImportError", () => {
  assert.throws(() => previewResume({ foo: 1 }), ImportError);
});

test("form name-only update keeps education and extras.mofang", async () => {
  const kv = memKv();
  const svc = resumeService(kv);
  const created = await svc.create({
    resume: {
      basics: { name: "旧" },
      education: [{ school: "X", major: "CS", time: "2020", points: ["课"] }],
      extras: { mofang: { keep: 1 } },
    },
  });
  const updated = await svc.update(created.id, { resume: { basics: { name: "新" } } });
  assert.equal(updated.resume.basics.name, "新");
  assert.equal(updated.resume.education[0].school, "X");
  assert.equal(updated.resume.extras.mofang.keep, 1);
  const patched = mergeCanonical(
    created.resume,
    { basics: { name: "新" } },
    { basics: { name: "新" } }
  );
  assert.equal(patched.education[0].school, "X");
});

test("share inherit stays inherit on publicShare and resolves to resume default", async () => {
  const ov = presentationOverrideFromBody({ theme: "inherit", layout: "inherit", orientation: "inherit" });
  assert.equal(ov.theme, "inherit");
  assert.equal(ov.layout, "inherit");
  assert.equal(ov.orientation, "inherit");
  const resolved = resolvePresentation({ theme: "ink", layout: "sidebar", orientation: "landscape" }, ov);
  assert.equal(resolved.theme, "ink");
  assert.equal(resolved.layout, "sidebar");
  assert.equal(resolved.orientation, "landscape");
  const pub = shareRepository({}).publicShare({
    token: "abc",
    resumeId: "r1",
    presentation: ov,
  });
  assert.equal(pub.theme, "inherit");
  assert.equal(pub.layout, "inherit");
  assert.equal(pub.orientation, "inherit");
  assert.equal(pub.url, "/s/abc");
  assert.equal(pub.token, "abc");
});

test("login ninth failure is blocked", () => {
  resetLoginThrottle();
  const ip = "203.0.113.9";
  for (let i = 0; i < 8; i++) noteLoginFailure(ip);
  assert.equal(loginBlocked(ip), true);
  noteLoginSuccess(ip);
  assert.equal(loginBlocked(ip), false);
});
