export function themeContract(id, tokens) {
  return {
    colors: {
      primary: tokens.primaryColor,
      accent: tokens.accentColor,
      muted: tokens.mutedColor,
      background: tokens.background,
      page: tokens.page,
      border: tokens.borderColor,
    },
    typography: {
      fontFamily: tokens.fontFamily,
      headingFont: tokens.headingFont,
      fontSize: tokens.fontSize,
      lineHeight: tokens.lineHeight,
    },
    shape: { radius: tokens.radius },
  };
}
