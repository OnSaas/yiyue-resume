const adapters = [];

export function registerAdapter(adapter) {
  if (!adapter?.id) throw new Error("adapter.id required");
  const i = adapters.findIndex((a) => a.id === adapter.id);
  if (i >= 0) adapters[i] = adapter;
  else adapters.push(adapter);
}

export function listAdapters() {
  return adapters.map((a) => ({ id: a.id, label: a.label || a.id, version: a.version || "1" }));
}

export function detectAdapter(raw) {
  if (raw && raw.format === "yiyue-project" && raw.resume) return { id: "yiyue-project", adapter: null };
  for (const a of adapters) {
    if (a.detect && a.detect(raw)) return { id: a.id, adapter: a };
  }
  return { id: "unknown", adapter: null };
}

export function getAdapter(id) {
  return adapters.find((a) => a.id === id) || null;
}
