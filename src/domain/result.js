export function ok(data = {}) {
  return { ok: true, ...data };
}

export function fail(code, message, extra = {}) {
  return { ok: false, error: { code, message }, errors: extra.errors || [message], ...extra };
}
