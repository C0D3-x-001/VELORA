import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import config from "../../config/env.js";

const PLAN_CONFIG = {
  free:      { shakiness: 3,  smoothing: 5,  optzoom: 1, accuracy: 10 },
  starter:   { shakiness: 5,  smoothing: 10, optzoom: 2, accuracy: 12 },
  creator:   { shakiness: 7,  smoothing: 15, optzoom: 2, accuracy: 14 },
  pro:       { shakiness: 10, smoothing: 20, optzoom: 3, accuracy: 15 },
  business:  { shakiness: 10, smoothing: 20, optzoom: 3, accuracy: 15 },
};

let _vidstabAvailable = null;

function getPlanConfig(plan) {
  return PLAN_CONFIG[plan] || PLAN_CONFIG.free;
}

function runFFmpeg(args, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(config.video.ffmpegPath, ["-y", "-threads", "0", ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      try { ffmpeg.kill("SIGKILL"); } catch {}
      reject(new Error(`FFmpeg stabilization timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    ffmpeg.stderr.on("data", (d) => { stderr += d.toString(); });
    ffmpeg.on("close", (code) => {
      clearTimeout(timer);
      if (killed) return;
      if (code === 0) resolve({ success: true, stderr });
      else reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(0, 300)}`));
    });
    ffmpeg.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`FFmpeg not found: ${err.message}`));
    });
  });
}

async function checkVidstabAvailable() {
  if (_vidstabAvailable !== null) return _vidstabAvailable;
  try {
    const result = await runFFmpeg(["-filters"], 5000);
    const output = result.stderr || "";
    _vidstabAvailable = output.includes("vidstabdetect");
  } catch {
    _vidstabAvailable = false;
  }
  if (!_vidstabAvailable) {
    console.warn("[Stabilize] vidstab filters not available in this FFmpeg build — stabilization disabled for this session");
  }
  return _vidstabAvailable;
}

export async function stabilizeClip(inputPath, outputPath, plan = "free") {
  if (!(await checkVidstabAvailable())) {
    return { success: false, skipped: "vidstab_unavailable" };
  }

  const start = Date.now();
  const cfg = getPlanConfig(plan);
  const tmpDir = path.dirname(outputPath);
  const trfPath = path.join(tmpDir, `stab_${Date.now()}.trf`);

  try {
    if (!fs.existsSync(inputPath) || fs.statSync(inputPath).size < 1024) {
      throw new Error("Input file missing or too small for stabilization");
    }

    const dims = await new Promise((resolve) => {
      const ff = spawn(config.video.ffmpegPath, ["-y", "-i", inputPath], { stdio: ["ignore", "pipe", "pipe"] });
      let stderr = "";
      ff.stderr.on("data", (d) => { stderr += d.toString(); });
      ff.on("close", () => {
        const durMatch = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2})/);
        const dimMatch = stderr.match(/,\s*(\d{2,5})x(\d{2,5})/);
        resolve({
          duration: durMatch ? parseInt(durMatch[1]) * 3600 + parseInt(durMatch[2]) * 60 + parseInt(durMatch[3]) : 0,
          width: dimMatch ? parseInt(dimMatch[1]) : 0,
          height: dimMatch ? parseInt(dimMatch[2]) : 0,
        });
      });
      ff.on("error", () => resolve({ duration: 0, width: 0, height: 0 }));
    });

    if (dims.duration < 2) {
      console.log(`[Stabilize] Clip too short (${dims.duration}s) — skipping`);
      fs.copyFileSync(inputPath, outputPath);
      return { success: true, processingTimeMs: Date.now() - start, skipped: "too_short" };
    }

    const trfPathFF = trfPath.replace(/\\/g, "/").replace(/:/g, "\\:");

    console.log(`[Stabilize] Analyzing motion (shakiness=${cfg.shakiness}, accuracy=${cfg.accuracy}, ${dims.width}x${dims.height}, ${dims.duration}s)...`);

    await runFFmpeg([
      "-i", inputPath,
      "-vf", `vidstabdetect=shakiness=${cfg.shakiness}:accuracy=${cfg.accuracy}:result=${trfPathFF}`,
      "-f", "null", "-",
    ], 180000);

    if (!fs.existsSync(trfPath) || fs.statSync(trfPath).size === 0) {
      throw new Error("vidstabdetect produced no motion data");
    }

    console.log(`[Stabilize] Applying stabilization (smoothing=${cfg.smoothing}, optzoom=${cfg.optzoom})...`);

    await runFFmpeg([
      "-i", inputPath,
      "-vf", `vidstabtransform=input=${trfPathFF}:smoothing=${cfg.smoothing}:crop=black:zoom=1:optzoom=${cfg.optzoom}:interpol=bicubic`,
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-c:a", "copy",
      "-movflags", "+faststart",
      outputPath,
    ], 180000);

    try { fs.unlinkSync(trfPath); } catch {}

    const elapsed = Date.now() - start;
    console.log(`[Stabilize] Done in ${(elapsed / 1000).toFixed(1)}s`);
    return { success: true, processingTimeMs: elapsed };
  } catch (err) {
    try { fs.unlinkSync(trfPath); } catch {}
    console.warn(`[Stabilize] Failed: ${err.message} — using original clip`);
    try {
      if (!fs.existsSync(outputPath)) fs.copyFileSync(inputPath, outputPath);
    } catch { /* ignore */ }
    return { success: false, error: err.message };
  }
}
