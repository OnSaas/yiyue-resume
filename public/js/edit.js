import { renderSheet } from "./sheet.js";

const $ = (id) => document.getElementById(id);

function toast(msg) {
  const el = $("status");
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
  if (res.status === 401) {
    location.href = "/login";
    throw new Error("未登录");
  }
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

const id = decodeURIComponent(location.pathname.replace(/^\/admin\/e\//, "").replace(/\/$/, ""));
if (!id) location.href = "/admin";

let data = null;

function rowLink(item = {}) {
  const wrap = document.createElement("div");
  wrap.className = "item";
  wrap.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "grid";
  const a = field("标签", item.label || "");
  const b = field("链接", item.href || "");
  a.input.dataset.k = "label";
  b.input.dataset.k = "href";
  grid.append(a.el, b.el);
  wrap.append(grid, delBtn(wrap));
  return wrap;
}

function field(label, value) {
  const el = document.createElement("div");
  el.className = "field";
  const lab = document.createElement("label");
  lab.textContent = label;
  const input = document.createElement("input");
  input.value = value;
  el.append(lab, input);
  return { el, input };
}

function delBtn(wrap) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn danger";
  b.textContent = "删";
  b.addEventListener("click", () => {
    wrap.remove();
    sync();
  });
  return b;
}

function rowSkill(value = "") {
  const wrap = document.createElement("div");
  wrap.className = "item";
  const { el, input } = field("技能", value);
  input.dataset.k = "skill";
  wrap.append(el, delBtn(wrap));
  return wrap;
}

function rowJob(item = {}) {
  const wrap = document.createElement("div");
  wrap.className = "item";
  const g = document.createElement("div");
  g.className = "grid";
  const role = field("职位/名称", item.role || "");
  const org = field("组织", item.org || "");
  const time = field("时间", item.time || "");
  role.input.dataset.k = "role";
  org.input.dataset.k = "org";
  time.input.dataset.k = "time";
  time.el.classList.add("span2");
  g.append(role.el, org.el, time.el);
  const pts = document.createElement("div");
  pts.className = "field span2";
  const lab = document.createElement("label");
  lab.textContent = "要点（一行一条）";
  const ta = document.createElement("textarea");
  ta.value = (item.points || []).join("\n");
  ta.dataset.k = "points";
  pts.append(lab, ta);
  wrap.append(g, pts, delBtn(wrap));
  return wrap;
}

function fillRepeats() {
  const links = $("links");
  links.replaceChildren();
  (data.links || []).forEach((x) => links.append(rowLink(x)));
  const contact = $("contact");
  contact.replaceChildren();
  (data.contact || []).forEach((x) => contact.append(rowLink(x)));
  const skills = $("skills");
  skills.replaceChildren();
  (data.skills || []).forEach((x) => skills.append(rowSkill(x)));
  const exp = $("experience");
  exp.replaceChildren();
  (data.experience || []).forEach((x) => exp.append(rowJob(x)));
  const pro = $("projects");
  pro.replaceChildren();
  (data.projects || []).forEach((x) => pro.append(rowJob(x)));
}

function collectList(root, kind) {
  if (kind === "skills") {
    return [...root.querySelectorAll("input")].map((i) => i.value);
  }
  if (kind === "links" || kind === "contact") {
    return [...root.querySelectorAll(".item")].map((item) => {
      const inputs = item.querySelectorAll("input");
      return { label: inputs[0]?.value || "", href: inputs[1]?.value || "" };
    });
  }
  return [...root.querySelectorAll(".item")].map((item) => {
    const obj = { role: "", org: "", time: "", points: [] };
    item.querySelectorAll("[data-k]").forEach((n) => {
      if (n.dataset.k === "points") obj.points = n.value.split("\n").map((s) => s.trim()).filter(Boolean);
      else obj[n.dataset.k] = n.value;
    });
    return obj;
  });
}

function fieldVal(name) {
  return $("form").elements.namedItem(name);
}

function readForm() {
  return {
    id: data.id,
    name: fieldVal("name").value,
    nameEn: fieldVal("nameEn").value,
    variant: fieldVal("variant").value,
    tagline: fieldVal("tagline").value,
    theme: fieldVal("theme").value,
    links: collectList($("links"), "links"),
    contact: collectList($("contact"), "contact"),
    skills: collectList($("skills"), "skills"),
    experience: collectList($("experience"), "job"),
    projects: collectList($("projects"), "job"),
  };
}

function writeForm(doc) {
  fieldVal("name").value = doc.name || "";
  fieldVal("nameEn").value = doc.nameEn || "";
  fieldVal("variant").value = doc.variant || "";
  fieldVal("tagline").value = doc.tagline || "";
  fieldVal("theme").value = doc.theme || "paper";
  $("editTitle").textContent = doc.variant || doc.name || doc.id;
  $("json").value = JSON.stringify(doc, null, 2);
}

function sync() {
  data = { ...data, ...readForm() };
  $("json").value = JSON.stringify(data, null, 2);
  $("editTitle").textContent = data.variant || data.name || data.id;
  renderSheet($("live"), data);
}

async function boot() {
  if (!$("saveBtn") || !$("form")) throw new Error("编辑页节点缺失");
  data = await api("/api/resumes/" + encodeURIComponent(id));
  writeForm(data);
  fillRepeats();
  sync();

  $("form").addEventListener("input", sync);
  $("backBtn").onclick = () => { location.href = "/admin"; };
  $("saveBtn").onclick = async () => {
    $("formErr").textContent = "";
    try {
      sync();
      data = await api("/api/resumes/" + encodeURIComponent(id), { method: "PUT", body: JSON.stringify(data) });
      writeForm(data);
      toast("已保存");
    } catch (e) {
      $("formErr").textContent = e.message;
    }
  };
  $("exportBtn").onclick = () => {
    sync();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = data.id + ".json";
    a.click();
    toast("已导出");
  };
  $("fullBtn").onclick = () => window.open("/admin/preview/" + encodeURIComponent(id), "_blank");
  $("delBtn").onclick = async () => {
    if (!confirm("删除 " + id + "？分享不会一起删。")) return;
    try {
      await api("/api/resumes/" + encodeURIComponent(id), { method: "DELETE" });
      toast("已删除");
      location.href = "/admin";
    } catch (e) {
      $("formErr").textContent = e.message;
    }
  };
  $("applyJson").onclick = () => {
    $("formErr").textContent = "";
    try {
      const raw = JSON.parse($("json").value);
      if (!raw || typeof raw !== "object") throw new Error("坏 JSON");
      data = { ...raw, id };
      writeForm(data);
      fillRepeats();
      sync();
      toast("已应用到表单，记得保存");
    } catch (e) {
      $("formErr").textContent = e.message;
    }
  };
  document.querySelectorAll("[data-add]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const k = btn.dataset.add;
      if (k === "links" || k === "contact") $(k).append(rowLink());
      else if (k === "skills") $(k).append(rowSkill());
      else $(k).append(rowJob());
      sync();
    });
  });
}

try {
  await boot();
} catch (e) {
  const box = $("bindErr") || $("formErr") || $("status");
  if (box) {
    box.textContent = "脚本绑定失败：" + e.message;
    box.classList?.add("on");
  }
}
