const THEMES = [
  { id: "paper", label: "米纸" },
  { id: "ink", label: "印刷" },
  { id: "night", label: "深色" },
  { id: "plain", label: "近白" },
];
const themeLabel = (id) => THEMES.find((t) => t.id === id)?.label || id || "米纸";

const $ = (id) => document.getElementById(id);

function toast(msg) {
  const el = $("status");
  el.textContent = msg;
  el.classList.add("on");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("on"), 1600);
}

function blank() {
  return {
    theme: "paper",
    variant: "",
    name: "",
    nameEn: "",
    tagline: "",
    links: [],
    contact: [],
    skills: [],
    experience: [],
    projects: [],
  };
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
  if (!res.ok) {
    const e = data?.error;
    throw new Error((e && typeof e === "object" ? e.message : e) || res.statusText);
  }
  return data;
}

let list = [];
let shareMode = "create";
let editToken = "";

function must(id) {
  const n = $(id);
  if (!n) throw new Error("缺少按钮或节点 #" + id);
  return n;
}

function fillSelect(el, items) {
  el.replaceChildren();
  for (const it of items) {
    const o = document.createElement("option");
    o.value = it.id;
    o.textContent = it.label;
    el.append(o);
  }
}

function scaleThumbs() {
  document.querySelectorAll(".thumb").forEach((wrap) => {
    const iframe = wrap.querySelector("iframe");
    if (!iframe) return;
    const w = wrap.clientWidth || 240;
    const scale = w / 820;
    iframe.style.width = "820px";
    iframe.style.height = 250 / scale + "px";
    iframe.style.transform = "scale(" + scale + ")";
  });
}

function updateSharePreview() {
  const iframe = $("sharePreview");
  if (!iframe) return;
  const id = $("resumeId").value;
  if (!id) {
    iframe.removeAttribute("src");
    return;
  }
  const theme = $("theme").value;
  const layout = $("layout")?.value || "";
  let src = "/admin/preview/" + encodeURIComponent(id);
  const q = [];
  if (theme && theme !== "inherit") q.push("theme=" + encodeURIComponent(theme));
  if (layout && layout !== "inherit") q.push("layout=" + encodeURIComponent(layout));
  const ori = $("orientation")?.value || "";
  if (ori && ori !== "inherit") q.push("orientation=" + encodeURIComponent(ori));
  if (q.length) src += "?" + q.join("&");
  if (iframe.getAttribute("src") !== src) iframe.setAttribute("src", src);
  requestAnimationFrame(scaleThumbs);
}

function drawCards() {
  $("count").textContent = list.length + " 份";
  const box = $("cards");
  box.replaceChildren();
  if (!list.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "还没有简历";
    box.appendChild(p);
  }
  for (const r of list) {
    const card = document.createElement("article");
    card.className = "preview-card";
    const thumb = document.createElement("div");
    thumb.className = "thumb";
    const iframe = document.createElement("iframe");
    iframe.src = "/admin/preview/" + encodeURIComponent(r.id);
    iframe.title = r.variant || r.name || r.id;
    iframe.tabIndex = -1;
    thumb.append(iframe);
    const meta = document.createElement("div");
    meta.className = "card-meta";
    const b = document.createElement("b");
    b.textContent = r.variant || r.name || r.id;
    const sm = document.createElement("small");
    sm.textContent = r.id + " · " + themeLabel(r.theme);
    meta.append(b, sm);
    const actions = document.createElement("div");
    actions.className = "card-actions";
    const mk = (cls, text, fn) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = text;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        fn();
      });
      return btn;
    };
    actions.append(
      mk("btn", "编辑", () => { location.href = "/admin/e/" + encodeURIComponent(r.id); }),
      mk("btn ghost", "分享", () => openShareFor(r.id)),
      mk("btn ghost", "导出", () => exportResume(r.id)),
      mk("btn danger", "删除", () => deleteResume(r.id))
    );
    card.append(thumb, meta, actions);
    card.addEventListener("click", () => { location.href = "/admin/e/" + encodeURIComponent(r.id); });
    box.append(card);
  }
  const neu = document.createElement("button");
  neu.type = "button";
  neu.className = "card-new";
  neu.textContent = "+ 新建";
  neu.addEventListener("click", createResume);
  box.append(neu);
  requestAnimationFrame(scaleThumbs);
  fillResumeSelect();
  updateSharePreview();
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

function fillExpiry(share) {
  if (!share || share.expiresAt == null) {
    $("ttl").value = "never";
    $("ttlCustom").value = "";
    return;
  }
  const sec = Math.max(0, Math.floor((Number(share.expiresAt) - Date.now()) / 1000));
  $("ttl").value = "custom";
  $("ttlCustom").value = String(sec);
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
  $("shareHint").textContent = mode === "edit" ? "保存走 PATCH，token / URL 不变。" : "生成会发新 token。";
  $("shareErr").textContent = "";
  if (mode === "create") {
    editToken = "";
    $("editToken").textContent = "";
    $("sharePw").value = "";
    $("clearPw").value = "no";
    $("label").value = "";
    $("shareOut").textContent = "";
    $("ttl").value = "604800";
    $("ttlCustom").value = "";
    return;
  }
  if (share) {
    editToken = share.token;
    $("editToken").textContent = location.origin + share.url;
    $("resumeId").value = share.resumeId;
    $("theme").value = share.theme || share.presentation?.theme || "";
    if ($("layout") && (share.layout || share.presentation?.layout)) $("layout").value = share.layout || share.presentation.layout;
    $("label").value = share.label || "";
    $("sharePw").value = "";
    $("clearPw").value = "no";
    fillExpiry(share);
  }
  updateSharePreview();
}

function openShareFor(resumeId) {
  setBench("shares");
  setShareMode("create");
  if (resumeId) $("resumeId").value = resumeId;
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
      s.theme ? themeLabel(s.theme) : "沿用主题",
      s.orientation && s.orientation !== "inherit" ? (s.orientation === "landscape" ? "横版" : "竖版") : "沿用方向",
      s.resumeMissing ? "来源简历已删除" : "",
      s.hasPassword ? "有密码" : "无密码",
      s.revoked ? "已撤销" : remain(s.expiresAt),
    ].filter(Boolean).join(" · ");
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
      setShareMode("edit", s);
    });
    const rev = document.createElement("button");
    rev.type = "button";
    rev.className = "btn danger";
    rev.textContent = "撤销";
    rev.disabled = !!s.revoked;
    rev.addEventListener("click", async () => {
      try {
        await api("/api/shares/" + s.token, { method: "DELETE" });
        toast("已撤销");
        await drawShares();
      } catch (e) {
        $("shareErr").textContent = e.message;
      }
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
  drawCards();
}

async function createResume() {
  $("workErr").textContent = "";
  try {
    const doc = await api("/api/resumes", { method: "POST", body: JSON.stringify(blank()) });
    toast("已新建");
    location.href = "/admin/e/" + encodeURIComponent(doc.id);
  } catch (e) {
    $("workErr").textContent = e.message;
  }
}

async function exportResume(id) {
  $("workErr").textContent = "";
  try {
    const doc = await api("/api/resumes/" + encodeURIComponent(id));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" }));
    a.download = id + ".json";
    a.click();
    toast("已导出");
  } catch (e) {
    $("workErr").textContent = e.message;
  }
}

async function deleteResume(id) {
  $("workErr").textContent = "";
  if (!confirm("删除 " + id + "？分享不会一起删。")) return;
  try {
    await api("/api/resumes/" + encodeURIComponent(id), { method: "DELETE" });
    toast("已删除");
    await refreshList();
  } catch (e) {
    $("workErr").textContent = e.message;
  }
}

function setBench(name) {
  $("benchResumes").classList.toggle("hidden", name !== "resumes");
  $("benchShares").classList.toggle("hidden", name !== "shares");
  $("tabResumes").classList.toggle("on", name === "resumes");
  $("tabShares").classList.toggle("on", name === "shares");
  if (name === "shares") requestAnimationFrame(() => { updateSharePreview(); scaleThumbs(); });
}

async function boot() {
  must("newBtn");
  must("importBtn");
  must("shareBtn");
  must("tabResumes");
  $("tabResumes").onclick = () => setBench("resumes");
  $("tabShares").onclick = () => setBench("shares");
  $("resumeId").addEventListener("change", updateSharePreview);
  $("theme").addEventListener("change", updateSharePreview);
  $("layout").addEventListener("change", updateSharePreview);
  if ($("orientation")) $("orientation").addEventListener("change", updateSharePreview);
  $("modeCreate").onclick = () => setShareMode("create");
  $("modeEdit").onclick = () => setShareMode("edit");
  $("newBtn").onclick = createResume;
  $("importBtn").onclick = () => $("importFile").click();
  $("importFile").onchange = async () => {
    $("workErr").textContent = "";
    const f = $("importFile").files?.[0];
    if (!f) return;
    try {
      const raw = JSON.parse(await f.text());
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("坏 JSON");
      const doc = await api("/api/resumes", { method: "POST", body: JSON.stringify(raw) });
      toast("已导入");
      location.href = "/admin/e/" + encodeURIComponent(doc.id);
    } catch (e) {
      $("workErr").textContent = e.message;
    }
  };
  $("shareBtn").onclick = async () => {
    $("shareErr").textContent = "";
    try {
      if (!list.length) throw new Error("先新建并保存一份简历");
      const resumeId = $("resumeId").value;
      if (!resumeId) throw new Error("选一份简历");
      const body = { resumeId, theme: $("theme").value, layout: $("layout").value, orientation: $("orientation")?.value, label: $("label").value, ...expiryBody() };
      if (shareMode === "create") {
        if ($("sharePw").value) body.password = $("sharePw").value;
        const s = await api("/api/shares", { method: "POST", body: JSON.stringify(body) });
        const url = location.origin + s.url;
        $("shareOut").textContent = url;
        await navigator.clipboard.writeText(url).catch(() => {});
        $("sharePw").value = "";
        toast("已生成并复制");
      } else {
        if (!editToken) throw new Error("从下方列表点「修改」");
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
  window.addEventListener("resize", scaleThumbs);
  fillSelect($("theme"), [{ id: "inherit", label: "沿用简历主题" }, ...THEMES]);
  await refreshList();
  await drawShares();
  const q = new URLSearchParams(location.search);
  if (q.get("tab") === "shares") {
    openShareFor(q.get("resumeId") || "");
  } else {
    setShareMode("create");
  }
}

try {
  await boot();
} catch (e) {
  const el = $("workErr") || $("status");
  if (el) {
    el.textContent = "脚本绑定失败：" + e.message;
    el.classList?.add("on");
  }
}
