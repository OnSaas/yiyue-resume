import { test } from "node:test";
import assert from "node:assert/strict";
import { resolvePresentation, emptyPresentation } from "../src/schema/presentation.js";

test("inherit theme keeps resume theme", () => {
  const r = resolvePresentation({ theme: "night", layout: "sidebar", orientation: "landscape" }, { theme: "inherit", layout: "inherit" });
  assert.equal(r.theme, "night");
  assert.equal(r.layout, "sidebar");
  assert.equal(r.orientation, "landscape");
});

test("override orientation only", () => {
  const r = resolvePresentation(emptyPresentation(), { orientation: "landscape" });
  assert.equal(r.orientation, "landscape");
  assert.equal(r.layout, "classic");
  assert.equal(r.theme, "paper");
});
