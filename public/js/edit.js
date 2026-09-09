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

let data = { resume: null, presentation: { layout: "classic", theme: "paper" } };
let pendingImport = null;

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
  const url = field("链接", item.url || "");
  role.input.dataset.k = "role";
  org.input.dataset.k = "org";
  time.input.dataset.k = "time";
  url.input.dataset.k = "url";
  time.el.classList.add("span2");
  g.append(role.el, org.el, time.el, url.el);
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
  const r = data.resume || {};
  const links = $("links");
  links.replaceChildren();
  (r.links || []).forEach((x) => links.append(rowLink(x)));
  const contact = $("contact");
  contact.replaceChildren();
  const skills = $("skills");
  skills.replaceChildren();
  (r.skills || []).forEach((x) => skills.append(rowSkill(x)));
  const exp = $("experience");
  exp.replaceChildren();
  (r.experience || []).forEach((x) => exp.append(rowJob(x)));
  const pro = $("projects");
  pro.replaceChildren();
  (r.projects || []).forEach((x) =>
    pro.append(rowJob({ role: x.name, org: x.role, time: x.time, points: x.points, url: x.url }))
  );
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
    resume: {
      basics: {
        name: fieldVal("name").value,
        nameEn: fieldVal("nameEn").value,
        headline: fieldVal("headline")?.value || fieldVal("variant")?.value || "",
        summary: fieldVal("tagline").value,
        avatar: data.resume?.basics?.avatar || "",
        email: data.resume?.basics?.email || "",
        phone: data.resume?.basics?.phone || "",
        location: data.resume?.basics?.location || "",
      },
      links: collectList($("links"), "links"),
      contact: [],
      experience: collectList($("experience"), "job"),
      education: data.resume?.education || [],
      projects: collectList($("projects"), "job").map((p, i) => ({
        name: p.role,
        role: p.org,
        time: p.time,
        url: p.url || data.resume?.projects?.[i]?.url || "",
        points: p.points,
      })),
      extras: data.resume?.extras || {},
      skills: collectList($("skills"), "skills"),
      languages: data.resume?.languages || [],
      certifications: data.resume?.certifications || [],
      awards: data.resume?.awards || [],
      publications: data.resume?.publications || [],
      customSections: data.resume?.customSections || [],
    },
    presentation: {
      layout: fieldVal("layout")?.value || "classic",
      layoutVariant: fieldVal("layoutVariant")?.value || "",
      theme: fieldVal("theme").value || "paper",
      orientation: fieldVal("orientation")?.value || "portrait",
      themeOverrides: {
        ...(data.presentation?.themeOverrides || {}),
        accentColor: fieldVal("accentColor")?.value || undefined,
        fontSize: fieldVal("fontSize")?.value || undefined,
      },
    },
  };
}

function writeForm(doc) {
  const r = doc.resume || doc;
  const b = r.basics || {};
  fieldVal("name").value = b.name || "";
  fieldVal("nameEn").value = b.nameEn || "";
  fieldVal("headline").value = b.headline || "";
  fieldVal("tagline").value = b.summary || "";
  fieldVal("theme").value = doc.presentation?.theme || "paper";
  if (fieldVal("layout")) fieldVal("layout").value = doc.presentation?.layout || "classic";
  if (fieldVal("layoutVariant")) fieldVal("layoutVariant").value = doc.presentation?.layoutVariant || "left";
  if (fieldVal("orientation")) fieldVal("orientation").value = doc.presentation?.orientation || "portrait";
  if (fieldVal("accentColor")) fieldVal("accentColor").value = doc.presentation?.themeOverrides?.accentColor || "";
  if (fieldVal("fontSize")) fieldVal("fontSize").value = doc.presentation?.themeOverrides?.fontSize || "";
  $("editTitle").textContent = b.headline || b.name || doc.id;
  $("json").value = JSON.stringify(r, null, 2);
}

function sync() {
  data = { id: data.id, ...readForm() };
  $("json").value = JSON.stringify(data.resume, null, 2);
  $("editTitle").textContent = data.resume.basics.headline || data.resume.basics.name || data.id;
  preview();
  layoutA4();
}

let previewTimer = 0;
async function preview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(async () => {
    try {
      const out = await api("/api/preview", { method: "POST", body: JSON.stringify(data) });
      const live = $("live");
      live.innerHTML = out.html || "";
      layoutA4();
    } catch {
      /* keep last */
    }
  }, 200);
}

function layoutA4() {
  const a4 = $("a4");
  const sizer = $("a4sizer");
  const inner = $("live");
  if (!a4 || !sizer || !inner) return;
  const boxW = a4.clientWidth || Math.min(420, a4.parentElement?.clientWidth || 420);
  const scale = boxW / 820;
  a4.style.height = boxW * 297 / 210 + "px";
  inner.style.width = "820px";
  inner.style.transform = "scale(" + scale + ")";
  inner.style.transformOrigin = "top left";
  const sheet = inner.querySelector(".sheet");
  const sh = sheet ? Math.max(sheet.scrollHeight, sheet.offsetHeight, 1100) : 1100;
  sizer.style.width = boxW + "px";
  sizer.style.height = sh * scale + "px";
}

async function previewImport(raw) {
  $("formErr").textContent = "";
  const got = await api("/api/import", { method: "POST", body: JSON.stringify({ payload: raw }) });
  pendingImport = got;
  const fmt = got.format === "mofang" ? "魔方简历 JSON" : got.format === "yiyue-project" ? "项目 JSON" : got.format;
  const s = got.stats || {};
  $("importHint").textContent = `已识别为${fmt} · 经历 ${s.experience || 0} · 项目 ${s.projects || 0}` +
    (got.warnings?.length ? ` · ${got.warnings.length} 条提示` : "");
  if ($("importConfirmBtn")) $("importConfirmBtn").hidden = false;
  toast("预览导入结果，确认后才替换");
}

async function boot() {
  if (!$("saveBtn") || !$("form")) throw new Error("编辑页节点缺失");
  data = await api("/api/resumes/" + encodeURIComponent(id));
  writeForm(data);
  fillRepeats();
  sync();

  $("form").addEventListener("input", sync);
  $("form").addEventListener("change", () => {
    const wrap = $("variantWrap");
    if (wrap && fieldVal("layout")) wrap.hidden = fieldVal("layout").value !== "sidebar";
  });
  if ($("importMofangBtn")) {
    $("importMofangBtn").onclick = () => $("importMofangFile").click();
    $("importMofangFile").onchange = async () => {
      const f = $("importMofangFile").files?.[0];
      if (!f) return;
      try {
        await previewImport(JSON.parse(await f.text()));
      } catch (e) {
        $("formErr").textContent = e.message;
        $("importHint").textContent = "";
      }
    };
  }
  if ($("importPasteBtn")) {
    $("importPasteBtn").onclick = async () => {
      $("formErr").textContent = "";
      try {
        await previewImport(JSON.parse($("json").value));
      } catch (e) {
        $("formErr").textContent = e.message;
      }
    };
  }
  if ($("importConfirmBtn")) {
    $("importConfirmBtn").onclick = () => {
      if (!pendingImport?.canonical) return;
      data.resume = pendingImport.canonical;
      writeForm(data);
      fillRepeats();
      sync();
      $("importHint").textContent = "已替换当前简历（未保存）";
      $("importConfirmBtn").hidden = true;
      pendingImport = null;
      toast("已应用到表单，记得保存");
    };
  }
  if ($("exportMofangBtn")) {
    $("exportMofangBtn").onclick = async () => {
      try {
        const m = await api("/api/resumes/" + encodeURIComponent(id) + "/mofang");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([JSON.stringify(m, null, 2)], { type: "application/json" }));
        a.download = id + "-mofang.json";
        a.click();
        toast("已导出魔方 JSON");
      } catch (e) {
        $("formErr").textContent = e.message;
      }
    };
  }
  $("backBtn").onclick = () => { location.href = "/admin"; };
  $("saveBtn").onclick = async () => {
    $("formErr").textContent = "";
    try {
      sync();
      const saved = await api("/api/resumes/" + encodeURIComponent(id), { method: "PUT", body: JSON.stringify(data) });
      data = saved;
      writeForm(data);
      fillRepeats();
      toast("已保存");
    } catch (e) {
      $("formErr").textContent = e.message;
    }
  };
  $("exportBtn").onclick = () => {
    sync();
    const payload = { format: "yiyue-project", version: 1, resume: data.resume, presentation: data.presentation };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    a.download = (data.id || id) + "-project.json";
    a.click();
    toast("已导出项目 JSON");
  };
  $("fullBtn").onclick = async () => {
    sync();
    try {
      const out = await api("/api/preview", { method: "POST", body: JSON.stringify(data) });
      const w = window.open("about:blank", "_blank");
      if (!w) {
        window.open("/admin/preview/" + encodeURIComponent(id), "_blank");
        return;
      }
      w.document.open();
      w.document.write("<!DOCTYPE html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\"><link rel=\"stylesheet\" href=\"/css/resume.css\"></head><body class=\"page\">" + (out.html || "") + "</body></html>");
      w.document.close();
    } catch {
      window.open("/admin/preview/" + encodeURIComponent(id), "_blank");
    }
  };
  window.addEventListener("resize", layoutA4);
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
      data = { id, resume: raw.basics ? raw : (data.resume || raw), presentation: data.presentation };
      if (raw.basics) data.resume = raw;
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
