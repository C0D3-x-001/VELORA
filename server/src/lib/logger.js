import crypto from "crypto";

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const configuredLevel = LOG_LEVELS[process.env.LOG_LEVEL || "info"] ?? LOG_LEVELS.info;

const SENSITIVE_KEYS = new Set([
  "authorization", "cookie", "password", "token", "secret",
  "api_key", "apikey", "api-key", "access_token", "refresh_token",
  "supabase_service_role_key", "clerk_secret_key", "stripe_secret_key",
]);

function redact(obj, seen = new WeakSet()) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((item) => redact(item, seen));
  if (seen.has(obj)) return "[Circular]";
  seen.add(obj);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      out[k] = "[REDACTED]";
    } else if (v && typeof v === "object") {
      out[k] = redact(v, seen);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function formatEntry(level, service, message, meta) {
  const entry = {
    level,
    service,
    message,
    timestamp: new Date().toISOString(),
    ...Object.fromEntries(Object.entries(meta).filter(([k]) => !["level", "service", "message", "timestamp"].includes(k))),
  };
  return JSON.stringify(entry);
}

function emit(level, service, message, meta) {
  if (LOG_LEVELS[level] > configuredLevel) return;
  const safe = redact(meta);
  const line = formatEntry(level, service, message, safe);
  if (level === "error") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export function createLogger(service) {
  return {
    error(message, meta = {}) {
      const { stack, ...rest } = meta;
      const entry = { ...rest };
      if (stack) entry.stack = stack;
      emit("error", service, message, entry);
    },
    warn(message, meta = {}) {
      emit("warn", service, message, meta);
    },
    info(message, meta = {}) {
      emit("info", service, message, meta);
    },
    debug(message, meta = {}) {
      emit("debug", service, message, meta);
    },
  };
}

export function generateRequestId() {
  return crypto.randomBytes(4).toString("hex");
}

export function requestLogger(req, res, next) {
  if (!req.path.startsWith("/api")) return next();

  const requestId = generateRequestId();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  const start = Date.now();
  const log = createLogger("http");

  res.on("finish", () => {
    const duration = Date.now() - start;
    const meta = {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
    };
    if (req.auth?.userId) meta.userId = req.auth.userId;

    if (res.statusCode >= 500) {
      log.error("Request failed", meta);
    } else if (res.statusCode >= 400) {
      log.warn("Request error", meta);
    } else {
      log.info("Request completed", meta);
    }
  });

  next();
}
