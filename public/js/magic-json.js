/* Magic Resume JSON 兼容层
 * 字段对齐 JOYCEQL/magic-resume src/types/resume.ts（Apache-2.0）
 * 额外字段：slug, isPublic（对外路径，魔方没有）
 */

export const DEFAULT_PHOTO = {
  width: 90,
  height: 120,
  aspectRatio: "1:1",
  borderRadius: "none",
  customBorderRadius: 0,
  visible: true,
};

export const DEFAULT_FIELD_ORDER = [
  { id: "1", key: "name", label: "姓名", type: "text", visible: true },
  { id: "2", key: "title", label: "职位", type: "text", visible: true },
  { id: "3", key: "employementStatus", label: "状态", type: "text", visible: true },
  { id: "4", key: "birthDate", label: "生日", type: "date", visible: true },
  { id: "5", key: "email", label: "邮箱", type: "text", visible: true },
  { id: "6", key: "phone", label: "电话", type: "text", visible: true },
  { id: "7", key: "location", label: "所在地", type: "text", visible: true },
];

export const DEFAULT_GLOBAL = {
  baseFontSize: 16,
  pagePadding: 32,
  paragraphSpacing: 12,
  lineHeight: 1.5,
  sectionSpacing: 10,
  headerSize: 18,
  subheaderSize: 16,
  useIconMode: true,
  themeColor: "#8c2f1b",
  centerSubtitle: true,
  pageBreakLinesVisible: true,
  fontFamily: undefined,
  autoOnePage: false,
  flexibleHeaderLayout: false,
};

export const STANDARD_SECTIONS = [
  { id: "basic", title: "基本信息", icon: "👤", enabled: true, order: 0 },
  { id: "skills", title: "专业技能", icon: "⚡", enabled: true, order: 1 },
  { id: "experience", title: "工作经验", icon: "💼", enabled: true, order: 2 },
  { id: "projects", title: "项目经历", icon: "🚀", enabled: true, order: 3 },
  { id: "education", title: "教育经历", icon: "🎓", enabled: true, order: 4 },
  { id: "selfEvaluation", title: "自我评价", icon: "💬", enabled: false, order: 5 },
  { id: "certificates", title: "证书", icon: "🏆", enabled: false, order: 6 },
];

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
}

function str(v) {
  return v == null ? "" : String(v);
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

export function emptyResume(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: uid(),
    title: "未命名",
    createdAt: now,
    updatedAt: now,
    templateId: "paper",
    slug: "",
    isPublic: false,
    basic: {
      birthDate: "",
      name: "楚扉月",
      title: "",
      email: "",
      phone: "",
      location: "",
      icons: {
        email: "Mail",
        phone: "Phone",
        birthDate: "CalendarRange",
        employementStatus: "Briefcase",
        location: "MapPin",
      },
      employementStatus: "",
      photo: "",
      photoConfig: { ...DEFAULT_PHOTO, visible: false },
      fieldOrder: JSON.parse(JSON.stringify(DEFAULT_FIELD_ORDER)),
      customFields: [],
      githubKey: "",
      githubUseName: "",
      githubContributionsVisible: false,
      layout: "left",
    },
    education: [],
    experience: [],
    projects: [],
    certificates: [],
    customData: {},
    skillContent: "",
    selfEvaluationContent: "",
    activeSection: "basic",
    draggingProjectId: null,
    menuSections: JSON.parse(JSON.stringify(STANDARD_SECTIONS)),
    globalSettings: { ...DEFAULT_GLOBAL },
    ...overrides,
  };
}

function htmlFromLines(v) {
  if (Array.isArray(v)) {
    const items = v.map(str).filter(Boolean);
    return items.length ? `<ul>${items.map((x) => `<li>${escapeText(x)}</li>`).join("")}</ul>` : "";
  }
  return str(v);
}

function escapeText(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function normalizeMagic(raw) {
  if (!raw || typeof raw !== "object") return emptyResume();
  const base = emptyResume();
  const basicIn = raw.basic && typeof raw.basic === "object" ? raw.basic : {};
  const education = arr(raw.education).map((e, i) => ({
    id: str(e.id) || uid(),
    school: str(e.school),
    major: str(e.major),
    degree: str(e.degree),
    startDate: str(e.startDate),
    endDate: str(e.endDate),
    gpa: str(e.gpa),
    description: htmlFromLines(e.description),
    visible: e.visible !== false,
  }));
  const experience = arr(raw.experience).map((e) => ({
    id: str(e.id) || uid(),
    company: str(e.company),
    position: str(e.position),
    date: str(e.date),
    details: htmlFromLines(e.details),
    visible: e.visible !== false,
  }));
  const projects = arr(raw.projects).map((p) => ({
    id: str(p.id) || uid(),
    name: str(p.name),
    role: str(p.role),
    date: str(p.date),
    description: htmlFromLines(p.description),
    visible: p.visible !== false,
    link: str(p.link),
    linkLabel: str(p.linkLabel),
  }));
  const certificates = arr(raw.certificates).map((c) => ({
    id: str(c.id) || uid(),
    url: str(c.url),
    width: Number(c.width) || 30,
  }));

  let skillContent = str(raw.skillContent);
  if (!skillContent && Array.isArray(raw.skills) && raw.skills.length) {
    skillContent = `<ul>${raw.skills.map((s) => `<li>${escapeText(str(s))}</li>`).join("")}</ul>`;
  }

  const customData = raw.customData && typeof raw.customData === "object" ? raw.customData : {};
  const cleanedCustom = {};
  for (const [k, items] of Object.entries(customData)) {
    cleanedCustom[k] = arr(items).map((it) => ({
      id: str(it.id) || uid(),
      title: str(it.title),
      subtitle: str(it.subtitle),
      dateRange: str(it.dateRange),
      description: htmlFromLines(it.description),
      visible: it.visible !== false,
    }));
  }

  let menuSections = arr(raw.menuSections);
  if (!menuSections.length) menuSections = STANDARD_SECTIONS;
  menuSections = menuSections.map((s, i) => ({
    id: str(s.id) || `sec-${i}`,
    title: str(s.title) || s.id,
    icon: str(s.icon) || "📄",
    enabled: s.enabled !== false,
    order: Number.isFinite(s.order) ? s.order : i,
  }));

  return {
    ...base,
    ...raw,
    id: str(raw.id) || base.id,
    title: str(raw.title) || "未命名",
    createdAt: str(raw.createdAt) || base.createdAt,
    updatedAt: str(raw.updatedAt) || base.updatedAt,
    templateId: raw.templateId == null ? "paper" : raw.templateId,
    slug: str(raw.slug),
    isPublic: !!raw.isPublic,
    basic: {
      ...base.basic,
      ...basicIn,
      name: str(basicIn.name) || base.basic.name,
      title: str(basicIn.title),
      email: str(basicIn.email),
      phone: str(basicIn.phone),
      location: str(basicIn.location),
      birthDate: str(basicIn.birthDate),
      employementStatus: str(basicIn.employementStatus),
      photo: str(basicIn.photo),
      githubKey: str(basicIn.githubKey),
      githubUseName: str(basicIn.githubUseName),
      githubContributionsVisible: !!basicIn.githubContributionsVisible,
      layout: basicIn.layout === "center" || basicIn.layout === "right" ? basicIn.layout : "left",
      customFields: arr(basicIn.customFields).map((f) => ({
        id: str(f.id) || uid(),
        label: str(f.label),
        value: str(f.value),
        icon: str(f.icon),
        visible: f.visible !== false,
        custom: f.custom !== false,
        displayLabel: !!f.displayLabel,
      })),
      photoConfig: { ...DEFAULT_PHOTO, ...(basicIn.photoConfig || {}) },
      fieldOrder: arr(basicIn.fieldOrder).length
        ? basicIn.fieldOrder
        : base.basic.fieldOrder,
      icons: { ...base.basic.icons, ...(basicIn.icons || {}) },
    },
    education,
    experience,
    projects,
    certificates,
    customData: cleanedCustom,
    skillContent,
    selfEvaluationContent: str(raw.selfEvaluationContent),
    activeSection: str(raw.activeSection) || "basic",
    draggingProjectId: null,
    menuSections,
    globalSettings: { ...DEFAULT_GLOBAL, ...(raw.globalSettings || {}) },
  };
}

const ALLOWED = new Set(["UL", "OL", "LI", "P", "BR", "STRONG", "B", "EM", "I", "A", "DIV", "SPAN", "H3", "H4"]);

export function sanitizeHtml(html) {
  if (!html) return "";
  if (typeof document === "undefined") return String(html);
  const t = document.createElement("template");
  t.innerHTML = html;
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === 1) {
        if (!ALLOWED.has(child.tagName)) {
          const parent = child.parentNode;
          while (child.firstChild) parent.insertBefore(child.firstChild, child);
          parent.removeChild(child);
          return;
        }
        [...child.attributes].forEach((a) => {
          const n = a.name.toLowerCase();
          if (n.startsWith("on") || n === "style") child.removeAttribute(a.name);
          if (child.tagName === "A" && n === "href") {
            const href = child.getAttribute("href") || "";
            if (!/^(https?:|mailto:|\/)/i.test(href)) child.removeAttribute("href");
          } else if (n !== "href" && n !== "class") {
            child.removeAttribute(a.name);
          }
        });
        walk(child);
      } else if (child.nodeType === 8) {
        child.remove();
      }
    });
  };
  walk(t.content);
  return t.innerHTML;
}

export function toMagicExport(doc) {
  const d = normalizeMagic(doc);
  const { slug, isPublic, ...rest } = d;
  return { ...rest, slug, isPublic };
}
