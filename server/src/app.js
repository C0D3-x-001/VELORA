import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import { dirname, resolve } from "path";
import { existsSync } from "fs";

import authRoutes from "./routes/auth.js";
import projectRoutes from "./routes/projects.js";
import clipRoutes from "./routes/clips.js";
import creditRoutes from "./routes/credits.js";
import billingRoutes from "./routes/billing.js";
import settingsRoutes from "./routes/settings.js";
import editingRoutes from "./routes/editing.js";
import clipEditsRoutes from "./routes/clip-edits.js";
import webhookRoutes from "./routes/webhooks.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { rateLimiter } from "./middleware/rateLimiter.js";
import { authMiddleware } from "./middleware/auth.js";
import { supabaseAdmin } from "./config/supabase.js";
import { recoverStuckProjects } from "./services/project.js";
import { requestLogger } from "./lib/logger.js";
import { requestTimeout } from "./middleware/timeout.js";
import config from "./config/env.js";
import { initWhisper, isWhisperReady } from "./services/transcription.js";

dotenv.config();

// Global error handlers to prevent silent crashes
process.on("unhandledRejection", (reason, promise) => {
  console.error("[FATAL] Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[ERROR] Uncaught Exception (server continuing):", err.message || err);
});

const app = express();
const PORT = process.env.PORT || 5000;
const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV !== "production";

app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: false, contentSecurityPolicy: isDev ? false : undefined }));
app.use(compression());
const allowedOrigins = [config.frontendUrl, "http://localhost:5000"];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));
app.use(requestLogger);
// Only rate-limit API routes — the SPA shell and its module files must
// load without throttling, otherwise the app appears blank.
app.use("/api", rateLimiter);
app.use("/api", requestTimeout(120_000));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "velora-api", timestamp: new Date().toISOString() });
});

app.get("/api/health/ready", async (req, res) => {
  const checks = { db: "ok", ffmpeg: "ok", ai: "ok" };
  let healthy = true;

  try {
    const { error } = await supabaseAdmin.from("users").select("id").limit(1);
    if (error) { checks.db = error.message; healthy = false; }
  } catch { checks.db = "unreachable"; healthy = false; }

  const ffmpegOk = config.video.ffmpegPath && existsSync(config.video.ffmpegPath);
  if (!ffmpegOk) { checks.ffmpeg = "not found"; healthy = false; }

  if (!config.ai.apiKey && !config.ai.gemini?.apiKey) { checks.ai = "no provider configured"; healthy = false; }

  res.status(healthy ? 200 : 503).json({ status: healthy ? "ready" : "degraded", checks, timestamp: new Date().toISOString() });
});

function handleHealthSetup(req, res) {
  res.json({
    cookies: true,
    ffmpeg: config.video.ffmpegPath && existsSync(config.video.ffmpegPath),
    ytdlp: true,
    ai: !!(config.ai.apiKey || config.ai.gemini?.apiKey),
    whisper: isWhisperReady(),
  });
}
app.get("/api/health/setup", handleHealthSetup);
app.get("/api/v1/health/setup", handleHealthSetup);

app.use("/api/v1/webhooks", webhookRoutes);
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.get("/api/v1/clips/subtitles/:userId/:projectId/:fileName", async (req, res) => {
  try {
    const { userId, projectId, fileName } = req.params;

    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, "");
    if (sanitizedName !== fileName || !sanitizedName.endsWith(".vtt")) {
      return res.status(400).json({ error: "Invalid file name" });
    }
    const safeUserId = userId.replace(/[^a-f0-9-]/g, "");
    const safeProjectId = projectId.replace(/[^a-f0-9-]/g, "");

    const storagePath = `users/${safeUserId}/projects/${safeProjectId}/subtitles/${sanitizedName}`;
    const { data, error } = await supabaseAdmin.storage.from("velora-storage").download(storagePath);
    if (error) throw error;
    const vttContent = await data.text();
    res.setHeader("Content-Type", "text/vtt; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(vttContent);
  } catch {
    res.status(404).json({ error: "Subtitles not found" });
  }
});

app.use(authMiddleware);

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/projects", projectRoutes);
app.use("/api/v1/clips", clipRoutes);
app.use("/api/v1/credits", creditRoutes);
app.use("/api/v1/billing", billingRoutes);
app.use("/api/v1/settings", settingsRoutes);
app.use("/api/v1/editing", editingRoutes);
app.use("/api/v1/clip-edits", clipEditsRoutes);
app.use("/api", (req, res) => {
  res.status(404).json({ error: "API endpoint not found" });
});

app.use(errorHandler);

function logStartupHealth() {
  const ffmpegOk = config.video.ffmpegPath && existsSync(config.video.ffmpegPath);
  console.log(`[Health] FFmpeg: ${ffmpegOk ? "✅ " + config.video.ffmpegPath : "❌ NOT FOUND"}`);
  const ytdlpPath = path.join(process.cwd(), "bin", "yt-dlp.exe");
  const ytdlpOk = existsSync(ytdlpPath);
  console.log(`[Health] YouTube: ${ytdlpOk ? "✅ yt-dlp (standalone binary)" : "❌ yt-dlp NOT FOUND"}`);
  const cookiesPath = path.join(process.cwd(), "cookies.txt");
  const cookiesOk = existsSync(cookiesPath);
  console.log(`[Health] Cookies: ${cookiesOk ? "✅ cookies.txt found (authenticated downloads)" : "⚠️ No cookies.txt (YouTube may throttle)"}`);

  const nvidia = config.ai.apiKey ? "✅ configured" : "❌ not configured";
  const gemini = config.ai.gemini?.apiKey ? "✅ configured" : "❌ not configured";
  console.log(`[Health] AI (NVIDIA): ${nvidia}`);
  console.log(`[Health] AI (Gemini): ${gemini}`);

  const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? "✅ configured" : "❌ not configured";
  console.log(`[Health] Supabase: ${supabase}`);

  const clerk = process.env.CLERK_SECRET_KEY ? "✅ configured" : "❌ not configured";
  console.log(`[Health] Clerk: ${clerk}`);

  initWhisper().then((ok) => {
    console.log(`[Health] Whisper: ${ok ? "✅ ready (base.en, DTW)" : "❌ not available"}`);
  }).catch(() => {
    console.log(`[Health] Whisper: ❌ init failed`);
  });
}

async function startServer() {
  let server;
  // Serve Vite dev server in development, static files in production
  if (isDev) {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
        root: resolve(__dirname, "../../client"),
      });
      app.use(vite.middlewares);
      console.log("[Vite] Dev middleware attached");
    } catch {
      console.warn("[Startup] Vite unavailable, falling back to static files");
      const clientDist = resolve(__dirname, "../../client/dist");
      app.use(express.static(clientDist, { maxAge: "1d", etag: true }));
      app.get("*", (req, res) => {
        res.sendFile(resolve(clientDist, "index.html"));
      });
      console.log("[Static] Serving client build from", clientDist);
    }
  } else {
    const clientDist = resolve(__dirname, "../../client/dist");
    app.use(express.static(clientDist, { maxAge: "1d", etag: true }));
    app.get("*", (req, res) => {
      res.sendFile(resolve(clientDist, "index.html"));
    });
    console.log("[Static] Serving client build from", clientDist);
  }

  server = app.listen(PORT, async () => {
    console.log(`🚀 Velora running on http://localhost:${PORT}`);
    logStartupHealth();
    try { await recoverStuckProjects(); } catch (e) { console.error("[Startup] Recovery failed:", e.message); }
  });

  // Graceful shutdown
  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[Shutdown] ${signal} received — draining connections...`);
    server.close(() => {
      console.log("[Shutdown] HTTP server closed");
      process.exit(0);
    });
    setTimeout(() => {
      console.error("[Shutdown] Forced exit after 10s");
      process.exit(1);
    }, 10000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch((err) => {
  console.error("[FATAL] Failed to start server:", err);
  process.exit(1);
});

export default app;