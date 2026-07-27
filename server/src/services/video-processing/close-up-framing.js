import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import config from "../../config/env.js";

const FRAMING_MODES = {
  closeup: { faceRatio: 0.75, headroom: 0.12, label: "Close-Up" },
  medium:  { faceRatio: 0.45, headroom: 0.15, label: "Medium" },
  wide:    { faceRatio: 0.25, headroom: 0.18, label: "Wide" },
};

const PLAN_FRAMING = {
  free:      { maxFaces: 1, sampleFps: 1,   smoothing: 0.25, punchIn: false },
  starter:   { maxFaces: 2, sampleFps: 1.5, smoothing: 0.3,  punchIn: false },
  creator:   { maxFaces: 3, sampleFps: 2,   smoothing: 0.35, punchIn: true },
  pro:       { maxFaces: 4, sampleFps: 3,   smoothing: 0.4,  punchIn: true },
  business:  { maxFaces: 4, sampleFps: 3,   smoothing: 0.4,  punchIn: true },
};

function getPlanConfig(plan) {
  return PLAN_FRAMING[plan] || PLAN_FRAMING.free;
}

function runFFmpeg(args, timeoutMs = 180000) {
  return new Promise((resolve, reject) => {
    const proc = spawn(config.video.ffmpegPath, ["-y", ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      try { proc.kill("SIGKILL"); } catch {}
      reject(new Error(`FFmpeg close-up framing timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (killed) return;
      if (code === 0) resolve({ success: true });
      else reject(new Error(`FFmpeg exited ${code}: ${stderr.slice(0, 400)}`));
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`FFmpeg error: ${err.message}`));
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
      if (match) resolve({ width: parseInt(match[1], 10), height: parseInt(match[2], 10) });
      else resolve({ width: 1920, height: 1080 });
    });
    ff.on("error", () => resolve({ width: 1920, height: 1080 }));
  });
}

async function extractFrames(inputPath, outputDir, fps, gridW = 60, gridH = 30) {
  const pattern = path.join(outputDir, "cuframe_%04d.jpg");
  await new Promise((resolve, reject) => {
    const ffmpeg = spawn(config.video.ffmpegPath, [
      "-y", "-i", inputPath,
      "-vf", `fps=${fps},scale=${gridW}:${gridH}`,
      "-q:v", "8",
      pattern,
    ]);
    let stderr = "";
    const timer = setTimeout(() => {
      try { ffmpeg.kill("SIGKILL"); } catch {}
      reject(new Error("Frame extraction timed out"));
    }, 120000);
    ffmpeg.stderr.on("data", (d) => { stderr += d.toString(); });
    ffmpeg.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`Frame extraction failed (code ${code}): ${stderr.slice(0, 300)}`));
    });
    ffmpeg.on("error", reject);
  });

  return fs.readdirSync(outputDir)
    .filter((f) => f.startsWith("cuframe_") && f.endsWith(".jpg"))
    .sort()
    .map((f) => path.join(outputDir, f));
}

export async function detectFaces(framePath, gridSize = 10) {
  const metadata = await sharp(framePath).metadata();
  const srcW = metadata.width || 320;
  const srcH = metadata.height || 180;

  const resized = await sharp(framePath)
    .resize(gridSize * 6, gridSize * 3, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer();

  const cellW = gridSize * 6;
  const cellH = gridSize * 3;
  const regions = [];

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const startX = gx * 6;
      const startY = gy * 3;
      let sum = 0;
      let count = 0;
      const pixelValues = [];

      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 6; dx++) {
          const px = startX + dx;
          const py = startY + dy;
          if (px < cellW && py < cellH) {
            const val = resized[py * cellW + px];
            sum += val;
            count++;
            pixelValues.push(val);
          }
        }
      }

      const avgBrightness = count > 0 ? sum / count : 128;
      const centerX = ((gx + 0.5) / gridSize) * srcW;
      const centerY = ((gy + 0.5) / gridSize) * srcH;

      const mean = pixelValues.length > 0
        ? pixelValues.reduce((a, b) => a + b, 0) / pixelValues.length
        : 0;
      const variance = pixelValues.length > 0
        ? pixelValues.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / pixelValues.length
        : 0;
      const contrast = Math.sqrt(variance);

      const brightnessScore = avgBrightness > 100 && avgBrightness < 220
        ? (220 - Math.abs(avgBrightness - 160)) * 0.3
        : 0;

      const contrastScore = contrast > 15 ? contrast * 0.5 : 0;

      const regionW = srcW / gridSize;
      const regionH = srcH / gridSize;
      const aspectRatio = regionW / regionH;
      const shapeScore = Math.abs(aspectRatio - 0.8) < 0.4 ? 15 : 0;

      const yPosition = centerY / srcH;
      const upperBodyScore = (yPosition > 0.15 && yPosition < 0.75) ? 20 : 5;

      const totalScore = brightnessScore + contrastScore + shapeScore + upperBodyScore;

      if (totalScore > 25) {
        regions.push({
          x: centerX,
          y: centerY,
          w: srcW / gridSize * 2,
          h: srcH / gridSize * 2,
          score: totalScore,
          brightness: avgBrightness,
          contrast,
          gx, gy,
        });
      }
    }
  }

  regions.sort((a, b) => b.score - a.score);

  const faces = [];
  const minDistance = Math.min(srcW, srcH) * 0.15;

  for (const region of regions) {
    if (faces.length >= 4) break;

    const tooClose = faces.some(
      (f) => Math.hypot(f.x - region.x, f.y - region.y) < minDistance
    );
    if (tooClose) continue;

    faces.push({
      x: region.x,
      y: region.y,
      w: region.w * 1.5,
      h: region.h * 1.5,
      confidence: Math.min(1, region.score / 80),
    });
  }

  if (faces.length === 0) {
    faces.push({
      x: srcW / 2,
      y: srcH * 0.4,
      w: srcW * 0.3,
      h: srcH * 0.3,
      confidence: 0.1,
    });
  }

  return {
    faces,
    srcWidth: srcW,
    srcHeight: srcH,
  };
}

export function detectSpeakerChange(prevFaces, currFaces, prevTimestamp, currTimestamp) {
  if (!prevFaces || prevFaces.length === 0 || currFaces.length === 0) {
    return { speakerIndex: 0, confidence: 0, changed: false };
  }

  let maxMotion = 0;
  let motionIndex = 0;

  for (let i = 0; i < currFaces.length; i++) {
    const curr = currFaces[i];
    let bestMatchDist = Infinity;

    for (let j = 0; j < prevFaces.length; j++) {
      const prev = prevFaces[j];
      const dist = Math.hypot(curr.x - prev.x, curr.y - prev.y);
        if (dist < bestMatchDist) {
          bestMatchDist = dist;
        }
    }

    const motion = bestMatchDist > 0 ? bestMatchDist : 0;
    if (motion > maxMotion) {
      maxMotion = motion;
      motionIndex = i;
    }
  }

  const timeDelta = currTimestamp - prevTimestamp;
  const motionRate = timeDelta > 0 ? maxMotion / timeDelta : 0;
  const changed = motionRate > 50 && maxMotion > 20;

  return {
    speakerIndex: changed ? motionIndex : 0,
    confidence: Math.min(1, motionRate / 200),
    changed,
  };
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutQuad(t) {
  return 1 - (1 - t) * (1 - t);
}

function generateSmoothTrajectory(facesPerFrame, timestamps, fps, srcW, srcH, mode, planCfg) {
  const framingMode = FRAMING_MODES[mode] || FRAMING_MODES.closeup;
  const faceRatio = framingMode.faceRatio;
  const headroom = framingMode.headroom;

  const targetAspect = 9 / 16;

  let targetCropW = Math.round(srcH * targetAspect);

  if (targetCropW > srcW) {
    targetCropW = srcW;
  }

  const rawTrajectory = [];

  for (let i = 0; i < facesPerFrame.length; i++) {
    const frameFaces = facesPerFrame[i];
    const t = timestamps[i] || 0;

    let primaryFace;
    if (frameFaces.length > 0) {
      primaryFace = frameFaces.reduce((best, f) =>
        f.confidence > best.confidence ? f : best
      , frameFaces[0]);
    } else {
      primaryFace = { x: srcW / 2, y: srcH * 0.4, confidence: 0.1 };
    }

    const faceSize = Math.max(primaryFace.w || srcW * 0.2, primaryFace.h || srcH * 0.2);
    const desiredCropW = Math.round(faceSize / faceRatio);
    const actualCropW = Math.min(Math.max(desiredCropW, targetCropW * 0.6), Math.round(srcW * 0.95));
    const actualCropH = Math.min(Math.round(actualCropW / targetAspect), srcH);

    const faceTopY = primaryFace.y - (primaryFace.h || faceSize) * 0.3;
    const headroomPixels = actualCropH * headroom;

    let cropX = Math.round(primaryFace.x - actualCropW / 2);
    let cropY = Math.round(faceTopY - headroomPixels);

    const minY = Math.max(0, Math.round(srcH * 0.02));
    const maxY = Math.min(srcH - actualCropH, Math.round(srcH * 0.98));
    cropY = Math.max(minY, Math.min(cropY, maxY));
    cropX = Math.max(0, Math.min(cropX, srcW - actualCropW));

    rawTrajectory.push({
      timestamp: t,
      cropX,
      cropY,
      cropW: actualCropW,
      cropH: actualCropH,
      confidence: primaryFace.confidence || 0.1,
    });
  }

  if (rawTrajectory.length <= 1) return rawTrajectory;

  const alpha = planCfg.smoothing;
  const smoothed = [rawTrajectory[0]];

  for (let i = 1; i < rawTrajectory.length; i++) {
    const prev = smoothed[i - 1];
    const curr = rawTrajectory[i];

    const easedAlpha = alpha * easeInOutCubic(Math.min(1, i / 5));

    smoothed.push({
      timestamp: curr.timestamp,
      cropX: Math.round(easedAlpha * curr.cropX + (1 - easedAlpha) * prev.cropX),
      cropY: Math.round(easedAlpha * curr.cropY + (1 - easedAlpha) * prev.cropY),
      cropW: Math.round(easedAlpha * curr.cropW + (1 - easedAlpha) * prev.cropW),
      cropH: Math.round(easedAlpha * curr.cropH + (1 - easedAlpha) * prev.cropH),
      confidence: curr.confidence,
    });
  }

  return smoothed;
}

function detectPunchInMoments(trajectory, emphasisMap, segments, clipStart, duration) {
  if (!trajectory || trajectory.length < 3) return [];

  const moments = [];
  const emphasisTimestamps = new Set();

  if (emphasisMap && segments) {
    segments.forEach((seg, idx) => {
      const emph = emphasisMap[idx];
      if (emph && emph.length > 0) {
        const avgLevel = emph.reduce((s, e) => s + (e.level || 1), 0) / emph.length;
        if (avgLevel >= 2) {
          const segStart = Math.max(0, seg.start - clipStart);
          const segEnd = Math.min(duration, seg.end - clipStart);
          const midPoint = (segStart + segEnd) / 2;
          emphasisTimestamps.add(midPoint);
        }
      }
    });
  }

  for (const t of emphasisTimestamps) {
    const nearby = trajectory.filter((p) => Math.abs(p.timestamp - t) < 2);
    if (nearby.length === 0) continue;

    const avgConfidence = nearby.reduce((s, p) => s + p.confidence, 0) / nearby.length;
    if (avgConfidence < 0.3) continue;

    moments.push({
      center: t,
      startTime: Math.max(0, t - 0.8),
      endTime: Math.min(duration, t + 0.8),
      peakScale: 1.05 + Math.min(0.07, avgConfidence * 0.08),
    });
  }

  if (trajectory.length > 10) {
    const segmentSize = Math.floor(trajectory.length / 5);
    for (let s = 0; s < 5; s++) {
      const segment = trajectory.slice(s * segmentSize, (s + 1) * segmentSize);
      const avgConf = segment.reduce((sum, p) => sum + p.confidence, 0) / segment.length;
      if (avgConf > 0.6 && !moments.some((m) => Math.abs(m.center - segment[Math.floor(segment.length / 2)].timestamp) < 3)) {
        const midT = segment[Math.floor(segment.length / 2)].timestamp;
        moments.push({
          center: midT,
          startTime: Math.max(0, midT - 0.6),
          endTime: Math.min(duration, midT + 0.6),
          peakScale: 1.03,
        });
      }
    }
  }

  return moments.sort((a, b) => a.center - b.center);
}

function buildSmoothCropFilter(trajectory, punchInMoments, srcW, srcH) {
  if (!trajectory || trajectory.length === 0) {
    const cw = Math.round(srcH * (9 / 16));
    return `crop=${cw}:${srcH}:${Math.round((srcW - cw) / 2)}:0`;
  }

  if (trajectory.length === 1) {
    const p = trajectory[0];
    return `crop=${p.cropW}:${p.cropH}:${p.cropX}:${p.cropY}`;
  }

  const MAX_KEYFRAMES = 5;
  const keyframes = [];
  const step = Math.max(1, Math.floor(trajectory.length / MAX_KEYFRAMES));
  for (let i = 0; i < trajectory.length; i += step) {
    keyframes.push(trajectory[i]);
  }
  const last = trajectory[trajectory.length - 1];
  if (keyframes[keyframes.length - 1] !== last) {
    keyframes.push(last);
  }

  const effective = keyframes.map((kf) => {
    let scaleX = 1;
    if (punchInMoments?.length > 0) {
      for (const pm of punchInMoments) {
        if (kf.timestamp >= pm.startTime && kf.timestamp <= pm.endTime) {
          const progress = (kf.timestamp - pm.startTime) / (pm.endTime - pm.startTime);
          const eased = progress < 0.5
            ? easeOutQuad(progress * 2)
            : easeOutQuad((1 - progress) * 2);
          scaleX = Math.max(scaleX, 1 + (pm.peakScale - 1) * eased);
        }
      }
    }

    const cropW = Math.round(kf.cropW / scaleX);
    const cropH = Math.round(kf.cropH / scaleX);
    const cropX = Math.max(0, Math.min(
      Math.round(kf.cropX + (kf.cropW - cropW) / 2),
      srcW - cropW
    ));
    const cropY = Math.max(0, Math.min(
      Math.round(kf.cropY + (kf.cropH - cropH) / 2),
      srcH - cropH
    ));
    return { t: kf.timestamp, x: cropX, y: cropY, w: cropW, h: cropH };
  });

  let wExpr = `${effective[effective.length - 1].w.toFixed(1)}`;
  for (let i = effective.length - 1; i >= 1; i--) {
    const prev = effective[i - 1];
    const curr = effective[i];
    const dt = Math.max(0.01, curr.t - prev.t);
    wExpr = `if(between(t\\,${prev.t.toFixed(2)}\\,${curr.t.toFixed(2)})\\,${prev.w.toFixed(1)}+(${curr.w.toFixed(1)}-${prev.w.toFixed(1)})*min(1\\,(t-${prev.t.toFixed(2)})/${dt.toFixed(2)})\\,${wExpr})`;
  }

  let hExpr = `${effective[effective.length - 1].h.toFixed(1)}`;
  for (let i = effective.length - 1; i >= 1; i--) {
    const prev = effective[i - 1];
    const curr = effective[i];
    const dt = Math.max(0.01, curr.t - prev.t);
    hExpr = `if(between(t\\,${prev.t.toFixed(2)}\\,${curr.t.toFixed(2)})\\,${prev.h.toFixed(1)}+(${curr.h.toFixed(1)}-${prev.h.toFixed(1)})*min(1\\,(t-${prev.t.toFixed(2)})/${dt.toFixed(2)})\\,${hExpr})`;
  }

  let xExpr = `${effective[effective.length - 1].x.toFixed(1)}`;
  for (let i = effective.length - 1; i >= 1; i--) {
    const prev = effective[i - 1];
    const curr = effective[i];
    const dt = Math.max(0.01, curr.t - prev.t);
    xExpr = `if(between(t\\,${prev.t.toFixed(2)}\\,${curr.t.toFixed(2)})\\,${prev.x.toFixed(1)}+(${curr.x.toFixed(1)}-${prev.x.toFixed(1)})*min(1\\,(t-${prev.t.toFixed(2)})/${dt.toFixed(2)})\\,${xExpr})`;
  }

  let yExpr = `${effective[effective.length - 1].y.toFixed(1)}`;
  for (let i = effective.length - 1; i >= 1; i--) {
    const prev = effective[i - 1];
    const curr = effective[i];
    const dt = Math.max(0.01, curr.t - prev.t);
    yExpr = `if(between(t\\,${prev.t.toFixed(2)}\\,${curr.t.toFixed(2)})\\,${prev.y.toFixed(1)}+(${curr.y.toFixed(1)}-${prev.y.toFixed(1)})*min(1\\,(t-${prev.t.toFixed(2)})/${dt.toFixed(2)})\\,${yExpr})`;
  }

  return `crop=${wExpr}:${hExpr}:${xExpr}:${yExpr}`;
}

export async function applyCloseUpFraming(inputPath, outputPath, options) {
  const start = Date.now();
  const {
    mode = "closeup",
    autoPunchIn = false,
    plan = "free",
    duration = 30,
    emphasisMap = null,
    segments = null,
    clipStart = 0,
  } = options;

  const planCfg = getPlanConfig(plan);
  const tmpDir = path.join(process.cwd(), "temp", `cu_${Date.now()}`);

  try {
    fs.mkdirSync(tmpDir, { recursive: true });

    const dims = await getVideoDimensions(inputPath);
    console.log(`[CloseUp] Source: ${dims.width}x${dims.height}, mode: ${mode}, plan: ${plan}`);

    const fps = Math.min(planCfg.sampleFps, 3);
    console.log(`[CloseUp] Extracting frames at ${fps}fps...`);
    const frames = await extractFrames(inputPath, tmpDir, fps);
    console.log(`[CloseUp] Extracted ${frames.length} frames`);

    const facesPerFrame = [];
    const timestamps = [];

    const gridSize = 10;
    const CONCURRENCY = 15;
    const fallback = { x: dims.width / 2, y: dims.height * 0.4, w: dims.width * 0.2, h: dims.height * 0.2, confidence: 0.1 };

    for (let batch = 0; batch < frames.length; batch += CONCURRENCY) {
      const chunk = frames.slice(batch, batch + CONCURRENCY);
      const results = await Promise.all(chunk.map(async (framePath, idx) => {
        const i = batch + idx;
        try {
          const result = await detectFrames(framePath, gridSize, dims.width, dims.height);
          return { faces: result.faces, ts: i / fps };
        } catch {
          return { faces: [fallback], ts: i / fps };
        }
      }));
      for (const r of results) {
        facesPerFrame.push(r.faces);
        timestamps.push(r.ts);
      }
    }

    console.log(`[CloseUp] Detected faces in ${facesPerFrame.length} frames`);

    let trajectory = generateSmoothTrajectory(
      facesPerFrame, timestamps, fps, dims.width, dims.height, mode, planCfg
    );

    let punchInMoments = [];
    if (autoPunchIn && planCfg.punchIn) {
      punchInMoments = detectPunchInMoments(trajectory, emphasisMap, segments, clipStart, duration);
      console.log(`[CloseUp] Detected ${punchInMoments.length} punch-in moments`);
    }

    const cropFilter = buildSmoothCropFilter(trajectory, punchInMoments, dims.width, dims.height);
    console.log(`[CloseUp] Crop filter: ${cropFilter.slice(0, 120)}...`);

    const outW = 1080;
    const outH = 1920;
    const scaleFilter = `scale=${outW}:${outH}:force_original_aspect_ratio=decrease,pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2:black`;

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
    ], 300000);

    const elapsed = Date.now() - start;
    console.log(`[CloseUp] Done in ${(elapsed / 1000).toFixed(1)}s`);
    return {
      success: true,
      processingTimeMs: elapsed,
      mode,
      punchInMoments: punchInMoments.length,
      framesTracked: trajectory.length,
    };
  } catch (err) {
    console.warn(`[CloseUp] Failed: ${err.message} — using original clip`);
    try {
      if (!fs.existsSync(outputPath)) fs.copyFileSync(inputPath, outputPath);
    } catch { /* ignore */ }
    return { success: false, error: err.message };
  } finally {
    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } catch {}
  }
}

async function detectFrames(framePath, gridSize, srcW, srcH) {
  const resized = await sharp(framePath)
    .greyscale()
    .raw()
    .toBuffer();

  const cellW = gridSize * 6;
  const cellH = gridSize * 3;
  const regions = [];

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const startX = gx * 6;
      const startY = gy * 3;
      let sum = 0;
      let count = 0;

      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 6; dx++) {
          const px = startX + dx;
          const py = startY + dy;
          if (px < cellW && py < cellH) {
            sum += resized[py * cellW + px];
            count++;
          }
        }
      }

      const avgBrightness = count > 0 ? sum / count : 128;
      const centerX = ((gx + 0.5) / gridSize) * srcW;
      const centerY = ((gy + 0.5) / gridSize) * srcH;
      const regionW = srcW / gridSize;
      const regionH = srcH / gridSize;

      const pixelValues = [];
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 6; dx++) {
          const px = startX + dx;
          const py = startY + dy;
          if (px < cellW && py < cellH) {
            pixelValues.push(resized[py * cellW + px]);
          }
        }
      }
      const mean = pixelValues.length > 0
        ? pixelValues.reduce((a, b) => a + b, 0) / pixelValues.length : 0;
      const variance = pixelValues.length > 0
        ? pixelValues.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / pixelValues.length : 0;
      const contrast = Math.sqrt(variance);

      const brightnessScore = avgBrightness > 100 && avgBrightness < 220
        ? (220 - Math.abs(avgBrightness - 160)) * 0.3 : 0;
      const contrastScore = contrast > 15 ? contrast * 0.5 : 0;
      const aspectRatio = regionW / regionH;
      const shapeScore = Math.abs(aspectRatio - 0.8) < 0.4 ? 15 : 0;
      const yPosition = centerY / srcH;
      const upperBodyScore = (yPosition > 0.15 && yPosition < 0.75) ? 20 : 5;

      const totalScore = brightnessScore + contrastScore + shapeScore + upperBodyScore;

      if (totalScore > 25) {
        regions.push({
          x: centerX,
          y: centerY,
          w: regionW * 2,
          h: regionH * 2,
          score: totalScore,
          confidence: Math.min(1, totalScore / 80),
        });
      }
    }
  }

  regions.sort((a, b) => b.score - a.score);

  const faces = [];
  const minDistance = Math.min(srcW, srcH) * 0.15;

  for (const region of regions) {
    if (faces.length >= 4) break;
    const tooClose = faces.some(
      (f) => Math.hypot(f.x - region.x, f.y - region.y) < minDistance
    );
    if (tooClose) continue;
    faces.push({
      x: region.x,
      y: region.y,
      w: region.w * 1.5,
      h: region.h * 1.5,
      confidence: region.confidence,
    });
  }

  if (faces.length === 0) {
    faces.push({
      x: srcW / 2,
      y: srcH * 0.4,
      w: srcW * 0.3,
      h: srcH * 0.3,
      confidence: 0.1,
    });
  }

  return { faces, srcWidth: srcW, srcHeight: srcH };
}

export { FRAMING_MODES };
