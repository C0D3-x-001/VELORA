const cleanupInterval = setInterval(() => {
  const store = globalThis.__rateLimitStore;
  if (!store) return;
  const now = Date.now();
  for (const [k, v] of store) {
    if (now > v.resetAt) store.delete(k);
  }
}, 60_000);

if (cleanupInterval.unref) cleanupInterval.unref();

export function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const key = `ratelimit:${ip}`;

  if (!globalThis.__rateLimitStore) {
    globalThis.__rateLimitStore = new Map();
  }

  const store = globalThis.__rateLimitStore;
  const now = Date.now();
  const windowMs = 60_000;
  const max = 300;

  const record = store.get(key) || { count: 0, resetAt: now + windowMs };

  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + windowMs;
  }

  record.count++;
  store.set(key, record);

  if (record.count > max) {
    return res.status(429).json({ error: "Too many requests" });
  }

  res.setHeader("X-RateLimit-Limit", max);
  res.setHeader("X-RateLimit-Remaining", Math.max(0, max - record.count));
  res.setHeader("X-RateLimit-Reset", new Date(record.resetAt).toISOString());

  next();
}