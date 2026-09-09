export const PAGE_SIZES = {
  a4: {
    id: "a4",
    name: "A4",
    portrait: [210, 297],
    landscape: [297, 210],
    designWidth: 820,
    landscapeMaxPx: 1100,
  },
};

export const DEFAULT_PAGE_SIZE = "a4";

export function pageBox(pageSize = DEFAULT_PAGE_SIZE, orientation = "portrait") {
  const p = PAGE_SIZES[pageSize] || PAGE_SIZES.a4;
  const ori = orientation === "landscape" ? "landscape" : "portrait";
  const [widthMm, heightMm] = ori === "landscape" ? p.landscape : p.portrait;
  return {
    id: p.id,
    name: p.name,
    orientation: ori,
    widthMm,
    heightMm,
    designWidth: p.designWidth,
    landscapeMaxPx: p.landscapeMaxPx,
    pageSizeCss: ori === "landscape" ? `${p.name} landscape` : `${p.name} portrait`,
    aspect: `${widthMm} / ${heightMm}`,
  };
}
