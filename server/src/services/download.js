import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { spawn } from "child_process";
import config from "../config/env.js";

const YTDLP_PATH = path.join(process.cwd(), "bin", "yt-dlp.exe");
const COOKIES_PATH = path.join(process.cwd(), "cookies.txt");
const FFMPEG_PATH = config.video.ffmpegPath;

function ensureYtDlp() {
  if (!fs.existsSync(YTDLP_PATH)) {
    throw new Error(`yt-dlp not found at ${YTDLP_PATH}`);
  }
}

function getCookiesArgs() {
  if (fs.existsSync(COOKIES_PATH)) {
    return ["--cookies", COOKIES_PATH];
  }
  return [];
}

const TEMP_DIR = path.join(process.cwd(), "temp");

const DOWNLOAD_ERRORS = {
  VIDEO_UNAVAILABLE: { code: "video_unavailable", message: "This video is unavailable or has been removed." },
  PRIVATE_VIDEO: { code: "private_video", message: "This video is private and cannot be processed." },
  AGE_RESTRICTED: { code: "age_restricted", message: "This video is age-restricted and cannot be processed." },
  GEO_BLOCKED: { code: "geo_blocked", message: "This video is not available in your region." },
  LOGIN_REQUIRED: { code: "login_required", message: "This video requires login." },
  NETWORK_ERROR: { code: "network_error", message: "A network error occurred. Please try again." },
  YOUTUBE_BLOCKED: { code: "youtube_blocked", message: "YouTube is blocking requests. Try again later." },
  TIMEOUT: { code: "timeout", message: "Download timed out. The video may be too long or the server is busy." },
  UNKNOWN: { code: "download_failed", message: "Could not download this video. Try another video." },
};

function classifyDownloadError(err) {
  if (!err) return DOWNLOAD_ERRORS.UNKNOWN;
  const s = (err.message || String(err)).toLowerCase();
  if (s.includes("video unavailable") || s.includes("not available") || s.includes("removed")) return DOWNLOAD_ERRORS.VIDEO_UNAVAILABLE;
  if (s.includes("private")) return DOWNLOAD_ERRORS.PRIVATE_VIDEO;
  if (s.includes("age-restricted") || s.includes("age limit") || s.includes("sign in")) return DOWNLOAD_ERRORS.AGE_RESTRICTED;
  if (s.includes("not available in your country") || s.includes("geo") || s.includes("region")) return DOWNLOAD_ERRORS.GEO_BLOCKED;
  if (s.includes("login required") || s.includes("oauth")) return DOWNLOAD_ERRORS.LOGIN_REQUIRED;
  if (s.includes("network") || s.includes("connection") || s.includes("resolve") || s.includes("enotfound")) return DOWNLOAD_ERRORS.NETWORK_ERROR;
  if (s.includes("403") || s.includes("forbidden")) return DOWNLOAD_ERRORS.YOUTUBE_BLOCKED;
  if (s.includes("timed out") || s.includes("timeout")) return DOWNLOAD_ERRORS.TIMEOUT;
  return DOWNLOAD_ERRORS.UNKNOWN;
}

function extractVideoId(url) {
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function runYtDlp(args, timeoutMs = 600000, onProgress = null) {
  return new Promise((resolve, reject) => {
    const proc = spawn(YTDLP_PATH, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let lastProgressLog = 0;
    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error("yt-dlp process timed out"));
    }, timeoutMs);

    proc.stdout.on("data", (d) => { stdout += d.toString(); });
    proc.stderr.on("data", (d) => {
      const chunk = d.toString();
      stderr += chunk;

      // Parse real-time progress from yt-dlp stderr
      const lines = chunk.split("\n");
      for (const line of lines) {
        // Match: [download]  42.3% of 120.5MiB at 2.50MiB/s ETA 00:32
        const progressMatch = line.match(/\[download\]\s+([\d.]+)%\s+of\s+~?([\d.]+\w+)\s+at\s+([\d.]+\w+\/s)\s+ETA\s+(\S+)/);
        if (progressMatch) {
          const pct = parseFloat(progressMatch[1]);
          const size = progressMatch[2];
          const speed = progressMatch[3];
          const eta = progressMatch[4];
          // Log progress at most every 5 seconds
          const now = Date.now();
          if (now - lastProgressLog > 5000) {
            lastProgressLog = now;
            console.log(`[Download] Progress: ${pct.toFixed(1)}% of ${size} at ${speed} ETA ${eta}`);
            if (onProgress) onProgress({ percent: pct, size, speed, eta });
          }
        }
        // Match merge line: [Merger] Merging formats into "output.mp4"
        if (line.includes("[Merger]") || line.includes("[ExtractAudio]")) {
          console.log(`[Download] ${line.trim()}`);
        }
      }
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const err = new Error(stderr.trim() || `yt-dlp exited with code ${code}`);
        err.stderr = stderr;
        err.exitCode = code;
        reject(err);
      } else {
        resolve({ stdout, stderr });
      }
    });

    proc.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

function safeUnlink(p) {
  try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch {}
}

function findSubtitleFile(projectId, dir) {
  try {
    const files = fs.readdirSync(dir);
    const srt = files.find((f) => f.includes(projectId) && f.endsWith(".srt"));
    return srt ? path.join(dir, srt) : null;
  } catch {
    return null;
  }
}

async function getVideoInfo(url) {
  ensureYtDlp();
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error("Invalid YouTube URL");

  try {
    const { stdout } = await runYtDlp(["-J", "--no-warnings", "--no-playlist", "--no-check-formats", ...getCookiesArgs(), url], 30000);
    const data = JSON.parse(stdout);

    return {
      title: data.title || "Untitled",
      duration: Math.round(data.duration || 0),
      thumbnail: data.thumbnail || null,
      author: data.uploader || data.channel || null,
      viewCount: data.view_count || 0,
      format: data.format || "unknown",
    };
  } catch (err) {
    if (err.message?.includes("Requested format is not available") || err.message?.includes("format")) {
      console.warn(`[Download] getVideoInfo format error, retrying without format: ${err.message}`);
      const { stdout } = await runYtDlp(["--dump-json", "--no-warnings", "--no-playlist", "--skip-download", ...getCookiesArgs(), url], 30000);
      const data = JSON.parse(stdout);
      return {
        title: data.title || "Untitled",
        duration: Math.round(data.duration || 0),
        thumbnail: data.thumbnail || null,
        author: data.uploader || data.channel || null,
        viewCount: data.view_count || 0,
        format: data.format || "unknown",
      };
    }
    throw err;
  }
}

const DOWNLOAD_FORMATS = [
  { format: "bv*[height<=720]+ba/b", label: "720p" },
  { format: "bv*+ba/b", label: "best available" },
  { format: "b", label: "muxed" },
];

async function downloadYouTubeVideo(url, outputPath, projectId, signal, formatIndex = 0) {
  ensureYtDlp();
  const PID = projectId.slice(0, 8);

  const videoId = extractVideoId(url);
  if (!videoId) throw new Error("Invalid YouTube URL");

  if (signal?.aborted) throw signal.reason || new Error("Aborted");

  const fmt = DOWNLOAD_FORMATS[formatIndex] || DOWNLOAD_FORMATS[DOWNLOAD_FORMATS.length - 1];
  console.log(`[Pipeline:${PID}] [Download] Starting yt-dlp download (format: ${fmt.label})...`);

  const hasCookies = fs.existsSync(COOKIES_PATH);
  if (hasCookies) {
    console.log(`[Pipeline:${PID}] [Download] Using cookies.txt for authenticated download`);
  } else {
    console.log(`[Pipeline:${PID}] [Download] No cookies.txt — YouTube may throttle. Export cookies to cookies.txt`);
  }

  const outputTemplate = outputPath.replace(/\.mp4$/, ".%(ext)s");

  const args = [
    "-f", fmt.format,
    "--merge-output-format", "mp4",
    "--no-warnings",
    "--no-playlist",
    "--write-auto-subs",
    "--sub-lang", "en",
    "--convert-subs", "srt",
    "--socket-timeout", "30",
    "--retries", "3",
    "--concurrent-fragments", "4",
    "--http-chunk-size", "10M",
    "--ffmpeg-location", FFMPEG_PATH,
    "--progress",
    ...getCookiesArgs(),
    "-o", outputTemplate,
    url,
  ];

  try {
    const { stderr } = await runYtDlp(args, 600000, (progress) => {
      console.log(`[Pipeline:${PID}] [Download] ${progress.percent.toFixed(1)}% — ${progress.speed} ETA ${progress.eta}`);
    });

    if (stderr) {
      const lines = stderr.split("\n").filter((l) => l.trim());
      const warningLines = lines.filter((l) => l.includes("[warning]") || l.includes("cookies"));
      if (warningLines.length) {
        console.log(`[Pipeline:${PID}] [Download] yt-dlp warnings: ${warningLines.slice(0, 3).join("; ")}`);
      }
    }
  } catch (err) {
    console.error(`[Pipeline:${PID}] [Download] yt-dlp error (format: ${fmt.label}): ${err.message?.slice(0, 300)}`);
    const classified = classifyDownloadError(err);
    const wrap = new Error(classified.message);
    wrap.code = classified.code;
    wrap.lastError = err.message;
    wrap.formatIndex = formatIndex;
    throw wrap;
  }

  const finalPath = outputPath;
  if (!fs.existsSync(finalPath)) {
    const possibleFiles = fs.readdirSync(path.dirname(outputPath))
      .filter((f) => f.startsWith(path.basename(outputPath).replace(/\.[^.]+$/, "")));
    if (possibleFiles.length > 0) {
      const actual = path.join(path.dirname(outputPath), possibleFiles[0]);
      if (actual !== finalPath) fs.renameSync(actual, finalPath);
    }
  }

  const probe = await import("./video.js").then((m) => m.videoService.probeVideo(finalPath)).catch(() => null);
  const duration = probe?.duration || 0;

  const srtFile = findSubtitleFile(projectId, TEMP_DIR);
  if (srtFile) {
    console.log(`[Pipeline:${PID}] [Download] Auto-caption found: ${path.basename(srtFile)}`);
  }

  console.log(`[Pipeline:${PID}] [Download] Download complete — duration: ${duration}s`);

  return { path: finalPath, duration, subtitlePath: srtFile || null };
}

async function downloadYouTubeAudio(url, outputPath, projectId, signal) {
  ensureYtDlp();
  const PID = projectId.slice(0, 8);

  if (signal?.aborted) throw signal.reason || new Error("Aborted");

  console.log(`[Pipeline:${PID}] [Download] Starting yt-dlp audio download...`);

  const outputTemplate = outputPath.replace(/\.[^.]+$/, ".%(ext)s");

  const args = [
    "-f", "ba",
    "--audio-format", "mp3",
    "--no-warnings",
    "--no-playlist",
    "--socket-timeout", "30",
    "--retries", "3",
    "--ffmpeg-location", FFMPEG_PATH,
    "--progress",
    ...getCookiesArgs(),
    "-o", outputTemplate,
    url,
  ];

  try {
    await runYtDlp(args, 600000, (progress) => {
      console.log(`[Pipeline:${PID}] [Download] Audio: ${progress.percent.toFixed(1)}% — ${progress.speed}`);
    });
  } catch (err) {
    const classified = classifyDownloadError(err);
    const wrap = new Error(classified.message);
    wrap.code = classified.code;
    wrap.lastError = err.message;
    throw wrap;
  }

  const finalPath = outputPath;
  if (!fs.existsSync(finalPath)) {
    const possibleFiles = fs.readdirSync(path.dirname(outputPath))
      .filter((f) => f.startsWith(path.basename(outputPath).replace(/\.[^.]+$/, "")));
    if (possibleFiles.length > 0) {
      const actual = path.join(path.dirname(outputPath), possibleFiles[0]);
      if (actual !== finalPath) fs.renameSync(actual, finalPath);
    }
  }

  console.log(`[Pipeline:${PID}] [Download] Audio download complete`);
  return { path: finalPath, duration: 0 };
}

async function downloadWithFallbacks(url, projectId, isAudio = false, signal) {
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
  const PID = projectId.slice(0, 8);

  const ext = isAudio ? ".mp3" : ".mp4";
  const filename = `${projectId}_${randomUUID().slice(0, 8)}${ext}`;
  const outputPath = path.join(TEMP_DIR, filename);

  const downloadStart = Date.now();
  let lastError;
  const RETRY_DELAYS = [3000, 5000];

  for (let attempt = 1; attempt <= 3; attempt++) {
    if (signal?.aborted) throw signal.reason || new Error("Aborted");
    try {
      const fmtIndex = isAudio ? 0 : (attempt - 1);
      console.log(`[Pipeline:${PID}] [Download] Attempt ${attempt}/${3}...`);
      let result;
      if (isAudio) {
        result = await downloadYouTubeAudio(url, outputPath, projectId, signal);
      } else {
        result = await downloadYouTubeVideo(url, outputPath, projectId, signal, fmtIndex);
      }
      console.log(`[Pipeline:${PID}] [Download] Success in ${((Date.now() - downloadStart) / 1000).toFixed(1)}s`);
      return { ...result, filename };
    } catch (err) {
      if (signal?.aborted) throw err;
      lastError = err;
      console.warn(`[Pipeline:${PID}] [Download] Attempt ${attempt} failed: ${err.message} | detail: ${(err.lastError || "").slice(0, 200)}`);

      safeUnlink(outputPath);
      if (attempt < 3) {
        const delay = RETRY_DELAYS[attempt - 1] || 3000;
        console.log(`[Pipeline:${PID}] [Download] Retrying in ${delay / 1000}s...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  safeUnlink(outputPath);

  const classified = classifyDownloadError(lastError);
  const err = new Error(classified.message);
  err.code = classified.code;
  err.lastError = lastError?.message;
  throw err;
}

export const downloadService = {
  getVideoInfo,
  downloadVideo(url, projectId, signal) {
    return downloadWithFallbacks(url, projectId, false, signal);
  },
  downloadAudio(url, projectId, signal) {
    return downloadWithFallbacks(url, projectId, true, signal);
  },
  cleanup(filePath) {
    try {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {}
  },
  cleanupAll(projectId) {
    try {
      if (!fs.existsSync(TEMP_DIR)) return;
      const files = fs.readdirSync(TEMP_DIR).filter((f) => f.startsWith(projectId));
      files.forEach((f) => fs.unlinkSync(path.join(TEMP_DIR, f)));
    } catch {}
  },
};

console.log(`[Download] Using yt-dlp ${fs.existsSync(YTDLP_PATH) ? "✅ " + YTDLP_PATH : "❌ NOT FOUND"}`);
