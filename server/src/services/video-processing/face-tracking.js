import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import config from "../../config/env.js";

const PLAN_CONFIG = {
  free:     { gridSize: 4, sampleFps: 0.5, smoothingAlpha: 0.2 },
  starter:  { gridSize: 6, sampleFps: 1,   smoothingAlpha: 0.3 },
  creator:  { gridSize: 8, sampleFps: 2,   smoothingAlpha: 0.4 },
  pro:      { gridSize: 10, sampleFps: 3,  smoothingAlpha: 0.5 },
  business: { gridSize: 10, sampleFps: 3,  smoothingAlpha: 0.5 },
};

function getPlanConfig(plan) {
  return PLAN_CONFIG[plan] || PLAN_CONFIG.free;
}

async function extractFrames(inputPath, outputDir, fps) {
  const pattern = path.join(outputDir, "frame_%04d.png");
  await new Promise((resolve, reject) => {
    const ffmpeg = spawn(config.video.ffmpegPath, [
      "-y", "-i", inputPath,
      "-vf", `fps=${fps}`,
      "-q:v", "5",
      pattern,
    ]);
    let stderr = "";
    const timer = setTimeout(() => {
      try { ffmpeg.kill("SIGKILL"); } catch {}
      reject(new Error("Frame extraction timed out"));
    }, 60000);
    ffmpeg.stderr.on("data", (d) => { stderr += d.toString(); });
    ffmpeg.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`Frame extraction failed (code ${code}): ${stderr.slice(0, 200)}`));
    });
    ffmpeg.on("error", reject);
  });

  const files = fs.readdirSync(outputDir)
    .filter((f) => f.startsWith("frame_") && f.endsWith(".png"))
    .sort();
  return files.map((f) => path.join(outputDir, f));
}

async function analyzeFrameBrightness(framePath, gridSize) {
  const metadata = await sharp(framePath).metadata();
  const w = metadata.width || 320;
  const h = metadata.height || 180;

  const resized = await sharp(framePath)
    .resize(gridSize * 4, gridSize * 2, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer();

  const cellW = gridSize * 4;
  const regions = [];

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      let sum = 0;
      let count = 0;
      const startX = gx * 4;
      const startY = gy * 2;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 4; dx++) {
          const px = startX + dx;
          const py = startY + dy;
          if (px < cellW && py < resized.length / cellW) {
            sum += resized[py * cellW + px];
            count++;
          }
        }
      }
      const avgBrightness = count > 0 ? sum / count : 128;
      const centerX = ((gx + 0.5) / gridSize);
      const centerY = ((gy + 0.5) / gridSize);
      const distFromCenter = Math.sqrt(
        Math.pow(centerX - 0.5, 2) + Math.pow(centerY - 0.5, 2)
      );
      const centerWeight = 1 + (1 - distFromCenter) * 2;

      const contrastSum = [];
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 4; dx++) {
          const px = startX + dx;
          const py = startY + dy;
          if (px < cellW && py < resized.length / cellW) {
            contrastSum.push(resized[py * cellW + px]);
          }
        }
      }
      const mean = contrastSum.length > 0 ? contrastSum.reduce((a, b) => a + b, 0) / contrastSum.length : 0;
      const variance = contrastSum.length > 0
        ? contrastSum.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / contrastSum.length
        : 0;
      const contrast = Math.sqrt(variance);

      const score = (contrast * 0.6 + (255 - avgBrightness) * 0.4) * centerWeight;

      regions.push({
        x: (gx / gridSize) * w,
        y: (gy / gridSize) * h,
        w: w / gridSize,
        h: h / gridSize,
        score,
        brightness: avgBrightness,
        contrast,
      });
    }
  }

  regions.sort((a, b) => b.score - a.score);
  const top = regions.slice(0, Math.ceil(gridSize * gridSize * 0.25));
  let weightedX = 0;
  let weightedY = 0;
  let totalWeight = 0;
  for (const r of top) {
    weightedX += (r.x + r.w / 2) * r.score;
    weightedY += (r.y + r.h / 2) * r.score;
    totalWeight += r.score;
  }

  if (totalWeight === 0) return { x: w / 2, y: h / 2, w, h, confidence: 0 };

  return {
    x: weightedX / totalWeight,
    y: weightedY / totalWeight,
    w,
    h,
    confidence: Math.min(1, totalWeight / 1000),
  };
}

function smoothTrajectory(trajectory, alpha) {
  if (trajectory.length === 0) return trajectory;
  const smoothed = [trajectory[0]];
  for (let i = 1; i < trajectory.length; i++) {
    const prev = smoothed[i - 1];
    const curr = trajectory[i];
    smoothed.push({
      x: alpha * curr.x + (1 - alpha) * prev.x,
      y: alpha * curr.y + (1 - alpha) * prev.y,
      w: curr.w,
      h: curr.h,
      confidence: curr.confidence,
      frameIndex: curr.frameIndex,
      timestamp: curr.timestamp,
    });
  }
  return smoothed;
}

export async function trackSubjects(inputPath, durationSeconds, plan = "free") {
  const start = Date.now();
  const cfg = getPlanConfig(plan);
  const tmpDir = path.join(process.cwd(), "temp", `ft_${Date.now()}`);

  try {
    fs.mkdirSync(tmpDir, { recursive: true });

    const fps = Math.min(cfg.sampleFps, 3);
    console.log(`[FaceTrack] Extracting frames at ${fps}fps for ${durationSeconds}s clip...`);

    const frames = await extractFrames(inputPath, tmpDir, fps);
    console.log(`[FaceTrack] Extracted ${frames.length} frames, analyzing...`);

    const trajectory = [];
    for (let i = 0; i < frames.length; i++) {
      try {
        const detection = await analyzeFrameBrightness(frames[i], cfg.gridSize);
        trajectory.push({
          ...detection,
          frameIndex: i,
          timestamp: i / fps,
        });
      } catch {
        trajectory.push({
          x: 0, y: 0, w: 1920, h: 1080,
          confidence: 0, frameIndex: i, timestamp: i / fps,
        });
      }
    }

    const smoothed = smoothTrajectory(trajectory, cfg.smoothingAlpha);

    const elapsed = Date.now() - start;
    console.log(`[FaceTrack] Done in ${(elapsed / 1000).toFixed(1)}s — ${smoothed.length} frames tracked`);
    return { trajectory: smoothed, duration: durationSeconds, processingTimeMs: elapsed };
  } catch (err) {
    console.warn(`[FaceTrack] Failed: ${err.message} — using center fallback`);
    return {
      trajectory: [{ x: 960, y: 540, w: 1920, h: 1080, confidence: 0, frameIndex: 0, timestamp: 0 }],
      duration: durationSeconds,
      processingTimeMs: Date.now() - start,
      error: err.message,
    };
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

export function getReframeOffset(trajectory, timestamp, targetAspect) {
  if (!trajectory || trajectory.length === 0) {
    return { cropX: 0, cropY: 0, cropW: 1920, cropH: 1080 };
  }

  let closest = trajectory[0];
  let minDist = Math.abs(timestamp - (closest.timestamp || 0));
  for (const point of trajectory) {
    const dist = Math.abs(timestamp - (point.timestamp || 0));
    if (dist < minDist) {
      minDist = dist;
      closest = point;
    }
  }

  const srcW = closest.w || 1920;
  const srcH = closest.h || 1080;

  let cropW, cropH;
  if (targetAspect === "9:16") {
    cropH = srcH;
    cropW = Math.round(srcH * (9 / 16));
  } else if (targetAspect === "16:9") {
    cropW = srcW;
    cropH = Math.round(srcW * (9 / 16));
  } else {
    const s = Math.min(srcW, srcH);
    cropW = s;
    cropH = s;
  }

  let cropX = Math.round(closest.x - cropW / 2);
  let cropY = Math.round(closest.y - cropH / 2);
  cropX = Math.max(0, Math.min(cropX, srcW - cropW));
  cropY = Math.max(0, Math.min(cropY, srcH - cropH));

  return { cropX, cropY, cropW, cropH };
}
