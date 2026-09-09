const PRESETS = {
  a4: { id: "a4", widthPortrait: 210, heightPortrait: 297 },
};

export function resolveCanvas(presentation = {}, options = {}) {
  const preset = PRESETS[options.preset || "a4"] || PRESETS.a4;
  const orientation = presentation.orientation === "landscape" ? "landscape" : "portrait";
  const widthMm = orientation === "landscape" ? preset.heightPortrait : preset.widthPortrait;
  const heightMm = orientation === "landscape" ? preset.widthPortrait : preset.heightPortrait;
  return {
    id: preset.id,
    orientation,
    widthMm,
    heightMm,
    pageSize: orientation === "landscape" ? "A4 landscape" : "A4 portrait",
    aspect: `${widthMm} / ${heightMm}`,
    designWidth: 820,
    strategy: "scale",
  };
}

export { PRESETS as CANVAS_PRESETS };
