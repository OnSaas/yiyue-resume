import { PROJECT_FORMAT, PROJECT_VERSION } from "../config/defaults.js";

/** On-disk / export id stays historical. Reads also accept the product alias. */
export const PROJECT_FORMAT_ALIASES = [PROJECT_FORMAT, "reshare-project"];

export function isProject(raw) {
  return !!(raw && raw.resume && PROJECT_FORMAT_ALIASES.includes(raw.format));
}

export function wrapProject(resume, presentation) {
  return { format: PROJECT_FORMAT, version: PROJECT_VERSION, resume, presentation };
}
