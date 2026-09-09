const MAX_STR = 8000;
const MAX_ARR = 80;
const MAX_JSON = 200_000;

export function emptyCanonical() {
  return {
    basics: {
      name: "",
      nameEn: "",
      headline: "",
      summary: "",
      avatar: "",
      email: "",
      phone: "",
      location: "",
    },
    links: [],
    experience: [],
    education: [],
    projects: [],
    skills: [],
    languages: [],
    certifications: [],
    awards: [],
    publications: [],
    customSections: [],
  };
}

function clip(s, n = MAX_STR) {
  return String(s ?? "").slice(0, n);
}

function clipArr(a, map, n = MAX_ARR) {
  if (!Array.isArray(a)) return [];
  return a.slice(0, n).map(map);
}

export function sanitizeCanonical(raw) {
  const b = raw?.basics && typeof raw.basics === "object" ? raw.basics : {};
  const job = (x) => ({
    org: clip(x?.org, 200),
    role: clip(x?.role, 200),
    time: clip(x?.time, 80),
    points: clipArr(x?.points, (p) => clip(p, 500), 30),
  });
  const edu = (x) => ({
    school: clip(x?.school, 200),
    major: clip(x?.major, 200),
    degree: clip(x?.degree, 80),
    time: clip(x?.time, 80),
    points: clipArr(x?.points, (p) => clip(p, 500), 20),
  });
  const proj = (x) => ({
    name: clip(x?.name, 200),
    role: clip(x?.role, 200),
    time: clip(x?.time, 80),
    url: clip(x?.url, 500),
    points: clipArr(x?.points, (p) => clip(p, 500), 30),
  });
  const link = (x) => ({ label: clip(x?.label, 80), href: clip(x?.href, 500) });
  const custom = (x) => ({
    id: clip(x?.id, 64),
    title: clip(x?.title, 80),
    items: clipArr(x?.items, job, 40),
  });
  return {
    basics: {
      name: clip(b.name, 80),
      nameEn: clip(b.nameEn, 80),
      headline: clip(b.headline, 200),
      summary: clip(b.summary, 2000),
      avatar: clip(b.avatar, 2000),
      email: clip(b.email, 200),
      phone: clip(b.phone, 80),
      location: clip(b.location, 120),
    },
    links: clipArr(raw?.links, link),
    experience: clipArr(raw?.experience, job),
    education: clipArr(raw?.education, edu),
    projects: clipArr(raw?.projects, proj),
    skills: clipArr(raw?.skills, (s) => clip(s, 200)),
    languages: clipArr(raw?.languages, (s) => clip(s, 80)),
    certifications: clipArr(raw?.certifications, (s) => clip(s, 200)),
    awards: clipArr(raw?.awards, (s) => clip(s, 200)),
    publications: clipArr(raw?.publications, (s) => clip(s, 300)),
    customSections: clipArr(raw?.customSections, custom, 12),
  };
}

export function validateCanonical(doc) {
  const errors = [];
  if (!doc || typeof doc !== "object") errors.push("必要字段缺失：简历对象");
  const size = JSON.stringify(doc || {}).length;
  if (size > MAX_JSON) errors.push("JSON 总体积过大");
  const name = doc?.basics?.name;
  if (name != null && typeof name !== "string") errors.push("basics.name 必须是字符串");
  if (doc?.links && !Array.isArray(doc.links)) errors.push("links 必须是数组");
  if (doc?.experience && !Array.isArray(doc.experience)) errors.push("experience 必须是数组");
  const urlish = [...(doc?.links || [])].map((l) => l.href).filter(Boolean);
  for (const u of urlish) {
    if (u && !/^(https?:|mailto:|\/)/i.test(u) && !u.startsWith("data:")) {
      errors.push("URL 格式不支持：" + String(u).slice(0, 40));
      break;
    }
  }
  return errors;
}
