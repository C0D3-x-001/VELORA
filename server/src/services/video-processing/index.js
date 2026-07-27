import path from "path";
import fs from "fs";
import { stabilizeClip } from "./stabilization.js";
import { trackSubjects } from "./face-tracking.js";
import { autoReframe } from "./auto-reframe.js";
import { applyCloseUpFraming } from "./close-up-framing.js";

function tempPath(base, suffix) {
  const dir = path.dirname(base);
  const ext = path.extname(base);
  const name = path.basename(base, ext);
  return path.join(dir, `${name}_${suffix}${ext}`);
}

export async function applyVideoEnhancements(clipPath, outputDir, options) {
  const {
    stabilization = true,
    faceTracking = true,
    autoReframe: doAutoReframe = true,
    closeUpFraming = false,
    closeUpMode = "closeup",
    autoPunchIn = false,
    autoSpeakerSwitch = true,
    plan = "free",
    platform = "vertical",
    duration = 30,
    emphasisMap = null,
    segments = null,
    clipStart = 0,
  } = options;

  const isVerticalTarget = platform === "vertical";
  let currentPath = clipPath;
  const result = {
    finalPath: clipPath,
    trajectory: null,
    enhancements: { stabilization: false, faceTracking: false, autoReframe: false, closeUpFraming: false },
  };

  const tempFiles = [];

  try {
    if (stabilization) {
      const stabPath = tempPath(path.join(outputDir, `enhanced_stab_${Date.now()}.mp4`), "stab");
      tempFiles.push(stabPath);
      console.log(`[Enhance] Running stabilization...`);
      const stabResult = await stabilizeClip(currentPath, stabPath, plan);
      if (stabResult.success && fs.existsSync(stabPath)) {
        currentPath = stabPath;
        result.enhancements.stabilization = true;
        console.log(`[Enhance] Stabilization applied`);
      } else {
        console.warn(`[Enhance] Stabilization skipped: ${stabResult.error || "failed"}`);
      }
    }

    if (closeUpFraming && isVerticalTarget) {
      const cuPath = tempPath(path.join(outputDir, `enhanced_closeup_${Date.now()}.mp4`), "closeup");
      tempFiles.push(cuPath);
      console.log(`[Enhance] Running AI close-up framing (mode: ${closeUpMode})...`);
      const cuResult = await applyCloseUpFraming(currentPath, cuPath, {
        mode: closeUpMode,
        autoPunchIn,
        autoSpeakerSwitch,
        plan,
        duration,
        emphasisMap,
        segments,
        clipStart,
      });
      if (cuResult.success && fs.existsSync(cuPath)) {
        currentPath = cuPath;
        result.enhancements.closeUpFraming = true;
        console.log(`[Enhance] Close-up framing applied (${cuResult.framesTracked} frames, ${cuResult.punchInMoments} punch-ins)`);
      } else {
        console.warn(`[Enhance] Close-up framing skipped: ${cuResult.error || "failed"}`);
      }
    } else if (faceTracking || (doAutoReframe && isVerticalTarget)) {
      console.log(`[Enhance] Running face tracking analysis...`);
      const trackingResult = await trackSubjects(currentPath, duration, plan);
      result.trajectory = trackingResult.trajectory;
      result.enhancements.faceTracking = true;
      console.log(`[Enhance] Face tracking complete`);
    }

    if (doAutoReframe && isVerticalTarget && !closeUpFraming) {
      const reframePath = tempPath(path.join(outputDir, `enhanced_reframe_${Date.now()}.mp4`), "reframe");
      tempFiles.push(reframePath);
      console.log(`[Enhance] Auto-reframing for vertical...`);
      const reframeResult = await autoReframe(currentPath, reframePath, "9:16", result.trajectory, plan);
      if (reframeResult.success && fs.existsSync(reframePath)) {
        currentPath = reframePath;
        result.enhancements.autoReframe = true;
        console.log(`[Enhance] Auto-reframe applied`);
      } else {
        console.warn(`[Enhance] Auto-reframe skipped: ${reframeResult.error || "failed"}`);
      }
    }

    result.finalPath = currentPath;
    return result;
  } finally {
    for (const f of tempFiles) {
      if (f !== currentPath && f !== clipPath) {
        try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
      }
    }
  }
}

export { stabilizeClip } from "./stabilization.js";
export { trackSubjects, getReframeOffset } from "./face-tracking.js";
export { autoReframe } from "./auto-reframe.js";
export { applyCloseUpFraming } from "./close-up-framing.js";
