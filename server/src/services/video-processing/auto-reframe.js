import { spawn } from "child_process";
import fs from "fs";
import config from "../../config/env.js";
import { getReframeOffset } from "./face-tracking.js";

function runFFmpeg(args, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(config.video.ffmpegPath, ["-y", ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      try { ffmpeg.kill("SIGKILL"); } catch {}
      reject(new Error(`FFmpeg auto-reframe timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    ffmpeg.stderr.on("data", (d) => { stderr += d.toString(); });
    ffmpeg.on("close", (code) => {
      clearTimeout(timer);
      if (killed) return;
      if (code === 0) resolve({ success: true });
      else reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(0, 300)}`));
    });
    ffmpeg.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`FFmpeg not found: ${err.message}`));
    });
  });
}

async function getVideoDimensions(inputPath) {
  return new Promise((resolve) => {
    const ff = spawn(config.video.ffmpegPath, ["-y", "-i", inputPath], { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    ff.stderr.on("data", (d) => { stderr += d.toString(); });
    ff.on("close", () => {
      const match = stderr.match(/,\s*(\d{2,5})x(\d{2,5})/);
      if (match) resolve({ width: parseInt(match[1]), height: parseInt(match[2]) });
      else resolve({ width: 1920, height: 1080 });
    });
    ff.on("error", () => resolve({ width: 1920, height: 1080 }));
  });
}

function buildCropExpression(trajectory, srcW, srcH, targetAspect) {
  const points = trajectory.map((p) => ({
    t: p.timestamp || 0,
    offset: getReframeOffset(trajectory, p.timestamp || 0, targetAspect),
  }));

  if (points.length === 0) {
    let cw, ch;
    if (targetAspect === "9:16") {
      ch = srcH;
      cw = Math.round(srcH * (9 / 16));
    } else if (targetAspect === "16:9") {
      cw = srcW;
      ch = Math.round(srcW * (9 / 16));
    } else {
      const s = Math.min(srcW, srcH);
      cw = s;
      ch = s;
    }
    const cx = Math.max(0, Math.round((srcW - cw) / 2));
    const cy = Math.max(0, Math.round((srcH - ch) / 2));
    return `crop=${cw}:${ch}:${cx}:${cy}`;
  }

  if (points.length === 1) {
    const { cropX, cropY, cropW, cropH } = points[0].offset;
    return `crop=${cropW}:${cropH}:${cropX}:${cropY}`;
  }

  let cw = points[0].offset.cropW;
  let ch = points[0].offset.cropH;

  let xParts = [];
  let yParts = [];

  for (let i = 0; i < points.length; i++) {
    const t = points[i].t;
    const cx = points[i].offset.cropX;
    const cy = points[i].offset.cropY;

    if (i === 0) {
      xParts.push(`if(between(t\\,0\\,${t.toFixed(2)})\\,${cx.toFixed(1)}`);
      yParts.push(`if(between(t\\,0\\,${t.toFixed(2)})\\,${cy.toFixed(1)}`);
    } else {
      const prevT = points[i - 1].t;
      xParts.push(`if(between(t\\,${prevT.toFixed(2)}\\,${t.toFixed(2)})\\,${cx.toFixed(1)}`);
      yParts.push(`if(between(t\\,${prevT.toFixed(2)}\\,${t.toFixed(2)})\\,${cy.toFixed(1)}`);
    }
  }

  const lastCx = points[points.length - 1].offset.cropX;
  const lastCy = points[points.length - 1].offset.cropY;

  const xExpr = xParts.join(",") + `,${lastCx.toFixed(1)}` + ")".repeat(points.length);
  const yExpr = yParts.join(",") + `,${lastCy.toFixed(1)}` + ")".repeat(points.length);

  return `crop=${cw}:${ch}:${xExpr}:${yExpr}`;
}

function buildSimpleCrop(srcW, srcH, targetAspect, trajectory) {
  let avgX = srcW / 2;
  let avgY = srcH / 2;
  let weightSum = 0;

  if (trajectory && trajectory.length > 0) {
    for (const p of trajectory) {
      const w = p.confidence || 1;
      avgX += (p.x - avgX) * w / (weightSum + w);
      avgY += (p.y - avgY) * w / (weightSum + w);
      weightSum += w;
    }
  }

  let cw, ch;
  if (targetAspect === "9:16") {
    ch = srcH;
    cw = Math.round(srcH * (9 / 16));
  } else if (targetAspect === "16:9") {
    cw = srcW;
    ch = Math.round(srcW * (9 / 16));
  } else {
    const s = Math.min(srcW, srcH);
    cw = s;
    ch = s;
  }

  let cx = Math.round(avgX - cw / 2);
  let cy = Math.round(avgY - ch / 2);
  cx = Math.max(0, Math.min(cx, srcW - cw));
  cy = Math.max(0, Math.min(cy, srcH - ch));

  return `crop=${cw}:${ch}:${cx}:${cy}`;
}

export async function autoReframe(inputPath, outputPath, targetAspect = "9:16", trajectory = null, _plan = "free") {
  const start = Date.now();

  try {
    const dims = await getVideoDimensions(inputPath);
    console.log(`[AutoReframe] Source: ${dims.width}x${dims.height}, target: ${targetAspect}`);

    const srcAspect = dims.width / dims.height;
    const isTargetLandscape = targetAspect === "16:9";
    const targetRatio = isTargetLandscape ? 16 / 9 : 9 / 16;
    const srcMatchesTarget = Math.abs(srcAspect - targetRatio) < 0.02;

    if (srcMatchesTarget) {
      console.log(`[AutoReframe] Source already matches ${targetAspect}, copying as-is`);
      fs.copyFileSync(inputPath, outputPath);
      const elapsed = Date.now() - start;
      console.log(`[AutoReframe] Done in ${(elapsed / 1000).toFixed(1)}s (skipped, already target aspect)`);
      return { success: true, processingTimeMs: elapsed };
    }

    let cropFilter;
    if (trajectory && trajectory.length > 2) {
      cropFilter = buildCropExpression(trajectory, dims.width, dims.height, targetAspect);
    } else {
      cropFilter = buildSimpleCrop(dims.width, dims.height, targetAspect, trajectory);
    }

    console.log(`[AutoReframe] Crop: ${cropFilter}`);

    const scaleFilter = targetAspect === "9:16"
      ? "scale=1080:1920:force_original_aspect_ratio=decrease"
      : targetAspect === "16:9"
        ? "scale=1920:1080:force_original_aspect_ratio=decrease"
        : "scale=1080:1080:force_original_aspect_ratio=decrease";

    await runFFmpeg([
      "-i", inputPath,
      "-vf", `${cropFilter},${scaleFilter}`,
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-c:a", "copy",
      "-movflags", "+faststart",
      outputPath,
    ], 120000);

    const elapsed = Date.now() - start;
    console.log(`[AutoReframe] Done in ${(elapsed / 1000).toFixed(1)}s`);
    return { success: true, processingTimeMs: elapsed };
  } catch (err) {
    console.warn(`[AutoReframe] Failed: ${err.message} — using original clip`);
    try {
      if (!fs.existsSync(outputPath)) fs.copyFileSync(inputPath, outputPath);
    } catch { /* ignore */ }
    return { success: false, error: err.message };
  }
}
