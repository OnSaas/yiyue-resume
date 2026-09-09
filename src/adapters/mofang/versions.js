export const ADAPTER_VERSION = "1";

export function detectMofangVersion(raw) {
  if (!raw || typeof raw !== "object") return "unknown";
  if (raw.menuSections || raw.customData || raw.globalSettings) return "2.x";
  return "1.x";
}
