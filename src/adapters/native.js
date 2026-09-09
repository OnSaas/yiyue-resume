import { emptyCanonical, sanitizeCanonical } from "../schema/resume.js";

function str(v) {
  return v == null ? "" : String(v);
}

export function isNative(raw) {
  return !!(raw && typeof raw === "object" && (raw.name || raw.experience || raw.projects) && !raw.basic && !raw.basics);
}

export function fromNative(raw) {
  const out = emptyCanonical();
  out.basics.name = str(raw.name);
  out.basics.nameEn = str(raw.nameEn);
  out.basics.headline = str(raw.variant || raw.headline);
  out.basics.summary = str(raw.tagline || raw.summary);
  out.links = Array.isArray(raw.links) ? raw.links.map((l) => ({ label: str(l.label), href: str(l.href) })) : [];
  const contact = Array.isArray(raw.contact) ? raw.contact : [];
  for (const c of contact) {
    const href = str(c.href);
    const label = str(c.label);
    if (/^mailto:/i.test(href) || /@/.test(label)) out.basics.email = out.basics.email || label.replace(/^mailto:/, "");
    else if (label) out.links.push({ label, href });
  }
  const job = (x) => ({
    org: str(x.org),
    role: str(x.role),
    time: str(x.time),
    points: Array.isArray(x.points) ? x.points.map(str) : [],
  });
  out.experience = Array.isArray(raw.experience) ? raw.experience.map(job) : [];
  out.projects = Array.isArray(raw.projects)
    ? raw.projects.map((p) => ({
        name: str(p.name || p.role),
        role: str(p.role),
        time: str(p.time),
        url: str(p.url || p.href),
        points: Array.isArray(p.points) ? p.points.map(str) : [],
      }))
    : [];
  out.education = Array.isArray(raw.education)
    ? raw.education.map((e) => ({
        school: str(e.school || e.org),
        major: str(e.major),
        degree: str(e.degree),
        time: str(e.time),
        points: Array.isArray(e.points) ? e.points.map(str) : [],
      }))
    : [];
  out.skills = Array.isArray(raw.skills) ? raw.skills.map(str) : [];
  return sanitizeCanonical(out);
}
