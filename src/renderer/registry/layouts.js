export const LAYOUT_LIST = [
  { id: "classic", label: "Classic" },
  { id: "sidebar", label: "Sidebar" },
  { id: "two-column", label: "Two Column" },
  { id: "compact", label: "Compact" },
];

export const LAYOUT_DEFS = {
  classic: {
    compact: false,
    header: "full",
    supports: { portrait: true, landscape: true, mobileScale: true, print: true },
    columns: [
      { width: 70, children: ["experience", "projects", "education", "awards", "publications", "custom"] },
      { width: 30, children: ["contact", "skills", "languages", "certifications"] },
    ],
  },
  compact: {
    compact: true,
    header: "full",
    supports: { portrait: true, landscape: true, mobileScale: true, print: true },
    columns: [
      { width: 72, children: ["experience", "projects", "education", "custom"] },
      { width: 28, children: ["contact", "skills"] },
    ],
  },
  "two-column": {
    compact: false,
    header: "full",
    supports: { portrait: true, landscape: true, mobileScale: true, print: true },
    columns: [
      { width: 50, children: ["experience", "projects"] },
      { width: 50, children: ["skills", "education", "contact", "custom"] },
    ],
  },
  sidebar: {
    compact: false,
    header: "none",
    supports: { portrait: true, landscape: true, mobileScale: true, print: true },
    variants: {
      left: [
        { width: 32, children: ["profile", "contact", "skills", "languages"] },
        { width: 68, children: ["experience", "projects", "education", "awards", "publications", "custom"] },
      ],
      "left-wide": [
        { width: 40, children: ["profile", "contact", "skills"] },
        { width: 60, children: ["experience", "projects", "education", "custom"] },
      ],
      "left-narrow": [
        { width: 26, children: ["profile", "contact", "skills"] },
        { width: 74, children: ["experience", "projects", "education", "custom"] },
      ],
      right: [
        { width: 68, children: ["experience", "projects", "education", "awards", "publications", "custom"] },
        { width: 32, children: ["profile", "contact", "skills"] },
      ],
    },
  },
};

export function resolveLayout(presentation) {
  const id = presentation.layout || "classic";
  const def = LAYOUT_DEFS[id] || LAYOUT_DEFS.classic;
  let columns = def.columns;
  if (def.variants) {
    const v = presentation.layoutVariant && def.variants[presentation.layoutVariant]
      ? presentation.layoutVariant
      : "left";
    columns = def.variants[v];
    return { id, compact: !!def.compact, header: def.header, layoutVariant: v, columns, supports: def.supports };
  }
  return { id, compact: !!def.compact, header: def.header || "full", layoutVariant: "", columns, supports: def.supports };
}
