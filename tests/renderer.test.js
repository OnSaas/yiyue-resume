import { test } from "node:test";
import assert from "node:assert/strict";
import { renderResume } from "../src/renderer/engine.js";
import { emptyCanonical } from "../src/schema/resume.js";
import { LAYOUTS, THEMES } from "../src/schema/presentation.js";

const resume = emptyCanonical();
resume.basics.name = "楚扉月";
resume.basics.headline = "Cloud";
resume.experience = [{ org: "OnSaas", role: "开发", time: "2026", points: ["Workers"] }];
resume.skills = ["KV"];

test("classic html contains name", () => {
  const html = renderResume(resume, { layout: "classic", theme: "paper" });
  assert.match(html, /楚扉月/);
  assert.match(html, /data-layout="classic"/);
  assert.match(html, /data-theme="paper"/);
});

for (const layout of LAYOUTS) {
  test("layout " + layout, () => {
    const html = renderResume(resume, { layout, theme: "ink" });
    assert.match(html, new RegExp(`data-layout="${layout}"`));
    assert.match(html, /楚扉月/);
  });
}

for (const theme of THEMES) {
  test("theme " + theme, () => {
    const html = renderResume(resume, { layout: "sidebar", theme });
    assert.match(html, new RegExp(`data-theme="${theme}"`));
  });
}

test("layout x theme combinations", () => {
  for (const layout of LAYOUTS) {
    for (const theme of THEMES) {
      const html = renderResume(resume, { layout, theme });
      assert.match(html, /楚扉月/);
      assert.match(html, new RegExp(`data-layout="${layout}"`));
      assert.match(html, new RegExp(`data-theme="${theme}"`));
    }
  }
});

test("theme override accent", () => {
  const html = renderResume(resume, { layout: "classic", theme: "paper", themeOverrides: { accentColor: "#2563eb" } });
  assert.match(html, /#2563eb/);
});

test("orientation landscape", () => {
  const html = renderResume(resume, { layout: "sidebar", theme: "paper", orientation: "landscape" });
  assert.match(html, /data-orientation="landscape"/);
  assert.match(html, /A4 landscape/);
});

test("orientation portrait default", () => {
  const html = renderResume(resume, { layout: "classic", theme: "ink" });
  assert.match(html, /data-orientation="portrait"/);
});

