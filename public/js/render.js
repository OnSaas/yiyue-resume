import { sanitizeHtml } from "./magic-json.js";

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function empty(msg) {
  return `<p class="empty">${msg}</p>`;
}

function visibleItems(list) {
  return (list || []).filter((x) => x.visible !== false);
}

function jobBlock({ role, org, time, html }) {
  const body = sanitizeHtml(html || "");
  return `
    <article class="job">
      <div class="job-head">
        <div>
          <span class="job-role">${escapeText(role || "")}</span>
          ${org ? `<span class="job-org"> · ${escapeText(org)}</span>` : ""}
        </div>
        <div class="job-time">${escapeText(time || "")}</div>
      </div>
      ${body ? `<div class="prose">${body}</div>` : ""}
    </article>`;
}

function escapeText(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function contactLine(label, value, href) {
  if (!value) return "";
  const inner = href ? `<a href="${href}">${escapeText(value)}</a>` : escapeText(value);
  return `<p>${label ? `<span class="job-org">${escapeText(label)} </span>` : ""}${inner}</p>`;
}

function enabledSections(data) {
  return [...(data.menuSections || [])]
    .filter((s) => s.enabled && s.id !== "basic")
    .sort((a, b) => a.order - b.order);
}

function sectionHtml(data, id, title) {
  if (id === "experience") {
    const list = visibleItems(data.experience);
    if (!list.length) return "";
    return `<section><h2>${escapeText(title)}</h2>${list.map((e) =>
      jobBlock({ role: e.position, org: e.company, time: e.date, html: e.details })
    ).join("")}</section>`;
  }
  if (id === "projects") {
    const list = visibleItems(data.projects);
    if (!list.length) return "";
    return `<section><h2>${escapeText(title)}</h2>${list.map((p) => {
      const extra = p.link
        ? `<p><a href="${p.link}">${escapeText(p.linkLabel || p.link)}</a></p>`
        : "";
      return jobBlock({ role: p.name, org: p.role, time: p.date, html: (p.description || "") + extra });
    }).join("")}</section>`;
  }
  if (id === "education") {
    const list = visibleItems(data.education);
    if (!list.length) return "";
    return `<section><h2>${escapeText(title)}</h2>${list.map((e) => {
      const org = [e.major, e.degree, e.gpa && `GPA ${e.gpa}`].filter(Boolean).join(" · ");
      const time = [e.startDate, e.endDate].filter(Boolean).join(" – ");
      return jobBlock({ role: e.school, org, time, html: e.description });
    }).join("")}</section>`;
  }
  if (id === "skills") {
    const html = sanitizeHtml(data.skillContent || "");
    if (!html) return "";
    return `<section><h2>${escapeText(title)}</h2><div class="prose">${html}</div></section>`;
  }
  if (id === "selfEvaluation") {
    const html = sanitizeHtml(data.selfEvaluationContent || "");
    if (!html) return "";
    return `<section><h2>${escapeText(title)}</h2><div class="prose">${html}</div></section>`;
  }
  if (id === "certificates") {
    const list = data.certificates || [];
    if (!list.length) return "";
    return `<section><h2>${escapeText(title)}</h2><div class="certs">${list.map((c) =>
      `<img src="${c.url}" alt="" style="width:${c.width || 30}%">`
    ).join("")}</div></section>`;
  }
  const items = visibleItems((data.customData && data.customData[id]) || []);
  if (!items.length) return "";
  return `<section><h2>${escapeText(title)}</h2>${items.map((it) =>
    jobBlock({ role: it.title, org: it.subtitle, time: it.dateRange, html: it.description })
  ).join("")}</section>`;
}

export function renderResume(mount, data, opts = {}) {
  const b = data.basic || {};
  const gs = data.globalSettings || {};
  const accent = gs.themeColor || "#8c2f1b";
  const layout = b.layout || "left";
  const showPhoto = b.photo && b.photoConfig && b.photoConfig.visible !== false;
  const radius =
    b.photoConfig?.borderRadius === "full"
      ? "9999px"
      : b.photoConfig?.borderRadius === "medium"
        ? "8px"
        : b.photoConfig?.borderRadius === "custom"
          ? `${b.photoConfig.customBorderRadius || 0}px`
          : "0";

  const fields = (b.fieldOrder || []).filter((f) => f.visible !== false);
  const fieldVal = (key) => b[key] || "";
  const contacts = [];
  for (const f of fields) {
    if (f.key === "name" || f.key === "title") continue;
    const v = fieldVal(f.key);
    if (!v) continue;
    let href = "";
    if (f.key === "email") href = "mailto:" + v;
    if (f.key === "phone") href = "tel:" + v;
    contacts.push(contactLine(f.label === "邮箱" || f.label === "电话" ? "" : "", v, href));
  }
  for (const cf of (b.customFields || []).filter((x) => x.visible !== false && x.value)) {
    const href = /^(https?:|mailto:)/i.test(cf.value) ? cf.value : "";
    contacts.push(contactLine(cf.displayLabel ? cf.label : "", cf.value, href));
  }

  const sections = enabledSections(data);
  const railIds = new Set(["skills", "selfEvaluation"]);
  const main = sections.filter((s) => !railIds.has(s.id));
  const rail = sections.filter((s) => railIds.has(s.id));

  const mainHtml = main.map((s) => sectionHtml(data, s.id, s.title)).join("") ||
    empty("这一版还没写经历。只填和该岗位相关的条目。");
  const railHtml = (rail.map((s) => sectionHtml(data, s.id, s.title)).join("") || "") +
    `<section class="contact"><h2>联系</h2>${contacts.join("") || empty("未放联系方式")}</section>`;

  mount.innerHTML = "";
  const sheet = el(`<article class="sheet" style="--accent:${accent};font-size:${gs.baseFontSize || 15}px;line-height:${gs.lineHeight || 1.55}"></article>`);
  sheet.innerHTML = `
    <header class="top ${layout}">
      <div class="identity">
        ${showPhoto ? `<img class="photo" src="${b.photo}" alt="" style="width:${b.photoConfig.width || 90}px;height:${b.photoConfig.height || 120}px;border-radius:${radius}">` : ""}
        <div>
          <h1 class="name">${escapeText(b.name || "")}</h1>
          ${b.title ? `<p class="job-title">${escapeText(b.title)}</p>` : ""}
        </div>
      </div>
      <div class="meta">
        <div class="variant">${escapeText(data.title || "")}</div>
        ${opts.hideActions ? "" : `<div class="actions"><button type="button" class="print-btn">打印 / PDF</button></div>`}
      </div>
    </header>
    <div class="body">
      <div class="main">${mainHtml}</div>
      <aside class="rail">${railHtml}</aside>
    </div>
    ${opts.hideNote ? "" : `<footer class="note">面向岗位的独立版本，不收录全部履历。</footer>`}
  `;
  const btn = sheet.querySelector(".print-btn");
  if (btn) btn.addEventListener("click", () => window.print());
  mount.appendChild(sheet);
  if (b.name) document.title = b.name + (data.title ? " · " + data.title : " · 简历");
}
