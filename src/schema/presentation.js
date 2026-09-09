export const LAYOUTS = ["classic", "sidebar", "two-column", "compact"];
export const LAYOUT_VARIANTS = {
  classic: [""],
  sidebar: ["left", "left-wide", "left-narrow", "right"],
  "two-column": [""],
  compact: [""],
};
export const THEMES = ["paper", "ink", "night", "plain"];

export function emptyPresentation() {
  return {
    layout: "classic",
    layoutVariant: "",
    theme: "paper",
    themeOverrides: {},
  };
}

export function normalizePresentation(raw) {
  const p = raw && typeof raw === "object" ? raw : {};
  const layout = LAYOUTS.includes(p.layout) ? p.layout : "classic";
  const allowed = LAYOUT_VARIANTS[layout] || [""];
  const layoutVariant = allowed.includes(p.layoutVariant) ? p.layoutVariant : allowed[0] || "";
  const theme = THEMES.includes(p.theme) ? p.theme : "paper";
  const overrides = p.themeOverrides && typeof p.themeOverrides === "object" ? p.themeOverrides : {};
  const themeOverrides = {};
  for (const k of ["accentColor", "fontSize", "radius", "fontFamily", "primaryColor"]) {
    if (overrides[k] != null && overrides[k] !== "") themeOverrides[k] = String(overrides[k]).slice(0, 80);
  }
  return { layout, layoutVariant, theme, themeOverrides };
}
