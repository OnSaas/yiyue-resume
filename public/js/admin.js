import { emptyResume, normalizeMagic, toMagicExport } from "./magic-json.js";
import { renderResume } from "./render.js";

const $ = (sel, root = document) => root.querySelector(sel);
const statusEl = () => $("#status");

function toast(msg) {
  const el = statusEl();
  el.textContent = msg;
  el.classList.add("on");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("on"), 1600);
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function uid() {
  return crypto.randomUUID();
}

let list = [];
let current = null;
let tab = "basic";
let saveTimer = 0;

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 700);
}

async function saveNow() {
  if (!current?.id) return;
  current.updatedAt = new Date().toISOString();
  try {
    await api("/api/resumes/" + current.id, { method: "PUT", body: JSON.stringify(current) });
    toast("已保存");
    await refreshList(false);
  } catch (e) {
    toast("保存失败：" + e.message);
  }
}

function field(label, key, path, extra = {}) {
  const val = path.split(".").reduce((o, k) => o?.[k], current) ?? "";
  const type = extra.type || "text";
  if (type === "textarea") {
    return `<div class="field span2"><label>${label}</label><textarea data-path="${path}">${escapeAttr(val)}</textarea></div>`;
  }
  if (type === "checkbox") {
    return `<label class="check"><input type="checkbox" data-path="${path}" ${val ? "checked" : ""}> ${label}</label>`;
  }
  return `<div class="field"><label>${label}</label><input type="${type}" data-path="${path}" value="${escapeAttr(val)}"></div>`;
}

function escapeAttr(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function bindFields(root) {
  root.querySelectorAll("[data-path]").forEach((el) => {
    const apply = () => {
      const keys = el.dataset.path.split(".");
      let obj = current;
      for (let i = 0; i < keys.length - 1; i++) {
        if (obj[keys[i]] == null) obj[keys[i]] = {};
        obj = obj[keys[i]];
      }
      const k = keys[keys.length - 1];
      obj[k] = el.type === "checkbox" ? el.checked : el.type === "number" ? Number(el.value) : el.value;
      scheduleSave();
      preview();
    };
    el.addEventListener("input", apply);
    el.addEventListener("change", apply);
  });
}

function itemTools(kind, id) {
  return `
    <div>
      <button class="btn ghost" data-act="up" data-kind="${kind}" data-id="${id}">上移</button>
      <button class="btn ghost" data-act="down" data-kind="${kind}" data-id="${id}">下移</button>
      <button class="btn danger" data-act="del" data-kind="${kind}" data-id="${id}">删</button>
    </div>`;
}

function listKey(kind) {
  if (kind === "experience") return "experience";
  if (kind === "education") return "education";
  if (kind === "projects") return "projects";
  if (kind === "certificates") return "certificates";
  if (kind === "customFields") return null;
  return kind;
}

function moveItem(arr, id, dir) {
  const i = arr.findIndex((x) => x.id === id);
  if (i < 0) return arr;
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const copy = arr.slice();
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

function onItemAct(e) {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const { act, kind, id } = btn.dataset;
  if (kind === "customFields") {
    let arr = current.basic.customFields || [];
    if (act === "del") arr = arr.filter((x) => x.id !== id);
    if (act === "up") arr = moveItem(arr, id, -1);
    if (act === "down") arr = moveItem(arr, id, 1);
    current.basic.customFields = arr;
  } else if (kind.startsWith("custom:")) {
    const sec = kind.slice(7);
    let arr = current.customData[sec] || [];
    if (act === "del") arr = arr.filter((x) => x.id !== id);
    if (act === "up") arr = moveItem(arr, id, -1);
    if (act === "down") arr = moveItem(arr, id, 1);
    current.customData[sec] = arr;
  } else if (kind === "menu") {
    let arr = current.menuSections || [];
    if (act === "del") {
      arr = arr.filter((x) => x.id !== id);
      delete current.customData[id];
    }
    if (act === "up") arr = moveItem(arr, id, -1).map((s, i) => ({ ...s, order: i }));
    if (act === "down") arr = moveItem(arr, id, 1).map((s, i) => ({ ...s, order: i }));
    current.menuSections = arr;
  } else {
    const key = listKey(kind);
    let arr = current[key] || [];
    if (act === "del") arr = arr.filter((x) => x.id !== id);
    if (act === "up") arr = moveItem(arr, id, -1);
    if (act === "down") arr = moveItem(arr, id, 1);
    current[key] = arr;
  }
  scheduleSave();
  drawEditor();
}

function tabBar() {
  const tabs = [
    ["meta", "对外"],
    ["basic", "基本信息"],
    ["experience", "工作经验"],
    ["projects", "项目"],
    ["education", "教育"],
    ["skills", "技能"],
    ["selfEvaluation", "自我评价"],
    ["certificates", "证书"],
    ["custom", "自定义板块"],
    ["layout", "版式"],
    ["json", "JSON"],
  ];
  return `<div class="tabs">${tabs.map(([id, label]) =>
    `<button data-tab="${id}" class="${tab === id ? "on" : ""}">${label}</button>`
  ).join("")}</div>`;
}

function editorHtml() {
  if (!current) return `<p class="muted">左侧新建或选一份简历。</p>`;
  let body = "";
  if (tab === "meta") {
    body = `
      <div class="grid">
        ${field("简历标题（后台识别用）", "title", "title")}
        ${field("公开路径 slug（/r/slug）", "slug", "slug")}
      </div>
      ${field("对外公开", "isPublic", "isPublic", { type: "checkbox" })}
      <p class="muted">每份是独立成品。不相干经历不要写进这一份。公开后地址：/r/${escapeAttr(current.slug || "")}</p>
    `;
  } else if (tab === "basic") {
    body = `
      <div class="grid">
        ${field("姓名", "name", "basic.name")}
        ${field("职位/一句话定位", "title", "basic.title")}
        ${field("邮箱", "email", "basic.email")}
        ${field("电话", "phone", "basic.phone")}
        ${field("所在地", "location", "basic.location")}
        ${field("状态", "status", "basic.employementStatus")}
        ${field("生日", "birth", "basic.birthDate")}
        ${field("GitHub 用户名", "gh", "basic.githubUseName")}
      </div>
      <div class="field"><label>头像</label><input type="file" accept="image/*" id="photoFile"></div>
      ${field("显示头像", "photoVis", "basic.photoConfig.visible", { type: "checkbox" })}
      <div class="field"><label>头像对齐</label>
        <select data-path="basic.layout">
          <option value="left" ${current.basic.layout === "left" ? "selected" : ""}>左</option>
          <option value="center" ${current.basic.layout === "center" ? "selected" : ""}>中</option>
          <option value="right" ${current.basic.layout === "right" ? "selected" : ""}>右</option>
        </select>
      </div>
      <h3>自定义联系字段</h3>
      ${(current.basic.customFields || []).map((f) => `
        <div class="item">
          <div class="item-head"><b>${escapeAttr(f.label) || "字段"}</b>${itemTools("customFields", f.id)}</div>
          <div class="grid">
            <div class="field"><label>标签</label><input data-path="basic.customFields.${f.id}.label" value="${escapeAttr(f.label)}"></div>
            <div class="field"><label>值</label><input data-path="basic.customFields.${f.id}.value" value="${escapeAttr(f.value)}"></div>
          </div>
          <label class="check"><input type="checkbox" data-path="basic.customFields.${f.id}.visible" ${f.visible !== false ? "checked" : ""}> 显示</label>
        </div>`).join("")}
      <button class="btn ghost" id="addField">加字段</button>
    `;
  } else if (tab === "experience") {
    body = listEditor("experience", () => ({
      id: uid(), company: "", position: "", date: "", details: "", visible: true,
    }), (e) => `
      <div class="grid">
        <div class="field"><label>职位</label><input data-path="experience.${e.id}.position" value="${escapeAttr(e.position)}"></div>
        <div class="field"><label>公司</label><input data-path="experience.${e.id}.company" value="${escapeAttr(e.company)}"></div>
        <div class="field span2"><label>时间</label><input data-path="experience.${e.id}.date" value="${escapeAttr(e.date)}"></div>
        <div class="field span2"><label>详情（HTML，可用 ul/li）</label><textarea data-path="experience.${e.id}.details">${escapeAttr(e.details)}</textarea></div>
      </div>
      <label class="check"><input type="checkbox" data-path="experience.${e.id}.visible" ${e.visible !== false ? "checked" : ""}> 这一条对外显示</label>
    `);
  } else if (tab === "projects") {
    body = listEditor("projects", () => ({
      id: uid(), name: "", role: "", date: "", description: "", visible: true, link: "", linkLabel: "",
    }), (p) => `
      <div class="grid">
        <div class="field"><label>项目</label><input data-path="projects.${p.id}.name" value="${escapeAttr(p.name)}"></div>
        <div class="field"><label>角色</label><input data-path="projects.${p.id}.role" value="${escapeAttr(p.role)}"></div>
        <div class="field"><label>时间</label><input data-path="projects.${p.id}.date" value="${escapeAttr(p.date)}"></div>
        <div class="field"><label>链接</label><input data-path="projects.${p.id}.link" value="${escapeAttr(p.link)}"></div>
        <div class="field span2"><label>链接文字</label><input data-path="projects.${p.id}.linkLabel" value="${escapeAttr(p.linkLabel)}"></div>
        <div class="field span2"><label>描述 HTML</label><textarea data-path="projects.${p.id}.description">${escapeAttr(p.description)}</textarea></div>
      </div>
      <label class="check"><input type="checkbox" data-path="projects.${p.id}.visible" ${p.visible !== false ? "checked" : ""}> 显示</label>
    `);
  } else if (tab === "education") {
    body = listEditor("education", () => ({
      id: uid(), school: "", major: "", degree: "", startDate: "", endDate: "", gpa: "", description: "", visible: true,
    }), (e) => `
      <div class="grid">
        <div class="field"><label>学校</label><input data-path="education.${e.id}.school" value="${escapeAttr(e.school)}"></div>
        <div class="field"><label>专业</label><input data-path="education.${e.id}.major" value="${escapeAttr(e.major)}"></div>
        <div class="field"><label>学位</label><input data-path="education.${e.id}.degree" value="${escapeAttr(e.degree)}"></div>
        <div class="field"><label>GPA</label><input data-path="education.${e.id}.gpa" value="${escapeAttr(e.gpa)}"></div>
        <div class="field"><label>开始</label><input data-path="education.${e.id}.startDate" value="${escapeAttr(e.startDate)}"></div>
        <div class="field"><label>结束</label><input data-path="education.${e.id}.endDate" value="${escapeAttr(e.endDate)}"></div>
        <div class="field span2"><label>描述 HTML</label><textarea data-path="education.${e.id}.description">${escapeAttr(e.description)}</textarea></div>
      </div>
      <label class="check"><input type="checkbox" data-path="education.${e.id}.visible" ${e.visible !== false ? "checked" : ""}> 显示</label>
    `);
  } else if (tab === "skills") {
    body = field("专业技能 HTML", "skills", "skillContent", { type: "textarea" });
  } else if (tab === "selfEvaluation") {
    body = field("自我评价 HTML", "se", "selfEvaluationContent", { type: "textarea" });
  } else if (tab === "certificates") {
    body = `
      ${(current.certificates || []).map((c) => `
        <div class="item">
          <div class="item-head"><b>证书</b>${itemTools("certificates", c.id)}</div>
          <div class="field"><label>图片 URL / Data URL</label><input data-path="certificates.${c.id}.url" value="${escapeAttr(c.url)}"></div>
          <div class="field"><label>宽度 %</label><input type="number" data-path="certificates.${c.id}.width" value="${escapeAttr(c.width || 30)}"></div>
        </div>`).join("")}
      <button class="btn ghost" id="addCert">加证书图片</button>
    `;
  } else if (tab === "custom") {
    const customs = (current.menuSections || []).filter((s) => !["basic","skills","experience","projects","education","selfEvaluation","certificates"].includes(s.id));
    body = `
      <p class="muted">自定义板块写入 customData，和魔方 JSON 一样。</p>
      ${(current.menuSections || []).map((s) => `
        <div class="item">
          <div class="item-head"><b>${escapeAttr(s.title)} <small>${s.id}</small></b>${itemTools("menu", s.id)}</div>
          <div class="grid">
            <div class="field"><label>标题</label><input data-path="menuSections.${s.id}.title" value="${escapeAttr(s.title)}"></div>
            <label class="check"><input type="checkbox" data-path="menuSections.${s.id}.enabled" ${s.enabled ? "checked" : ""}> 启用</label>
          </div>
        </div>`).join("")}
      <button class="btn ghost" id="addSection">新板块</button>
      ${customs.map((s) => `
        <h3>${escapeAttr(s.title)}</h3>
        ${((current.customData[s.id] || [])).map((it) => `
          <div class="item">
            <div class="item-head"><b>${escapeAttr(it.title) || "条目"}</b>${itemTools("custom:" + s.id, it.id)}</div>
            <div class="grid">
              <div class="field"><label>标题</label><input data-path="customData.${s.id}.${it.id}.title" value="${escapeAttr(it.title)}"></div>
              <div class="field"><label>副标题</label><input data-path="customData.${s.id}.${it.id}.subtitle" value="${escapeAttr(it.subtitle)}"></div>
              <div class="field span2"><label>时间</label><input data-path="customData.${s.id}.${it.id}.dateRange" value="${escapeAttr(it.dateRange)}"></div>
              <div class="field span2"><label>描述 HTML</label><textarea data-path="customData.${s.id}.${it.id}.description">${escapeAttr(it.description)}</textarea></div>
            </div>
          </div>`).join("")}
        <button class="btn ghost" data-add-custom="${s.id}">加一条</button>
      `).join("")}
    `;
  } else if (tab === "layout") {
    const g = current.globalSettings || {};
    body = `
      <div class="grid">
        <div class="field"><label>主题色</label><input type="color" data-path="globalSettings.themeColor" value="${escapeAttr(g.themeColor || "#8c2f1b")}"></div>
        <div class="field"><label>正文字号</label><input type="number" data-path="globalSettings.baseFontSize" value="${escapeAttr(g.baseFontSize || 16)}"></div>
        <div class="field"><label>行高</label><input type="number" step="0.05" data-path="globalSettings.lineHeight" value="${escapeAttr(g.lineHeight || 1.5)}"></div>
        <div class="field"><label>页边距</label><input type="number" data-path="globalSettings.pagePadding" value="${escapeAttr(g.pagePadding || 32)}"></div>
      </div>
      <p class="muted">公开页固定纸质编辑风（你定过的样式）。templateId 会写进 JSON 以便和魔方互导，不切换他们的皮肤。</p>
      ${field("templateId", "tid", "templateId")}
    `;
  } else if (tab === "json") {
    body = `
      <div class="field span2"><label>原始 JSON（魔方格式，可粘贴导入）</label>
        <textarea id="rawJson">${escapeAttr(JSON.stringify(toMagicExport(current), null, 2))}</textarea>
      </div>
      <button class="btn" id="applyJson">从 JSON 覆盖这一份</button>
      <button class="btn ghost" id="downloadJson">下载 JSON</button>
    `;
  }

  return tabBar() + body;
}

function listEditor(kind, factory, inner) {
  const arr = current[kind] || [];
  return `
    ${arr.map((item) => `
      <div class="item">
        <div class="item-head"><b>${escapeAttr(item.position || item.name || item.school || "条目")}</b>${itemTools(kind, item.id)}</div>
        ${inner(item)}
      </div>`).join("")}
    <button class="btn ghost" data-add="${kind}">加一条</button>
  `;
}

function setByIdPath(path, value) {
  const keys = path.split(".");
  const kind = keys[0];
  if (["experience", "projects", "education", "certificates"].includes(kind)) {
    const id = keys[1];
    const field = keys.slice(2).join(".");
    const arr = current[kind];
    const item = arr.find((x) => x.id === id);
    if (!item) return;
    item[field] = value;
    return;
  }
  if (kind === "basic" && keys[1] === "customFields") {
    const item = current.basic.customFields.find((x) => x.id === keys[2]);
    if (item) item[keys[3]] = value;
    return;
  }
  if (kind === "menuSections") {
    const item = current.menuSections.find((x) => x.id === keys[1]);
    if (item) item[keys[2]] = value;
    return;
  }
  if (kind === "customData") {
    const sec = keys[1];
    const item = (current.customData[sec] || []).find((x) => x.id === keys[2]);
    if (item) item[keys[3]] = value;
    return;
  }
  let obj = current;
  for (let i = 0; i < keys.length - 1; i++) {
    if (obj[keys[i]] == null) obj[keys[i]] = {};
    obj = obj[keys[i]];
  }
  obj[keys[keys.length - 1]] = value;
}

function bindEditor(root) {
  root.querySelectorAll("[data-tab]").forEach((b) => {
    b.onclick = () => { tab = b.dataset.tab; drawEditor(); };
  });
  root.querySelectorAll("[data-path]").forEach((el) => {
    const apply = () => {
      const v = el.type === "checkbox" ? el.checked : el.type === "number" ? Number(el.value) : el.value;
      setByIdPath(el.dataset.path, v);
      scheduleSave();
      preview();
    };
    el.addEventListener("input", apply);
    el.addEventListener("change", apply);
  });
  root.addEventListener("click", onItemAct);
  const add = root.querySelector("[data-add]");
  if (add) add.onclick = () => {
    const kind = add.dataset.add;
    const factory = {
      experience: () => ({ id: uid(), company: "", position: "", date: "", details: "", visible: true }),
      projects: () => ({ id: uid(), name: "", role: "", date: "", description: "", visible: true, link: "", linkLabel: "" }),
      education: () => ({ id: uid(), school: "", major: "", degree: "", startDate: "", endDate: "", gpa: "", description: "", visible: true }),
    }[kind];
    current[kind] = [...(current[kind] || []), factory()];
    scheduleSave();
    drawEditor();
  };
  const addField = $("#addField", root);
  if (addField) addField.onclick = () => {
    current.basic.customFields.push({ id: uid(), label: "", value: "", visible: true, icon: "Globe" });
    scheduleSave();
    drawEditor();
  };
  const addCert = $("#addCert", root);
  if (addCert) addCert.onclick = () => {
    current.certificates.push({ id: uid(), url: "", width: 30 });
    scheduleSave();
    drawEditor();
  };
  const addSection = $("#addSection", root);
  if (addSection) addSection.onclick = () => {
    const id = "custom-" + uid().slice(0, 8);
    current.menuSections.push({ id, title: "新板块", icon: "📄", enabled: true, order: current.menuSections.length });
    current.customData[id] = [];
    scheduleSave();
    drawEditor();
  };
  root.querySelectorAll("[data-add-custom]").forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.addCustom;
      current.customData[id] = current.customData[id] || [];
      current.customData[id].push({ id: uid(), title: "", subtitle: "", dateRange: "", description: "", visible: true });
      scheduleSave();
      drawEditor();
    };
  });
  const photo = $("#photoFile", root);
  if (photo) photo.onchange = () => {
    const f = photo.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      current.basic.photo = r.result;
      current.basic.photoConfig.visible = true;
      scheduleSave();
      preview();
    };
    r.readAsDataURL(f);
  };
  const applyJson = $("#applyJson", root);
  if (applyJson) applyJson.onclick = () => {
    try {
      const parsed = JSON.parse($("#rawJson", root).value);
      const keep = { id: current.id, slug: current.slug, isPublic: current.isPublic };
      current = normalizeMagic({ ...parsed, ...keep, id: keep.id });
      scheduleSave();
      drawEditor();
      toast("已从 JSON 覆盖");
    } catch (e) {
      toast("JSON 无效：" + e.message);
    }
  };
  const dl = $("#downloadJson", root);
  if (dl) dl.onclick = () => {
    const blob = new Blob([JSON.stringify(toMagicExport(current), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (current.slug || current.title || "resume") + ".json";
    a.click();
  };
}

function preview() {
  const mount = $("#previewMount");
  if (!mount || !current) return;
  mount.innerHTML = "";
  renderResume(mount, current, { hideNote: true });
}

function drawEditor() {
  const main = $("#editor");
  main.innerHTML = editorHtml();
  bindEditor(main);
  preview();
}

function drawList() {
  const box = $("#list");
  box.innerHTML = list.map((r) => `
    <button class="card ${current?.id === r.id ? "active" : ""}" data-id="${r.id}">
      <b>${escapeAttr(r.title)}</b>
      <small>${escapeAttr(r.name)} ${r.slug ? " · /r/" + escapeAttr(r.slug) : ""} ${r.isPublic ? " · 公开" : " · 草稿"}</small>
    </button>
  `).join("") || `<p class="muted">还没有简历</p>`;
  box.querySelectorAll(".card").forEach((c) => {
    c.onclick = () => openResume(c.dataset.id);
  });
}

async function refreshList(openFirst) {
  const data = await api("/api/resumes");
  list = data.resumes || [];
  drawList();
  if (openFirst && list[0] && !current) await openResume(list[0].id);
}

async function openResume(id) {
  const doc = await api("/api/resumes/" + id);
  current = normalizeMagic(doc);
  drawList();
  drawEditor();
}

async function createResume(from) {
  const doc = normalizeMagic(from || emptyResume());
  doc.id = uid();
  doc.createdAt = new Date().toISOString();
  doc.updatedAt = doc.createdAt;
  const saved = await api("/api/resumes", { method: "POST", body: JSON.stringify(doc) });
  current = normalizeMagic(saved);
  await refreshList(false);
  drawEditor();
}

function shell() {
  document.body.innerHTML = `
    <div class="app">
      <aside class="side">
        <h1>简历后台</h1>
        <div class="row">
          <button class="btn" id="newBtn">新建</button>
          <button class="btn ghost" id="importBtn">导入 JSON</button>
          <input type="file" id="importFile" accept="application/json" hidden>
        </div>
        <div class="row">
          <button class="btn ghost" id="dupBtn">复制</button>
          <button class="btn danger" id="delBtn">删除</button>
          <button class="btn ghost" id="outBtn">退出</button>
        </div>
        <div id="list" class="list"></div>
      </aside>
      <section class="main" id="editor"></section>
      <aside class="preview"><div id="previewMount"></div></aside>
    </div>
    <div class="status" id="status"></div>
  `;
  $("#newBtn").onclick = () => createResume();
  $("#importBtn").onclick = () => $("#importFile").click();
  $("#importFile").onchange = async () => {
    const f = $("#importFile").files?.[0];
    if (!f) return;
    const text = await f.text();
    await createResume(JSON.parse(text));
    toast("已导入");
  };
  $("#dupBtn").onclick = async () => {
    if (!current) return;
    const doc = await api("/api/resumes/" + current.id + "/duplicate", { method: "POST" });
    current = normalizeMagic(doc);
    await refreshList(false);
    drawEditor();
  };
  $("#delBtn").onclick = async () => {
    if (!current) return;
    if (!confirm("删除这一份？")) return;
    await api("/api/resumes/" + current.id, { method: "DELETE" });
    current = null;
    await refreshList(true);
    drawEditor();
  };
  $("#outBtn").onclick = async () => {
    await api("/api/logout", { method: "POST" });
    location.reload();
  };
}

function loginView() {
  document.body.innerHTML = `
    <form class="login" id="login">
      <h1>简历后台</h1>
      <p>OnSaas / EdgeNux。密码走 Worker Secret，不写进仓。</p>
      <input type="password" name="password" placeholder="密码" autocomplete="current-password" />
      <div style="margin-top:12px"><button class="btn" type="submit">进入</button></div>
      <p class="err" id="err"></p>
    </form>
  `;
  $("#login").onsubmit = async (e) => {
    e.preventDefault();
    const password = e.target.password.value;
    try {
      await api("/api/login", { method: "POST", body: JSON.stringify({ password }) });
      await bootApp();
    } catch (err) {
      $("#err").textContent = err.message;
    }
  };
}

async function bootApp() {
  shell();
  await refreshList(true);
  drawEditor();
}

try {
  await api("/api/me");
  await bootApp();
} catch {
  loginView();
}
