import { test } from "node:test";
import assert from "node:assert/strict";
import { resumeService } from "../src/services/resume.js";
import { shareService } from "../src/services/share.js";
import { sharePath } from "../src/share/urls.js";

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
    async list({ prefix } = {}) {
      const keys = [...m.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name }));
      return { keys, list_complete: true };
    },
  };
}

test("single admin data model: many resumes, share token isolation", async () => {
  const kv = memKv();
  const resumes = resumeService(kv);
  const shares = shareService(kv);
  const a = await resumes.create({ resume: { basics: { name: "A" }, experience: [] } });
  const b = await resumes.create({ resume: { basics: { name: "B" }, experience: [] } });
  const sa = await shares.create({ label: "for A" }, a);
  const sb = await shares.create({ label: "for B" }, b);
  assert.notEqual(sa.token, sb.token);
  assert.equal(sa.resumeId, a.id);
  assert.equal(sb.resumeId, b.id);
  const gotA = await shares.get(sa.token);
  assert.equal(gotA.resumeId, a.id);
  assert.notEqual(gotA.resumeId, b.id);
});

test("share token does not change on patch", async () => {
  const kv = memKv();
  const resumes = resumeService(kv);
  const shares = shareService(kv);
  const doc = await resumes.create({ resume: { basics: { name: "A" }, experience: [] } });
  const created = await shares.create({ label: "x" }, doc);
  const patched = await shares.patch(created.token, { label: "y" });
  assert.equal(patched.token, created.token);
  assert.equal(sharePath(patched.token), "/s/" + created.token);
});

test("deleting a resume does not delete its shares", async () => {
  const kv = memKv();
  const resumes = resumeService(kv);
  const shares = shareService(kv);
  const doc = await resumes.create({ resume: { basics: { name: "A" }, experience: [] } });
  const created = await shares.create({}, doc);
  await resumes.remove(doc.id);
  const still = await shares.get(created.token);
  assert.ok(still);
  assert.equal(still.token, created.token);
  assert.equal(await resumes.get(doc.id), null);
});

test("public share url is a path; href uses caller origin", async () => {
  const kv = memKv();
  const resumes = resumeService(kv);
  const shares = shareService(kv);
  const doc = await resumes.create({ resume: { basics: { name: "A" }, experience: [] } });
  const created = await shares.create({}, doc);
  const pub = shares.publicShare(created, "https://resume.example.com");
  assert.equal(pub.url, "/s/" + created.token);
  assert.equal(pub.href, "https://resume.example.com/s/" + created.token);
});

test("worker talks to services not repositories", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../src/worker.js", import.meta.url), "utf8");
  assert.match(src, /resumeService/);
  assert.match(src, /shareService/);
  assert.doesNotMatch(src, /from \"\.\/repositories\//);
});
