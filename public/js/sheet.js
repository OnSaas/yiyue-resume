const THEMES = ["paper", "ink", "night", "plain"];

let doc = document;

function el(tag, attrs = {}, children = []) {
  const node = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (v != null && v !== false) node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children) if (c) node.append(c);
  return node;
}

function jobs(list, emptyMsg) {
  const wrap = el("div");
  if (!list.length) {
    wrap.append(el("p", { class: "empty", text: emptyMsg }));
    return wrap;
  }
  for (const j of list) {
    const head = el("div", { class: "job-head" });
    const left = el("div");
    left.append(el("span", { class: "job-role", text: j.role || "" }));
    if (j.org) left.append(el("span", { class: "job-org", text: " · " + j.org }));
    head.append(left, el("div", { class: "job-time", text: j.time || "" }));
    const art = el("article", { class: "job" }, [head]);
    const pts = (j.points || []).filter(Boolean);
    if (pts.length) {
      const ul = el("ul");
      for (const p of pts) ul.append(el("li", { text: p }));
      art.append(ul);
    }
    wrap.append(art);
  }
  return wrap;
}

export function renderSheet(mount, resume) {
  doc = mount.ownerDocument;
  const theme = THEMES.includes(resume.theme) ? resume.theme : "paper";
  doc.documentElement.setAttribute("data-theme", theme);
  const name = resume.name || "";
  const variant = resume.variant || "";
  doc.title = name + (variant ? " · " + variant : "");

  const links = el("div");
  for (const l of resume.links || []) {
    if (!l.label) continue;
    const href = /^(https?:|mailto:)/i.test(l.href || "") ? l.href : "";
    const line = el("div");
    if (href) line.append(el("a", { href, text: l.label }));
    else line.textContent = l.label;
    links.append(line);
  }

  const contact = el("div");
  const contacts = (resume.contact || []).filter((c) => c.label);
  if (!contacts.length) contact.append(el("p", { class: "empty", text: "未放联系方式" }));
  else {
    for (const c of contacts) {
      const href = /^(https?:|mailto:)/i.test(c.href || "") ? c.href : "";
      const p = el("p");
      if (href) p.append(el("a", { href, text: c.label }));
      else p.textContent = c.label;
      contact.append(p);
    }
  }

  const skills = (resume.skills || []).filter(Boolean);
  const skillBox = el("div");
  if (!skills.length) skillBox.append(el("p", { class: "empty", text: "这一版未列技能" }));
  else {
    const ul = el("ul");
    for (const s of skills) ul.append(el("li", { text: s }));
    skillBox.append(ul);
  }

  const meta = el("div", { class: "meta" });
  if (variant) meta.append(el("div", { class: "variant", text: variant }));
  meta.append(links);

  const identity = el("div");
  identity.append(el("h1", { class: "name", text: name }));
  if (resume.nameEn) identity.append(el("p", { class: "name-en", text: resume.nameEn }));
  if (resume.tagline) identity.append(el("p", { class: "tagline", text: resume.tagline }));

  const main = el("div");
  main.append(
    el("section", {}, [el("h2", { text: "经历" }), jobs(resume.experience || [], "这一版还没写经历。")]),
    el("section", {}, [el("h2", { text: "项目" }), jobs(resume.projects || [], "这一版还没写项目。")])
  );

  const sheet = el("article", { class: "sheet" }, [
    el("header", { class: "top" }, [identity, meta]),
    el("div", { class: "body" }, [
      main,
      el("aside", { class: "rail" }, [
        el("section", { class: "contact" }, [el("h2", { text: "联系" }), contact]),
        el("section", {}, [el("h2", { text: "技能" }), skillBox]),
      ]),
    ]),
  ]);

  const wrap = el("div", { class: "page" });
  wrap.setAttribute("data-theme", theme);
  wrap.append(sheet);
  mount.replaceChildren(wrap);
}
