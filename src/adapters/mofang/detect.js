export function isMofang(raw) {
  return !!(raw && typeof raw === "object" && raw.basic && typeof raw.basic === "object");
}
