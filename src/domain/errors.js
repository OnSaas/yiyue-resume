export class AppError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

export class ImportError extends AppError {
  constructor(code, message, extra = {}) {
    super(code, message, extra.status || 400);
    this.errors = extra.errors || [message];
    this.format = extra.format || "unknown";
  }
}

export class ValidationError extends AppError {
  constructor(message, errors = []) {
    super("VALIDATION_FAILED", message, 400);
    this.errors = errors.length ? errors : [message];
  }
}

export class RenderError extends AppError {
  constructor(message) {
    super("RENDER_FAILED", message, 500);
  }
}

export class ShareError extends AppError {
  constructor(code, message, status = 400) {
    super(code, message, status);
  }
}

export class StorageError extends AppError {
  constructor(message, status = 500) {
    super("STORAGE_ERROR", message, status);
  }
}

/** 兼容旧前端：error 仍是字符串，另带 code */
export function errorBody(err) {
  if (err instanceof AppError) {
    return { error: err.message, code: err.code, errors: err.errors };
  }
  return { error: err?.message || "内部错误", code: "INTERNAL" };
}
