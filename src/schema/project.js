import { PROJECT_FORMAT, PROJECT_VERSION } from "../config/defaults.js";

export function isProject(raw) {
  return !!(raw && raw.format === PROJECT_FORMAT && raw.resume);
}

export function wrapProject(resume, presentation) {
  return { format: PROJECT_FORMAT, version: PROJECT_VERSION, resume, presentation };
}
