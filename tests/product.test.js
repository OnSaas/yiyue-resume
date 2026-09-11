import { test } from "node:test";
import assert from "node:assert/strict";
import { PRODUCT } from "../src/config/product.js";
import { PROJECT_FORMAT } from "../src/config/defaults.js";
import { isProject, wrapProject } from "../src/schema/project.js";
import { ingest } from "../src/adapters/index.js";
import { renderResume } from "../src/renderer/engine.js";
import { emptyCanonical } from "../src/schema/resume.js";

test("product identity is Reshare", () => {
  assert.equal(PRODUCT.name, "Reshare");
  assert.match(PRODUCT.tagline, /Self-hosted resume management and sharing platform/);
});

test("project export keeps historical format id", () => {
  const wrapped = wrapProject({ basics: { name: "A" } }, { theme: "paper" });
  assert.equal(wrapped.format, PROJECT_FORMAT);
  assert.equal(PROJECT_FORMAT, "yiyue-project");
  assert.equal(isProject(wrapped), true);
});

test("reshare-project alias ingest", () => {
  const got = ingest({ format: "reshare-project", version: 1, resume: { basics: { name: "A" }, experience: [] } });
  assert.equal(got.ok, true);
  assert.equal(got.resume.basics.name, "A");
});

test("public html site_name is Reshare, title is person", () => {
  const resume = emptyCanonical();
  resume.basics.name = "Alice";
  const html = renderResume(resume, { layout: "classic", theme: "paper" });
  assert.match(html, /<title>Alice<\/title>/);
  assert.match(html, /og:site_name" content="Reshare"/);
});
