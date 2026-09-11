import { esc, safeHref } from "../utils/html.js";
import { resolveTheme } from "./registry/themes.js";
import { resolveLayout } from "./registry/layouts.js";
import { renderSection } from "./registry/sections.js";
import { normalizePresentation } from "../schema/presentation.js";
import { resolveCanvas } from "../domain/canvas.js";
import { PRODUCT } from "../config/product.js";

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
    <div class="identity">
      ${b.avatar ? `<img class="avatar" src="${esc(b.avatar)}" alt="">` : ""}
      <div>
      <h1 class="name">${esc(b.name || "")}</h1>
      ${b.nameEn ? `<p class="name-en">${esc(b.nameEn)}</p>` : ""}
      ${b.headline ? `<p class="job-title">${esc(b.headline)}</p>` : ""}
      ${b.summary ? `<p class="tagline">${esc(b.summary)}</p>` : ""}
      </div>
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
  const canvas = resolveCanvas(presentation);
  const theme = resolveTheme(presentation);
  const layout = resolveLayout(presentation);
  const cols = (layout.columns || [])
    .map((c) => {
      const inner = (c.children || []).map((id) => renderSection(id, resume, presentation)).join("");
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
  const ori = canvas.orientation;
  const sheet = `<article class="sheet layout-${esc(layout.id)}${compact}" data-layout="${esc(layout.id)}" data-layout-variant="${esc(layout.layoutVariant || "")}" data-orientation="${ori}">
    ${head}
    <div class="body cols">${cols}</div>
    ${note}
  </article>`;
  const canvasHtml = `<div class="stage"><div class="canvas" data-orientation="${ori}" data-canvas="${esc(canvas.id)}" data-aw="${canvas.widthMm}" data-ah="${canvas.heightMm}" data-design="${canvas.designWidth}" data-lmax="${canvas.landscapeMaxPx || 1100}" style="aspect-ratio:${canvas.aspect}">${sheet}</div></div>
<script>
(function(){
  var c=document.querySelector(".canvas"); if(!c) return;
  var s=c.querySelector(".sheet"); if(!s) return;
  function fit(){
    var aw=Number(c.getAttribute("data-aw"))||210;
    var ah=Number(c.getAttribute("data-ah"))||297;
    var design=Number(c.getAttribute("data-design"))||820;
    var lmax=Number(c.getAttribute("data-lmax"))||1100;
    var ori=c.getAttribute("data-orientation");
    var max=Math.min((c.parentElement&&c.parentElement.clientWidth||window.innerWidth)-24, ori==="landscape"?lmax:design);
    if(max<160) max=160;
    c.style.width=max+"px";
    c.style.height=(max*ah/aw)+"px";
    var scale=max/design;
    s.style.width=design+"px";
    s.style.transformOrigin="top left";
    s.style.transform="scale("+scale+")";
  }
  fit();
  addEventListener("resize", fit);
})();
</script>`;
  if (context.fragment) {
    return `<div class="page" data-theme="${esc(presentation.theme)}" data-orientation="${ori}" style="${vars};font-size:${theme.fontSize}px;line-height:${theme.lineHeight}">${canvasHtml}</div>`;
  }
  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="${esc(presentation.theme)}" data-orientation="${ori}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(resume.basics?.headline || resume.basics?.summary || title)}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:site_name" content="${esc(PRODUCT.name)}" />
  <meta property="og:type" content="profile" />
  <link rel="stylesheet" href="/css/resume.css" />
  <style>@page { size: ${canvas.pageSizeCss || canvas.pageSize}; margin: 12mm; }</style>
</head>
<body class="page" style="${vars}">
  ${canvasHtml}
</body>
</html>`;
}

export { THEME_LIST } from "./registry/themes.js";
export { LAYOUT_LIST } from "./registry/layouts.js";
