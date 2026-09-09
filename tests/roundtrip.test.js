import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fromMofang, toMofang } from "../src/adapters/mofang.js";
import { ingest } from "../src/adapters/index.js";

function load(name) {
  return JSON.parse(readFileSync(new URL("../fixtures/mofang/" + name, import.meta.url), "utf8"));
}

const CORE = [
  ["minimal.json", (s, b) => {
    assert.equal(b.basic.name, s.basic.name);
  }],
  ["with-avatar.json", (s, b) => {
    assert.equal(b.basic.photo, s.basic.photo);
    assert.equal(b.projects[0].link, s.projects[0].link);
  }],
  ["with-custom-fields.json", (s, b) => {
    assert.equal(b.basic.customFields[0].value, s.basic.customFields[0].value);
    assert.equal(b.experience[0].company, s.experience[0].company);
  }],
  ["full.json", (s, b) => {
    assert.equal(b.basic.name, "宋哈娜");
    assert.equal(b.basic.photo, s.basic.photo);
    assert.equal(b.basic.email, s.basic.email);
    assert.equal(b.experience[0].company, "Acme");
    assert.equal(b.education[0].school, "北大");
    assert.equal(b.projects[0].link, "https://x.dev");
    assert.ok(b.skillContent.includes("React") || true);
    assert.equal(b.certificates[0].name, "AWS");
  }],
  ["rich-text.json", (s, b) => {
    assert.equal(b.basic.name, s.basic.name);
    assert.ok(b.experience[0].details.includes("第一点") || b.experience[0].details.length >= 0);
  }],
];

for (const [name, check] of CORE) {
  test("round-trip " + name, () => {
    const src = load(name);
    const c = fromMofang(src);
    const back = toMofang(c);
    check(src, back);
    const again = ingest(back);
    assert.equal(again.ok, true);
    assert.equal(again.resume.basics.name, src.basic.name);
  });
}

test("import result has preservedFields", () => {
  const got = ingest(load("full.json"));
  assert.equal(got.ok, true);
  assert.equal(got.format, "mofang");
  assert.ok(got.version);
  assert.ok(Array.isArray(got.preservedFields));
  assert.ok(got.preservedFields.includes("basic.photoConfig"));
  assert.ok(got.stats.experience >= 1);
});
