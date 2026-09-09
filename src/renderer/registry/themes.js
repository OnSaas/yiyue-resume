export const THEME_TOKENS = {
  paper: {
    fontFamily: '"PingFang SC","Hiragino Sans GB","Noto Sans SC","Microsoft YaHei",sans-serif',
    headingFont: '"Songti SC","Noto Serif SC","STSong",serif',
    fontSize: 15,
    lineHeight: 1.55,
    primaryColor: "#1a1612",
    accentColor: "#8c2f1b",
    mutedColor: "#6b6258",
    borderColor: "#d8d0c4",
    background: "#f4efe6",
    page: "#e7e0d4",
    radius: 0,
  },
  ink: {
    fontFamily: '"PingFang SC","Hiragino Sans GB","Noto Sans SC",sans-serif',
    headingFont: "Georgia,serif",
    fontSize: 15,
    lineHeight: 1.5,
    primaryColor: "#111",
    accentColor: "#111",
    mutedColor: "#444",
    borderColor: "#bbb",
    background: "#fafafa",
    page: "#ececec",
    radius: 0,
  },
  night: {
    fontFamily: '"PingFang SC","Hiragino Sans GB","Noto Sans SC",sans-serif',
    headingFont: '"Songti SC",serif',
    fontSize: 15,
    lineHeight: 1.55,
    primaryColor: "#f3ece3",
    accentColor: "#d4a574",
    mutedColor: "#b5a89a",
    borderColor: "#3a342e",
    background: "#1c1916",
    page: "#12100e",
    radius: 0,
  },
  plain: {
    fontFamily: "system-ui,sans-serif",
    headingFont: "system-ui,sans-serif",
    fontSize: 14,
    lineHeight: 1.45,
    primaryColor: "#222",
    accentColor: "#333",
    mutedColor: "#555",
    borderColor: "#ddd",
    background: "#fff",
    page: "#f5f5f5",
    radius: 0,
  },
};

export function resolveTheme(presentation) {
  const base = { ...(THEME_TOKENS[presentation.theme] || THEME_TOKENS.paper) };
  const o = presentation.themeOverrides || {};
  if (o.accentColor) base.accentColor = o.accentColor;
  if (o.primaryColor) base.primaryColor = o.primaryColor;
  if (o.fontFamily) base.fontFamily = o.fontFamily;
  if (o.fontSize) base.fontSize = Number(o.fontSize) || base.fontSize;
  if (o.radius != null && o.radius !== "") base.radius = Number(o.radius) || 0;
  return base;
}

export function themeTokens(id) {
  const t = THEME_TOKENS[id] || THEME_TOKENS.paper;
  return {
    colors: { primary: t.primaryColor, accent: t.accentColor, muted: t.mutedColor, background: t.background, page: t.page, border: t.borderColor },
    typography: { fontFamily: t.fontFamily, headingFont: t.headingFont, fontSize: t.fontSize, lineHeight: t.lineHeight },
    shape: { radius: t.radius },
  };
}

export const THEME_LIST = Object.keys(THEME_TOKENS).map((id) => ({ id, label: { paper: "米纸", ink: "印刷", night: "深色", plain: "近白" }[id] || id }));
