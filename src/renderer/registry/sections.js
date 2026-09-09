import { esc, safeHref } from "../../utils/html.js";

function points(list) {
  const pts = (list || []).filter(Boolean);
  if (!pts.length) return "";
  return `<ul>${pts.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`;
}

function job(item) {
  const role = item.role || item.name || "";
  const org = item.org || item.school || "";
  return `<article class="job">
    <div class="job-head">
      <div>
        <span class="job-role">${esc(role)}</span>
        ${org ? `<span class="job-org"> · ${esc(org)}</span>` : ""}
      </div>
      <div class="job-time">${esc(item.time || "")}</div>
    </div>${points(item.points)}
  </article>`;
}

function wrap(title, inner) {
  if (!inner) return "";
  return `<section class="sec"><h2>${esc(title)}</h2>${inner}</section>`;
}

function listBlock(arr, empty) {
  if (!arr || !arr.length) return empty ? `<p class="empty">${esc(empty)}</p>` : "";
  return arr.map(job).join("");
}

function profile(resume, presentation) {
  const b = resume.basics || {};
  const r = presentation?.themeOverrides?.radius;
  const radius = r != null && r !== "" ? `${r}px` : "8px";
  const avatar = b.avatar
    ? `<img class="avatar" src="${esc(b.avatar)}" alt="" style="border-radius:${esc(radius)}">`
    : "";
  return `<div class="profile">
    ${avatar}
    <h1 class="name">${esc(b.name || "")}</h1>
    ${b.nameEn ? `<p class="name-en">${esc(b.nameEn)}</p>` : ""}
    ${b.headline ? `<p class="job-title">${esc(b.headline)}</p>` : ""}
    ${b.employmentStatus ? `<p class="muted">${esc(b.employmentStatus)}</p>` : ""}
    ${b.summary ? `<p class="tagline">${esc(b.summary)}</p>` : ""}
  </div>`;
}

function contact(resume) {
  const b = resume.basics || {};
  const rows = [];
  if (b.email) rows.push(`<p><a href="mailto:${esc(b.email)}">${esc(b.email)}</a></p>`);
  if (b.phone) rows.push(`<p>${esc(b.phone)}</p>`);
  if (b.location) rows.push(`<p>${esc(b.location)}</p>`);
  for (const l of resume.links || []) {
    if (!l.label) continue;
    const href = safeHref(l.href);
    rows.push(href ? `<p><a href="${esc(href)}">${esc(l.label)}</a></p>` : `<p>${esc(l.label)}</p>`);
  }
  return rows.join("") || `<p class="empty">未放联系方式</p>`;
}

const sections = [];

export function registerSection(def) {
  if (!def?.id) throw new Error("section.id required");
  const i = sections.findIndex((s) => s.id === def.id);
  if (i >= 0) sections[i] = def;
  else sections.push(def);
}

export function getSection(id) {
  return sections.find((s) => s.id === id) || null;
}

export function listSections() {
  return sections.map((s) => ({ id: s.id, title: s.title }));
}

export function renderSection(id, resume, presentation) {
  const def = getSection(id);
  if (!def) return "";
  return def.render(resume, presentation) || "";
}

registerSection({ id: "profile", title: "", dataPath: "basics", render: profile });
registerSection({
  id: "contact",
  title: "联系",
  dataPath: "links",
  render: (resume) => wrap("联系", contact(resume)),
});
registerSection({
  id: "skills",
  title: "技能",
  dataPath: "skills",
  render: (resume) => {
    const list = (resume.skills || []).filter(Boolean);
    if (!list.length) return "";
    return wrap("技能", `<ul>${list.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`);
  },
});
registerSection({
  id: "languages",
  title: "语言",
  dataPath: "languages",
  render: (resume) =>
    wrap(
      "语言",
      (resume.languages || []).length ? `<ul>${resume.languages.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : ""
    ),
});
registerSection({
  id: "certifications",
  title: "证书",
  dataPath: "certifications",
  render: (resume) =>
    wrap(
      "证书",
      (resume.certifications || []).length
        ? `<ul>${resume.certifications.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`
        : ""
    ),
});
registerSection({
  id: "awards",
  title: "奖项",
  dataPath: "awards",
  render: (resume) =>
    wrap("奖项", (resume.awards || []).length ? `<ul>${resume.awards.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : ""),
});
registerSection({
  id: "publications",
  title: "著作",
  dataPath: "publications",
  render: (resume) =>
    wrap(
      "著作",
      (resume.publications || []).length ? `<ul>${resume.publications.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : ""
    ),
});
registerSection({
  id: "experience",
  title: "经历",
  dataPath: "experience",
  render: (resume) => wrap("经历", listBlock(resume.experience, "这一版还没写经历。")),
});
registerSection({
  id: "projects",
  title: "项目",
  dataPath: "projects",
  render: (resume) => {
    const items = (resume.projects || []).map((p) => ({
      role: p.name,
      org: p.role,
      time: p.time,
      points: [...(p.points || []), p.url ? p.url : ""].filter(Boolean),
    }));
    return wrap("项目", listBlock(items, "这一版还没写项目。"));
  },
});
registerSection({
  id: "education",
  title: "教育",
  dataPath: "education",
  render: (resume) => {
    const items = (resume.education || []).map((e) => ({
      role: e.school,
      org: [e.major, e.degree].filter(Boolean).join(" · "),
      time: e.time,
      points: e.points,
    }));
    return wrap("教育", listBlock(items, ""));
  },
});
registerSection({
  id: "custom",
  title: "自定义",
  dataPath: "customSections",
  render: (resume) => (resume.customSections || []).map((s) => wrap(s.title || s.id, listBlock(s.items, ""))).join(""),
});
