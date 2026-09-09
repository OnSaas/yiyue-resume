import { LAYOUT_VERSION } from "../../config/defaults.js";

const SUPPORTS = { portrait: true, landscape: true, mobileScale: true, print: true };

export const LAYOUT_LIST = [
  { id: "classic", name: "Classic", label: "Classic", description: "主栏经历 + 侧栏联系技能", version: LAYOUT_VERSION, variants: [], supports: SUPPORTS, preview: null },
  { id: "sidebar", name: "Sidebar", label: "Sidebar", description: "信息侧栏 + 主内容", version: LAYOUT_VERSION, variants: ["left", "left-wide", "left-narrow", "right"], supports: SUPPORTS, preview: null },
  { id: "two-column", name: "Two Column", label: "Two Column", description: "双等分栏", version: LAYOUT_VERSION, variants: [], supports: SUPPORTS, preview: null },
  { id: "compact", name: "Compact", label: "Compact", description: "紧凑间距", version: LAYOUT_VERSION, variants: [], supports: SUPPORTS, preview: null },
];

export const LAYOUT_DEFS = {
  classic: {
    compact: false,
    header: "full",
    supports: SUPPORTS,
    columns: [
      { width: 70, children: ["experience", "projects", "education", "awards", "publications", "custom"] },
      { width: 30, children: ["contact", "skills", "languages", "certifications"] },
    ],
    landscape: { widths: [62, 38] },
  },
  compact: {
    compact: true,
    header: "full",
    supports: SUPPORTS,
    columns: [
      { width: 72, children: ["experience", "projects", "education", "custom"] },
      { width: 28, children: ["contact", "skills"] },
    ],
    landscape: { widths: [64, 36] },
  },
  "two-column": {
    compact: false,
    header: "full",
    supports: SUPPORTS,
    columns: [
      { width: 50, children: ["experience", "projects"] },
      { width: 50, children: ["skills", "education", "contact", "custom"] },
    ],
  },
  sidebar: {
    compact: false,
    header: "none",
    supports: SUPPORTS,
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

function applyOrientation(columns, def, presentation) {
  if (presentation.orientation !== "landscape" || !def.landscape?.widths || !columns) return columns;
  return columns.map((c, i) => ({ ...c, width: def.landscape.widths[i] ?? c.width }));
}

export function resolveLayout(presentation) {
  const id = presentation.layout || "classic";
  const def = LAYOUT_DEFS[id] || LAYOUT_DEFS.classic;
  let columns = def.columns;
  let layoutVariant = "";
  if (def.variants) {
    const v = presentation.layoutVariant && def.variants[presentation.layoutVariant] ? presentation.layoutVariant : "left";
    columns = def.variants[v];
    layoutVariant = v;
  }
  columns = applyOrientation(columns, def, presentation);
  return { id, compact: !!def.compact, header: def.header || "full", layoutVariant, columns, supports: def.supports, version: LAYOUT_VERSION };
}

export function layoutMetadata() {
  return LAYOUT_LIST.map((l) => ({
    id: l.id,
    name: l.name,
    description: l.description,
    version: l.version,
    variants: l.variants,
    supports: l.supports,
    preview: l.preview,
  }));
}
