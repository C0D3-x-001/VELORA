import { ZodError } from "zod";
import { createLogger } from "../lib/logger.js";

const log = createLogger("error-handler");

export function errorHandler(err, req, res, _next) {
  log.error("Request failed", {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    statusCode: err.status || 500,
    error: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      details: err.errors.map(e => `${e.path.join(".")}: ${e.message}`),
    });
  }

  if (err.name === "UnauthorizedError") {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  if (err.code === "PGRST116") {
    return res.status(404).json({ error: "Resource not found" });
  }

  const status = err.status || 500;
  const message = status === 500 ? "Internal server error" : err.message;

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
}