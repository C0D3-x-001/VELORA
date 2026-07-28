import fs from "fs";
import path from "path";
import { supabaseAdmin } from "../../config/supabase.js";
import { analyzeClip } from "./analyzer.js";
import { getEditingInstructions } from "./editor.js";
import { renderEditedClip } from "./renderer.js";
import { exportResult, cleanupTempFiles } from "./exporter.js";

const activeJobs = new Map();

export async function editClip(projectId, clipId, userId, settings = {}) {
  const jobKey = `${projectId}:${clipId}`;
  if (activeJobs.has(jobKey)) {
    return { status: "already_processing" };
  }

  const job = { projectId, clipId, userId, settings, status: "starting", startedAt: Date.now() };
  activeJobs.set(jobKey, job);

  try {
    await updateClipStatus(clipId, "analyzing");

    const clip = await fetchClip(clipId);
    if (!clip) throw new Error("Clip not found");

    const videoUrl = clip.video_url;
    if (!videoUrl) throw new Error("No video URL for clip");

    const tempDir = path.join(process.cwd(), "temp", `aiedit_${clipId.slice(0, 8)}`);
    fs.mkdirSync(tempDir, { recursive: true });
    const inputPath = path.join(tempDir, "input.mp4");
    const outputPath = path.join(tempDir, "output.mp4");

    try {
      await downloadVideo(videoUrl, inputPath);

      job.status = "analyzing";
      const analysis = await analyzeClip(inputPath, { clipDuration: clip.duration_seconds });

      job.status = "editing";
      await updateClipStatus(clipId, "editing");
      const instructions = await getEditingInstructions(analysis, {
        duration: clip.duration_seconds,
        platform: settings.platform || "tiktok",
        captionStyle: settings.captionStyle || "classic",
      });

      job.status = "rendering";
      await updateClipStatus(clipId, "rendering");
      await renderEditedClip(inputPath, instructions, outputPath);

      job.status = "uploading";
      const result = await exportResult(projectId, clipId, userId, outputPath, instructions);

      job.status = "completed";
      job.result = result;

      return { status: "completed", videoUrl: result.videoUrl, qualityScore: instructions.qualityScore };
    } finally {
      cleanupTempFiles(inputPath, outputPath, tempDir);
    }
  } catch (err) {
    console.error(`[AI-Edit] Failed for clip ${clipId}:`, err.message);
    job.status = "failed";
    job.error = err.message;

    await updateClipStatus(clipId, "failed", err.message);

    return { status: "failed", error: err.message };
  } finally {
    activeJobs.delete(jobKey);
  }
}

export function getJobStatus(projectId, clipId) {
  const job = activeJobs.get(`${projectId}:${clipId}`);
  if (!job) return null;
  return { status: job.status, startedAt: job.startedAt, error: job.error };
}

async function fetchClip(clipId) {
  const { data, error } = await supabaseAdmin
    .from("clips")
    .select("id, video_url, duration_seconds, status")
    .eq("id", clipId)
    .single();

  if (error || !data) return null;
  return data;
}

async function downloadVideo(url, outputPath) {
  const { spawn } = await import("child_process");

  if (url.startsWith("/") || url.startsWith("C:") || url.startsWith("D:")) {
    fs.copyFileSync(url, outputPath);
    return;
  }

  return new Promise((resolve, reject) => {
    const curl = spawn("curl", ["-L", "-o", outputPath, "--max-time", "120", url], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    curl.stderr.on("data", (d) => { stderr += d.toString(); });
    curl.on("close", (code) => {
      if (code !== 0 || !fs.existsSync(outputPath)) {
        return reject(new Error(`Download failed (exit ${code}): ${stderr.slice(-200)}`));
      }
      resolve();
    });
    curl.on("error", reject);
  });
}

async function updateClipStatus(clipId, status, errorMessage = null) {
  try {
    const update = { status };
    if (errorMessage) update.error_message = errorMessage;
    await supabaseAdmin.from("clips").update(update).eq("id", clipId);
  } catch (err) {
    console.error(`[AI-Edit] Failed to update clip status: ${err.message}`);
  }
}
