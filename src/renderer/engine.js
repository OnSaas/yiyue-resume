import { esc, safeHref } from "../utils/html.js";
import { resolveTheme } from "./registry/themes.js";
import { resolveLayout } from "./registry/layouts.js";
import { normalizePresentation } from "../schema/presentation.js";

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

function section(title, inner) {
  if (!inner) return "";
  return `<section class="sec"><h2>${esc(title)}</h2>${inner}</section>`;
}

function profile(resume) {
  const b = resume.basics || {};
  return `<div class="profile">
    <h1 class="name">${esc(b.name || "")}</h1>
    ${b.nameEn ? `<p class="name-en">${esc(b.nameEn)}</p>` : ""}
    ${b.headline ? `<p class="job-title">${esc(b.headline)}</p>` : ""}
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

function skills(resume) {
  const list = (resume.skills || []).filter(Boolean);
  if (!list.length) return "";
  return `<ul>${list.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`;
}

function listBlock(arr, empty) {
  if (!arr || !arr.length) return empty ? `<p class="empty">${esc(empty)}</p>` : "";
  return arr.map(job).join("");
}

function renderSection(id, resume) {
  if (id === "profile") return profile(resume);
  if (id === "contact") return section("联系", contact(resume));
  if (id === "skills") return section("技能", skills(resume));
  if (id === "languages") return section("语言", (resume.languages || []).length ? `<ul>${resume.languages.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : "");
  if (id === "certifications") return section("证书", (resume.certifications || []).length ? `<ul>${resume.certifications.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : "");
  if (id === "experience") return section("经历", listBlock(resume.experience, "这一版还没写经历。"));
  if (id === "projects") {
    const items = (resume.projects || []).map((p) => ({
      role: p.name,
      org: p.role,
      time: p.time,
      points: p.points,
    }));
    return section("项目", listBlock(items, "这一版还没写项目。"));
  }
  if (id === "education") {
    const items = (resume.education || []).map((e) => ({
      role: e.school,
      org: [e.major, e.degree].filter(Boolean).join(" · "),
      time: e.time,
      points: e.points,
    }));
    return section("教育", listBlock(items, ""));
  }
  if (id === "custom") {
    return (resume.customSections || [])
      .map((s) => section(s.title || s.id, listBlock(s.items, "")))
      .join("");
  }
  return "";
}

function header(resume) {
  const b = resume.basics || {};
  const links = (resume.links || [])
    .filter((l) => l.label)
    .map((l) => {
      const href = safeHref(l.href);
      return href ? `<div><a href="${esc(href)}">${esc(l.label)}</a></div>` : `<div>${esc(l.label)}</div>`;
    })
    .join("");
  return `<header class="top">
    <div>
      <h1 class="name">${esc(b.name || "")}</h1>
      ${b.nameEn ? `<p class="name-en">${esc(b.nameEn)}</p>` : ""}
      ${b.headline ? `<p class="job-title">${esc(b.headline)}</p>` : ""}
      ${b.summary ? `<p class="tagline">${esc(b.summary)}</p>` : ""}
    </div>
    <div class="meta">
      ${b.headline ? `<div class="variant">${esc(b.headline)}</div>` : ""}
      ${links}
      <div class="actions"><button type="button" onclick="window.print()">打印 / PDF</button></div>
    </div>
  </header>`;
}

export function renderResume(resume, presentationInput, context = {}) {
  const presentation = normalizePresentation(presentationInput);
  const theme = resolveTheme(presentation);
  const layout = resolveLayout(presentation);
  const cols = (layout.columns || [])
    .map((c) => {
      const inner = (c.children || []).map((id) => renderSection(id, resume)).join("");
      return `<div class="col" style="flex: ${c.width} 1 0">${inner}</div>`;
    })
    .join("");
  const head = layout.header === "full" ? header(resume) : "";
  const compact = layout.compact ? " is-compact" : "";
  const vars = [
    `--paper:${theme.background}`,
    `--ink:${theme.primaryColor}`,
    `--muted:${theme.mutedColor}`,
    `--line:${theme.borderColor}`,
    `--accent:${theme.accentColor}`,
    `--page:${theme.page}`,
    `--sans:${theme.fontFamily}`,
    `--serif:${theme.headingFont}`,
    `--radius:${theme.radius}px`,
  ].join(";");
  const title = `${resume.basics?.name || "简历"}${resume.basics?.headline ? " · " + resume.basics.headline : ""}`;
  const note = context.note ? `<footer class="note">${esc(context.note)}</footer>` : "";
  const sheet = `<article class="sheet layout-${esc(layout.id)}${compact}" data-layout="${esc(layout.id)}" data-layout-variant="${esc(layout.layoutVariant || "")}">
    ${head}
    <div class="body cols">${cols}</div>
    ${note}
  </article>`;
  if (context.fragment) {
    return `<div class="page" data-theme="${esc(presentation.theme)}" style="${vars};font-size:${theme.fontSize}px;line-height:${theme.lineHeight}">${sheet}</div>`;
  }
  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="${esc(presentation.theme)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>${esc(title)}</title>
  <link rel="stylesheet" href="/css/resume.css" />
</head>
<body class="page" style="${vars}">
  ${sheet}
</body>
</html>`;
}

export { THEME_LIST } from "./registry/themes.js";
export { LAYOUT_LIST } from "./registry/layouts.js";
