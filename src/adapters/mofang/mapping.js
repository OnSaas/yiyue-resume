export function str(v) {
  return v == null ? "" : String(v);
}

export function visible(x) {
  return x && x.visible !== false;
}

export const CORE_MAP = {
  "basic.name": "basics.name",
  "basic.title": "basics.headline",
  "basic.email": "basics.email",
  "basic.phone": "basics.phone",
  "basic.location": "basics.location",
  "basic.photo": "basics.avatar",
  "basic.birthDate": "basics.birthDate",
  "basic.employementStatus": "basics.employmentStatus",
  "basic.customFields": "links",
  experience: "experience",
  education: "education",
  projects: "projects",
  skillContent: "skills",
  certificates: "certifications",
  selfEvaluationContent: "basics.summary",
  "menuSections+customData": "customSections",
};

export const PRESERVE_MAP = [
  "basic.photoConfig",
  "basic.fieldOrder",
  "basic.icons",
  "basic.layout",
  "basic.githubKey",
  "basic.githubUseName",
  "basic.githubContributionsVisible",
  "basic.customFields",
  "title",
  "templateId",
  "menuSections",
  "globalSettings",
  "certificates",
  "skillContent",
  "selfEvaluationContent",
  "customData",
];

export const IGNORED = ["activeSection", "draggingProjectId"];
