const DEFAULT_TIMEOUT_MS = 60_000;

export function requestTimeout(ms = DEFAULT_TIMEOUT_MS) {
  return (req, res, next) => {
    if (req.method === "OPTIONS") return next();
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({ error: "Request timeout" });
      }
    }, ms);
    timer.unref();
    res.on("finish", () => clearTimeout(timer));
    next();
  };
}
