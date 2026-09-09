const THEMES = [
  { id: "paper", label: "米纸" },
  { id: "ink", label: "印刷" },
  { id: "night", label: "深色" },
  { id: "plain", label: "近白" },
];

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

function blank() {
  return {
    id: "resume-" + crypto.randomUUID().slice(0, 8),
    theme: "paper",
    variant: "",
    name: "楚扉月",
    nameEn: "Chu Yiyue",
    tagline: "",
    links: [{ label: "GitHub", href: "https://github.com/chuyiyue" }],
    contact: [{ label: "github.com/chuyiyue", href: "https://github.com/chuyiyue" }],
    skills: [],
    experience: [],
    projects: [],
  };
}

let list = [];
let savedId = "";
let draft = true;
let shareMode = "create";
let editToken = "";

function fillSelect(el, items, extra) {
  el.replaceChildren();
  if (extra) el.append(extra);
  for (const it of items) {
    const o = document.createElement("option");
    o.value = it.id;
    o.textContent = it.label;
    el.append(o);
  }
}

function showJson(doc, isDraft) {
  $("json").value = JSON.stringify(doc, null, 2);
  savedId = isDraft ? "" : doc.id;
  draft = !!isDraft;
  $("jsonErr").textContent = "";
  drawList();
}

function parseEditor() {
  let raw;
  try {
    raw = JSON.parse($("json").value);
  } catch {
    throw new Error("坏 JSON");
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("简历必须是 JSON 对象");
  return raw;
}

function drawList() {
  $("count").textContent = list.length ? list.length + " 份" : "0 份";
  const box = $("list");
  box.replaceChildren();
  if (!list.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "还没有已保存的简历";
    box.appendChild(p);
    return;
  }
  for (const r of list) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "card" + (!draft && r.id === savedId ? " active" : "");
    const title = document.createElement("b");
    title.textContent = r.variant || r.name || r.id;
    const sub = document.createElement("small");
    sub.textContent = r.id + " · " + (r.theme || "paper");
    b.append(title, sub);
    b.addEventListener("click", () => openResume(r.id));
    box.appendChild(b);
  }
  fillResumeSelect();
}

function fillResumeSelect() {
  const sel = $("resumeId");
  const keep = sel.value;
  fillSelect(
    sel,
    list.map((r) => ({ id: r.id, label: (r.variant || r.name || r.id) + " · " + r.id }))
  );
  if (keep && [...sel.options].some((o) => o.value === keep)) sel.value = keep;
}

function remain(expiresAt) {
  if (expiresAt == null) return "永不过期";
  const ms = Number(expiresAt) - Date.now();
  if (ms <= 0) return "已过期";
  const h = Math.floor(ms / 3600000);
  if (h >= 48) return Math.floor(h / 24) + " 天";
  if (h >= 1) return h + " 小时";
  return Math.max(1, Math.floor(ms / 60000)) + " 分钟";
}

function expiryBody() {
  const ttl = $("ttl").value;
  if (ttl === "never") return { expiresAt: null };
  if (ttl === "custom") return { ttlSec: Number($("ttlCustom").value) };
  return { ttlSec: Number(ttl) };
}

function setShareMode(mode, share) {
  shareMode = mode;
  $("modeCreate").classList.toggle("on", mode === "create");
  $("modeEdit").classList.toggle("on", mode === "edit");
  $("clearPwWrap").hidden = mode !== "edit";
  $("editToken").hidden = mode !== "edit";
  $("shareBtn").textContent = mode === "edit" ? "保存修改" : "生成链接";
  $("shareHint").textContent =
    mode === "edit" ? "保存走 PATCH，token / URL 不变。" : "生成会发新 token。";
  $("shareErr").textContent = "";
  if (mode === "create") {
    editToken = "";
    $("editToken").textContent = "";
    $("sharePw").value = "";
    $("clearPw").value = "no";
    $("label").value = "";
    $("shareOut").textContent = "";
    return;
  }
  if (share) {
    editToken = share.token;
    $("editToken").textContent = location.origin + share.url;
    $("resumeId").value = share.resumeId;
    $("theme").value = share.theme || "paper";
    $("label").value = share.label || "";
    $("sharePw").value = "";
    $("clearPw").value = "no";
    $("ttl").value = share.expiresAt == null ? "never" : "604800";
  }
}

async function drawShares() {
  const { shares } = await api("/api/shares");
  const box = $("shares");
  box.replaceChildren();
  if (!shares.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "还没有分享";
    box.appendChild(p);
    return;
  }
  for (const s of shares) {
    const item = document.createElement("div");
    item.className = "item";
    const head = document.createElement("div");
    head.className = "item-head";
    const left = document.createElement("div");
    const url = document.createElement("div");
    url.className = "url";
    url.textContent = location.origin + s.url;
    const meta = document.createElement("div");
    meta.className = "muted";
    meta.textContent = [
      s.label,
      s.resumeId,
      s.theme || "沿用简历主题",
      s.hasPassword ? "有密码" : "无密码",
      s.revoked ? "已撤销" : remain(s.expiresAt),
    ]
      .filter(Boolean)
      .join(" · ");
    left.append(url, meta);
    const row = document.createElement("div");
    row.className = "row";
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "btn ghost";
    copy.textContent = "复制";
    copy.addEventListener("click", async () => {
      await navigator.clipboard.writeText(location.origin + s.url);
      toast("已复制");
    });
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "btn ghost";
    edit.textContent = "修改";
    edit.disabled = !!s.revoked;
    edit.addEventListener("click", () => {
      if (s.revoked) return;
      setBench("shares");
      setShareMode("edit", s);
    });
    const rev = document.createElement("button");
    rev.type = "button";
    rev.className = "btn danger";
    rev.textContent = "撤销";
    rev.disabled = !!s.revoked;
    rev.addEventListener("click", async () => {
      await api("/api/shares/" + s.token, { method: "DELETE" });
      toast("已撤销");
      drawShares();
    });
    row.append(copy, edit, rev);
    head.append(left, row);
    item.append(head);
    box.appendChild(item);
  }
}

async function refreshList() {
  const data = await api("/api/resumes");
  list = data.resumes || [];
  drawList();
}

async function openResume(id) {
  const doc = await api("/api/resumes/" + encodeURIComponent(id));
  showJson(doc, false);
}

function setBench(name) {
  $("benchResumes").classList.toggle("hidden", name !== "resumes");
  $("benchShares").classList.toggle("hidden", name !== "shares");
  $("tabResumes").classList.toggle("on", name === "resumes");
  $("tabShares").classList.toggle("on", name === "shares");
}

$("tabResumes").onclick = () => setBench("resumes");
$("tabShares").onclick = () => setBench("shares");
$("modeCreate").onclick = () => setShareMode("create");
$("modeEdit").onclick = () => setShareMode("edit");

$("newBtn").onclick = () => showJson(blank(), true);
$("importBtn").onclick = () => $("importFile").click();
$("importFile").onchange = async () => {
  const f = $("importFile").files?.[0];
  if (!f) return;
  try {
    showJson(JSON.parse(await f.text()), true);
    toast("已读入，点保存写入 KV");
  } catch (e) {
    $("jsonErr").textContent = e.message;
  }
};

$("saveBtn").onclick = async () => {
  try {
    const raw = parseEditor();
    const exists = list.some((x) => x.id === raw.id);
    const path = exists ? "/api/resumes/" + encodeURIComponent(raw.id) : "/api/resumes";
    const doc = await api(path, { method: exists ? "PUT" : "POST", body: JSON.stringify(raw) });
    showJson(doc, false);
    await refreshList();
    toast("已保存");
  } catch (e) {
    $("jsonErr").textContent = e.message;
  }
};

$("exportBtn").onclick = () => {
  try {
    const raw = parseEditor();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(raw, null, 2)], { type: "application/json" }));
    a.download = (raw.id || "resume") + ".json";
    a.click();
  } catch (e) {
    $("jsonErr").textContent = e.message;
  }
};

$("previewBtn").onclick = () => {
  try {
    const raw = parseEditor();
    if (draft || !list.some((x) => x.id === raw.id)) {
      $("jsonErr").textContent = "先保存再预览";
      return;
    }
    window.open("/admin/preview/" + encodeURIComponent(raw.id) + "?theme=" + encodeURIComponent($("theme").value), "_blank");
  } catch (e) {
    $("jsonErr").textContent = e.message;
  }
};

$("delBtn").onclick = async () => {
  try {
    const raw = parseEditor();
    if (draft || !list.some((x) => x.id === raw.id)) {
      $("jsonErr").textContent = "这份还没保存";
      return;
    }
    if (!confirm("删除 " + raw.id + "？分享不会一起删。")) return;
    await api("/api/resumes/" + encodeURIComponent(raw.id), { method: "DELETE" });
    showJson(blank(), true);
    await refreshList();
    toast("已删除");
  } catch (e) {
    $("jsonErr").textContent = e.message;
  }
};

$("shareBtn").onclick = async () => {
  $("shareErr").textContent = "";
  try {
    if (!list.length) throw new Error("先在「简历」里保存至少一份");
    const resumeId = $("resumeId").value;
    if (!resumeId) throw new Error("选一份已保存的简历");
    const body = {
      resumeId,
      theme: $("theme").value,
      label: $("label").value,
      ...expiryBody(),
    };
    if (shareMode === "create") {
      if ($("sharePw").value) body.password = $("sharePw").value;
      const s = await api("/api/shares", { method: "POST", body: JSON.stringify(body) });
      const url = location.origin + s.url;
      $("shareOut").textContent = url;
      await navigator.clipboard.writeText(url).catch(() => {});
      $("sharePw").value = "";
      toast("已生成并复制");
    } else {
      if (!editToken) throw new Error("从下方列表点「修改」，或先生成");
      if ($("clearPw").value === "yes") body.clearPassword = true;
      else if ($("sharePw").value) body.password = $("sharePw").value;
      const s = await api("/api/shares/" + editToken, { method: "PATCH", body: JSON.stringify(body) });
      $("shareOut").textContent = location.origin + s.url;
      $("sharePw").value = "";
      toast("已保存，URL 未变");
    }
    await drawShares();
  } catch (e) {
    $("shareErr").textContent = e.message;
  }
};

$("resetShareBtn").onclick = () => setShareMode("create");

$("outBtn").onclick = async () => {
  await api("/logout", { method: "POST" });
  location.href = "/login";
};

fillSelect($("theme"), [{ id: "", label: "沿用简历主题" }, ...THEMES]);
try {
  await refreshList();
  if (list[0]) await openResume(list[0].id);
  else showJson(blank(), true);
  await drawShares();
} catch (e) {
  toast(e.message);
}
