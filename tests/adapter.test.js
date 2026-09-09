import { test } from "node:test";
import assert from "node:assert/strict";
import { ingest, detectFormat } from "../src/adapters/index.js";
import { fromMofang } from "../src/adapters/mofang.js";

const mofang = {
  title: "前端",
  basic: {
    name: "宋哈娜",
    title: "高级前端工程师",
    email: "a@b.com",
    phone: "13800138000",
    location: "北京",
    customFields: [{ label: "站点", value: "https://hana.dev" }],
  },
  experience: [
    { company: "Acme", position: "工程师", date: "2020-2024", details: "<ul><li>做了 A</li><li>做了 B</li></ul>", visible: true },
  ],
  education: [{ school: "北大", major: "CS", degree: "学士", startDate: "2013", endDate: "2017", description: "<p>奖学金</p>" }],
  projects: [{ name: "X", role: "负责人", date: "2021", description: "<li>上线</li>", link: "https://x.dev" }],
  skillContent: "<ul><li>React</li><li>Workers</li></ul>",
};

test("detect mofang", () => {
  assert.equal(detectFormat(mofang), "mofang");
});

test("mofang adapter maps fields", () => {
  const r = fromMofang(mofang);
  assert.equal(r.basics.name, "宋哈娜");
  assert.equal(r.basics.headline, "高级前端工程师");
  assert.equal(r.basics.email, "a@b.com");
  assert.equal(r.experience[0].org, "Acme");
  assert.deepEqual(r.experience[0].points, ["做了 A", "做了 B"]);
  assert.ok(r.skills.includes("React"));
  assert.equal(r.projects[0].url, "https://x.dev");
  assert.ok(r.links.some((l) => l.href === "https://hana.dev"));
});

test("ingest mofang ok", () => {
  const got = ingest(mofang);
  assert.equal(got.ok, true);
  assert.equal(got.format, "mofang");
});

test("ingest native ok", () => {
  const got = ingest({
    name: "楚扉月",
    variant: "岗位A",
    experience: [{ role: "开发", org: "OnSaas", time: "2026", points: ["x"] }],
    projects: [],
    skills: ["Workers"],
    links: [],
  });
  assert.equal(got.ok, true);
  assert.equal(got.format, "native");
  assert.equal(got.resume.basics.headline, "岗位A");
});

test("bad json", () => {
  const got = ingest("not-json");
  assert.equal(got.ok, false);
  assert.ok(got.errors[0].includes("JSON"));
});

test("mofang round trip keeps core", async () => {
  const { toMofang } = await import("../src/adapters/mofang.js");
  const c = fromMofang(mofang);
  const back = toMofang(c);
  assert.equal(back.basic.name, "宋哈娜");
  assert.equal(back.experience[0].company, "Acme");
  assert.equal(back.projects[0].link, "https://x.dev");
  assert.ok(back.skillContent.includes("React") || (c.skills || []).includes("React"));
});

