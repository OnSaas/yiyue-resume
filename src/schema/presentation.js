export const LAYOUTS = ["classic", "sidebar", "two-column", "compact"];
export const LAYOUT_VARIANTS = {
  classic: [""],
  sidebar: ["left", "left-wide", "left-narrow", "right"],
  "two-column": [""],
  compact: [""],
};
export const THEMES = ["paper", "ink", "night", "plain"];
export const ORIENTATIONS = ["portrait", "landscape"];

export function emptyPresentation() {
  return {
    layout: "classic",
    layoutVariant: "",
    theme: "paper",
    themeOverrides: {},
    orientation: "portrait",
  };
}

function inheritToken(v) {
  return v === null || v === undefined || v === "" || v === "inherit";
}

export function normalizePresentation(raw) {
  const p = raw && typeof raw === "object" ? raw : {};
  const layout = LAYOUTS.includes(p.layout) ? p.layout : "classic";
  const allowed = LAYOUT_VARIANTS[layout] || [""];
  const layoutVariant = allowed.includes(p.layoutVariant) ? p.layoutVariant : allowed[0] || "";
  const theme = THEMES.includes(p.theme) ? p.theme : "paper";
  const orientation = ORIENTATIONS.includes(p.orientation) ? p.orientation : "portrait";
  const overrides = p.themeOverrides && typeof p.themeOverrides === "object" ? p.themeOverrides : {};
  const themeOverrides = {};
  for (const k of ["accentColor", "fontSize", "radius", "fontFamily", "primaryColor"]) {
    if (overrides[k] != null && overrides[k] !== "") themeOverrides[k] = String(overrides[k]).slice(0, 80);
  }
  return { layout, layoutVariant, theme, themeOverrides, orientation };
}

/** override 里 inherit/null/"" 表示沿用 resume 的 presentation */
export function resolvePresentation(resumePres, override) {
  const base = normalizePresentation(resumePres);
  const o = override && typeof override === "object" ? override : {};
  const next = { ...base };
  if (!inheritToken(o.layout) && LAYOUTS.includes(o.layout)) next.layout = o.layout;
  const allowed = LAYOUT_VARIANTS[next.layout] || [""];
  if (!inheritToken(o.layoutVariant) && allowed.includes(o.layoutVariant)) next.layoutVariant = o.layoutVariant;
  else if (!allowed.includes(next.layoutVariant)) next.layoutVariant = allowed[0] || "";
  if (!inheritToken(o.theme) && THEMES.includes(o.theme)) next.theme = o.theme;
  if (!inheritToken(o.orientation) && ORIENTATIONS.includes(o.orientation)) next.orientation = o.orientation;
  if (o.themeOverrides && typeof o.themeOverrides === "object") {
    next.themeOverrides = { ...next.themeOverrides, ...o.themeOverrides };
  }
  return normalizePresentation(next);
}
