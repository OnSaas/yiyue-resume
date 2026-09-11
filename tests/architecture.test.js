import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ingest, listAdapters, detectFormat } from "../src/adapters/index.js";
import { fromMofang, toMofang } from "../src/adapters/mofang.js";
import { mergeCanonical } from "../src/domain/patch.js";
import { resolveCanvas } from "../src/domain/canvas.js";
import { resolvePresentation } from "../src/schema/presentation.js";
import { listSections } from "../src/renderer/registry/sections.js";
import { LAYOUT_DEFS } from "../src/renderer/registry/layouts.js";
import { themeTokens } from "../src/renderer/registry/themes.js";
import { renderResume } from "../src/renderer/engine.js";
import { migrateResume, CURRENT_SCHEMA_VERSION } from "../src/schema/migrations/index.js";

function load(name) {
  return JSON.parse(readFileSync(new URL("../fixtures/mofang/" + name, import.meta.url), "utf8"));
}

test("adapter registry lists plugins", () => {
  const ids = listAdapters().map((a) => a.id);
  assert.ok(ids.includes("mofang"));
  assert.ok(ids.includes("native"));
  assert.ok(ids.includes("canonical"));
});

test("section registry has core sections", () => {
  const ids = listSections().map((s) => s.id);
  for (const id of ["profile", "experience", "projects", "awards", "publications", "custom"]) {
    assert.ok(ids.includes(id), id);
  }
});

test("layout supports orientation without schema", () => {
  assert.equal(LAYOUT_DEFS.sidebar.supports.landscape, true);
  assert.equal(LAYOUT_DEFS.classic.supports.portrait, true);
});

test("theme tokens grouped", () => {
  const t = themeTokens("paper");
  assert.ok(t.colors.accent);
  assert.ok(t.typography.fontFamily);
});

test("canvas landscape is A4 297x210", () => {
  const c = resolveCanvas({ orientation: "landscape" });
  assert.equal(c.widthMm, 297);
  assert.equal(c.heightMm, 210);
  assert.equal(c.strategy, "scale");
});

test("changing canvas does not need adapter", () => {
  const r = fromMofang(load("minimal.json"));
  const html = renderResume(r, { layout: "classic", theme: "paper", orientation: "landscape" });
  assert.match(html, /data-orientation="landscape"/);
  assert.equal(r.basics.name, "宋哈娜");
});

test("migrate stamps schemaVersion", () => {
  const m = migrateResume({ basics: { name: "A" } });
  assert.equal(m.schemaVersion, CURRENT_SCHEMA_VERSION);
});

test("patch keeps project url and extras", () => {
  const orig = {
    basics: { name: "A", avatar: "https://a.png" },
    projects: [{ name: "X", url: "https://x.dev", points: ["1"] }],
    extras: { mofang: { title: "keep" } },
  };
  const incoming = {
    basics: { name: "B", avatar: "" },
    projects: [{ name: "X", url: "", points: ["1"] }],
    extras: {},
  };
  const m = mergeCanonical(orig, incoming);
  assert.equal(m.basics.name, "B");
  assert.equal(m.basics.avatar, "https://a.png");
  assert.equal(m.projects[0].url, "https://x.dev");
  assert.equal(m.extras.mofang.title, "keep");
});

test("import pipeline does not persist", () => {
  const got = ingest(load("with-avatar.json"));
  assert.equal(got.ok, true);
  assert.equal(got.format, "mofang");
  assert.equal(got.canonical.basics.avatar, "https://example.com/a.png");
  assert.ok(got.stats.projects >= 1);
  assert.ok(!("kv" in got));
});

test("mofang fixture round trip", () => {
  for (const name of ["minimal.json", "with-avatar.json", "with-custom-fields.json"]) {
    const src = load(name);
    const c = fromMofang(src);
    const back = toMofang(c);
    assert.equal(back.basic.name, src.basic.name);
    if (src.basic.photo) assert.equal(back.basic.photo, src.basic.photo);
    if (src.projects?.[0]?.link) assert.equal(back.projects[0].link, src.projects[0].link);
  }
});

test("presentation inherit still works", () => {
  const r = resolvePresentation({ theme: "ink", orientation: "landscape" }, { theme: "inherit", layout: "sidebar" });
  assert.equal(r.theme, "ink");
  assert.equal(r.layout, "sidebar");
  assert.equal(r.orientation, "landscape");
});

test("yiyue-project ingest", () => {
  const got = ingest({ format: "yiyue-project", version: 1, resume: { basics: { name: "扉月" }, experience: [] } });
  assert.equal(got.ok, true);
  assert.equal(got.resume.basics.name, "扉月");
});

test("reshare-project alias ingest", () => {
  const got = ingest({ format: "reshare-project", version: 1, resume: { basics: { name: "扉月" }, experience: [] } });
  assert.equal(got.ok, true);
  assert.equal(got.resume.basics.name, "扉月");
});

test("unknown format", () => {
  assert.equal(detectFormat({ foo: 1 }), "unknown");
  const got = ingest({ foo: 1 });
  assert.equal(got.ok, false);
});
