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

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

let currentId = "";
let list = [];

function fillTheme() {
  $("theme").innerHTML = THEMES.map((t) => `<option value="${t.id}">${t.label}</option>`).join("");
}

function showJson(doc) {
  $("json").value = JSON.stringify(doc, null, 2);
  currentId = doc.id;
  $("jsonErr").textContent = "";
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
  const box = $("list");
  box.replaceChildren();
  if (!list.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "还没有简历";
    box.appendChild(p);
    return;
  }
  for (const r of list) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "card" + (r.id === currentId ? " active" : "");
    const title = document.createElement("b");
    title.textContent = r.variant || r.name || r.id;
    const sub = document.createElement("small");
    sub.textContent = r.id + (r.theme ? " · " + r.theme : "");
    b.append(title, sub);
    b.addEventListener("click", () => openResume(r.id));
    box.appendChild(b);
  }
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
    const a = document.createElement("a");
    a.href = s.url;
    a.textContent = location.origin + s.url;
    const meta = document.createElement("div");
    meta.className = "muted";
    meta.textContent = [
      s.label,
      s.resumeId,
      s.theme || "沿用简历主题",
      s.hasPassword ? "有密码" : "无密码",
      s.revoked ? "已撤销" : remain(s.expiresAt),
    ].filter(Boolean).join(" · ");
    left.append(a, meta);
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
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "btn ghost";
    copy.textContent = "复制";
    copy.addEventListener("click", async () => {
      await navigator.clipboard.writeText(location.origin + s.url);
      toast("已复制");
    });
    head.append(left, copy, rev);
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
  showJson(doc);
  drawList();
}

$("newBtn").onclick = () => {
  showJson(blank());
  drawList();
};

$("importBtn").onclick = () => $("importFile").click();
$("importFile").onchange = async () => {
  const f = $("importFile").files?.[0];
  if (!f) return;
  try {
    const raw = JSON.parse(await f.text());
    showJson(raw);
    toast("已读入，点保存写入 KV");
  } catch (e) {
    $("jsonErr").textContent = e.message;
  }
};

$("saveBtn").onclick = async () => {
  try {
    const raw = parseEditor();
    const method = list.some((x) => x.id === raw.id) ? "PUT" : "POST";
    const path = method === "PUT" ? "/api/resumes/" + encodeURIComponent(raw.id) : "/api/resumes";
    const doc = await api(path, { method, body: JSON.stringify(raw) });
    showJson(doc);
    await refreshList();
    toast("已写入 KV");
  } catch (e) {
    $("jsonErr").textContent = e.message;
  }
};

$("exportBtn").onclick = () => {
  try {
    const raw = parseEditor();
    const blob = new Blob([JSON.stringify(raw, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (raw.id || "resume") + ".json";
    a.click();
  } catch (e) {
    $("jsonErr").textContent = e.message;
  }
};

$("previewBtn").onclick = () => {
  try {
    const raw = parseEditor();
    const theme = $("theme").value;
    window.open("/admin/preview/" + encodeURIComponent(raw.id) + "?theme=" + encodeURIComponent(theme), "_blank");
  } catch (e) {
    $("jsonErr").textContent = e.message;
  }
};

$("delBtn").onclick = async () => {
  try {
    const raw = parseEditor();
    if (!confirm("删除 " + raw.id + "？")) return;
    await api("/api/resumes/" + encodeURIComponent(raw.id), { method: "DELETE" });
    showJson(blank());
    await refreshList();
    toast("已删除");
  } catch (e) {
    $("jsonErr").textContent = e.message;
  }
};

$("shareBtn").onclick = async () => {
  try {
    const raw = parseEditor();
    if (!list.some((x) => x.id === raw.id)) {
      $("jsonErr").textContent = "先保存简历再分享";
      return;
    }
    const ttl = $("ttl").value;
    const body = {
      resumeId: raw.id,
      theme: $("theme").value,
      password: $("sharePw").value || undefined,
      label: $("label").value,
    };
    if (ttl === "never") body.expiresAt = null;
    else if (ttl === "custom") body.ttlSec = Number($("ttlCustom").value);
    else body.ttlSec = Number(ttl);
    const s = await api("/api/shares", { method: "POST", body: JSON.stringify(body) });
    const url = location.origin + s.url;
    $("shareOut").textContent = url;
    await navigator.clipboard.writeText(url).catch(() => {});
    $("sharePw").value = "";
    toast("已生成并复制");
    drawShares();
  } catch (e) {
    toast(e.message);
  }
};

$("outBtn").onclick = async () => {
  await api("/logout", { method: "POST" });
  location.href = "/login";
};

fillTheme();
try {
  await refreshList();
  if (list[0]) await openResume(list[0].id);
  else showJson(blank());
  await drawShares();
} catch (e) {
  toast(e.message);
}
