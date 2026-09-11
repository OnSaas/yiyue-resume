import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { requestOrigin, sharePath, shareHref } from "../src/share/urls.js";
import { ADMIN_COOKIE, shareCookieName } from "../src/services/auth.js";
import { PROJECT_FORMAT } from "../src/config/defaults.js";

test("share path is token only", () => {
  assert.equal(sharePath("abc"), "/s/abc");
  assert.equal(sharePath("abc").includes("://"), false);
});

test("absolute share href follows request origin", () => {
  assert.equal(shareHref("https://reshare.onw.workers.dev", "tok"), "https://reshare.onw.workers.dev/s/tok");
  assert.equal(shareHref("https://resume.example.com", "tok"), "https://resume.example.com/s/tok");
  assert.equal(shareHref("https://resume.example.com/", "tok"), "https://resume.example.com/s/tok");
});

test("request origin comes from the request URL", () => {
  assert.equal(requestOrigin("https://resume.example.com/admin"), "https://resume.example.com");
  assert.equal(requestOrigin({ url: "https://reshare.onw.workers.dev/api/shares" }), "https://reshare.onw.workers.dev");
});

test("cookie names stay frozen", () => {
  assert.equal(ADMIN_COOKIE, "yr_admin");
  assert.equal(shareCookieName("tok"), "yr_share_tok");
});

test("project format id stays frozen", () => {
  assert.equal(PROJECT_FORMAT, "yiyue-project");
});

test("src does not hardcode the current workers.dev host into share urls", () => {
  const files = [
    "src/share/urls.js",
    "src/repositories/shares.js",
    "src/services/share.js",
    "src/worker.js",
    "public/js/admin.js",
  ];
  for (const f of files) {
    const src = readFileSync(new URL("../" + f, import.meta.url), "utf8");
    assert.equal(src.includes("reshare.onw.workers.dev"), false, f);
    assert.equal(src.includes("yiyue-resume.onw.workers.dev"), false, f);
  }
});
