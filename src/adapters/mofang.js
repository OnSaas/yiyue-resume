import { emptyCanonical, sanitizeCanonical } from "../schema/resume.js";
import { htmlToPoints, stripHtml } from "../utils/html.js";

function str(v) {
  return v == null ? "" : String(v);
}

function visible(x) {
  return x && x.visible !== false;
}

export function isMofang(raw) {
  return !!(raw && typeof raw === "object" && raw.basic && typeof raw.basic === "object");
}

export function fromMofang(raw) {
  if (!isMofang(raw)) throw new Error("不是魔方简历 JSON");
  const b = raw.basic || {};
  const out = emptyCanonical();
  out.basics.name = str(b.name);
  out.basics.headline = str(b.title);
  out.basics.email = str(b.email);
  out.basics.phone = str(b.phone);
  out.basics.location = str(b.location);
  out.basics.avatar = str(b.photo);
  out.basics.birthDate = str(b.birthDate);
  out.basics.employmentStatus = str(b.employementStatus);
  out.basics.summary = htmlToPoints(raw.selfEvaluationContent).join(" ");

  const custom = Array.isArray(b.customFields) ? b.customFields : [];
  for (const f of custom) {
    if (f.visible === false) continue;
    const href = str(f.value);
    const label = str(f.label) || href;
    if (label) out.links.push({ label, href });
  }

  out.experience = (Array.isArray(raw.experience) ? raw.experience : [])
    .filter(visible)
    .map((e) => ({
      org: str(e.company),
      role: str(e.position),
      time: str(e.date),
      points: htmlToPoints(e.details),
    }));

  out.education = (Array.isArray(raw.education) ? raw.education : [])
    .filter(visible)
    .map((e) => ({
      school: str(e.school),
      major: str(e.major),
      degree: str(e.degree),
      time: [str(e.startDate), str(e.endDate)].filter(Boolean).join(" – "),
      points: htmlToPoints(e.description),
    }));

  out.projects = (Array.isArray(raw.projects) ? raw.projects : [])
    .filter(visible)
    .map((p) => ({
      name: str(p.name),
      role: str(p.role),
      time: str(p.date),
      url: str(p.link),
      points: htmlToPoints(p.description),
    }));

  if (Array.isArray(raw.skills) && raw.skills.length && typeof raw.skills[0] === "string") {
    out.skills = raw.skills.map(str).filter(Boolean);
  } else {
    out.skills = htmlToPoints(raw.skillContent);
  }

  const certs = Array.isArray(raw.certificates) ? raw.certificates : [];
  if (certs.length) {
    out.certifications = certs.map((c) => str(c.name || c.url || "证书")).filter(Boolean);
  }

  const customData = raw.customData && typeof raw.customData === "object" ? raw.customData : {};
  const menus = Array.isArray(raw.menuSections) ? raw.menuSections : [];
  const known = new Set(["basic", "skills", "experience", "projects", "education", "selfEvaluation", "certificates"]);
  for (const m of menus) {
    if (!m || known.has(m.id) || m.enabled === false) continue;
    const items = Array.isArray(customData[m.id]) ? customData[m.id].filter(visible) : [];
    out.customSections.push({
      id: str(m.id),
      title: str(m.title) || str(m.id),
      items: items.map((it) => ({
        org: str(it.subtitle),
        role: str(it.title),
        time: str(it.dateRange),
        points: htmlToPoints(it.description),
      })),
    });
  }

  out.extras = {
    mofang: {
      title: raw.title,
      basic: {
        photoConfig: b.photoConfig,
        fieldOrder: b.fieldOrder,
        icons: b.icons,
        customFields: b.customFields,
        layout: b.layout,
        githubKey: b.githubKey,
        githubUseName: b.githubUseName,
        githubContributionsVisible: b.githubContributionsVisible,
      },
      menuSections: raw.menuSections,
      globalSettings: raw.globalSettings,
      certificates: raw.certificates,
      skillContent: raw.skillContent,
      selfEvaluationContent: raw.selfEvaluationContent,
      templateId: raw.templateId,
    },
  };
  return sanitizeCanonical(out);
}

function pointsToHtml(points) {
  const pts = (points || []).filter(Boolean);
  if (!pts.length) return "";
  return `<ul>${pts.map((p) => `<li>${String(p).replace(/</g, "&lt;")}</li>`).join("")}</ul>`;
}

export function toMofang(canonical) {
  const c = canonical || emptyCanonical();
  const extra = (c.extras && c.extras.mofang) || {};
  const b = c.basics || {};
  const basicExtra = extra.basic || {};
  return {
    title: extra.title || b.headline || b.name || "简历",
    templateId: extra.templateId || null,
    basic: {
      ...basicExtra,
      name: b.name,
      title: b.headline,
      email: b.email,
      phone: b.phone,
      location: b.location,
      photo: b.avatar,
      birthDate: b.birthDate,
      employementStatus: b.employmentStatus,
      customFields: Array.isArray(basicExtra.customFields) ? basicExtra.customFields : [],
    },
    education: (c.education || []).map((e, i) => {
      const [startDate, endDate] = String(e.time || "").split(" – ");
      return {
        id: String(i + 1),
        school: e.school,
        major: e.major,
        degree: e.degree,
        startDate: startDate || "",
        endDate: endDate || "",
        visible: true,
        gpa: "",
        description: pointsToHtml(e.points),
      };
    }),
    experience: (c.experience || []).map((e, i) => ({
      id: String(i + 1),
      company: e.org,
      position: e.role,
      date: e.time,
      details: pointsToHtml(e.points),
      visible: true,
    })),
    projects: (c.projects || []).map((p, i) => ({
      id: String(i + 1),
      name: p.name,
      role: p.role,
      date: p.time,
      description: pointsToHtml(p.points),
      visible: true,
      link: p.url || "",
      linkLabel: p.url || "",
    })),
    skillContent: extra.skillContent || pointsToHtml(c.skills),
    selfEvaluationContent: extra.selfEvaluationContent || (b.summary || ""),
    certificates: extra.certificates || (c.certifications || []).map((name, i) => ({ id: String(i + 1), url: "", name })),
    menuSections: extra.menuSections || [],
    globalSettings: extra.globalSettings || {},
    customData: extra.customData || {},
  };
}
