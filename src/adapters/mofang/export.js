import { emptyCanonical } from "../../schema/resume.js";

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
    selfEvaluationContent: extra.selfEvaluationContent || b.summary || "",
    certificates: extra.certificates || (c.certifications || []).map((name, i) => ({ id: String(i + 1), url: "", name })),
    menuSections: extra.menuSections || [],
    globalSettings: extra.globalSettings || {},
    customData: extra.customData || {},
  };
}
