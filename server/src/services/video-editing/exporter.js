import fs from "fs";
import { supabaseAdmin } from "../../config/supabase.js";
import { getSignedUrl } from "../storage.js";

export async function exportResult(projectId, clipId, userId, editedPath, instructions) {
  if (!fs.existsSync(editedPath)) {
    throw new Error("Edited video file not found");
  }

  const stat = fs.statSync(editedPath);
  if (stat.size < 1024) {
    throw new Error("Edited video file is too small");
  }

  const storagePath = `users/${userId}/projects/${projectId}/edited/clip_${clipId}_edited.mp4`;

  const fileStream = fs.createReadStream(editedPath);
  const { error: uploadError } = await supabaseAdmin.storage
    .from("velora-storage")
    .upload(storagePath, fileStream, {
      contentType: "video/mp4",
      upsert: false,
      duplex: "half",
    });

  if (uploadError) throw uploadError;

  const videoUrl = await getSignedUrl("velora-storage", storagePath, 86400 * 7);

  const metadata = {
    quality_score: instructions.qualityScore || null,
    hook_timestamp: instructions.hookTimestamp || null,
    viral_suggestions: instructions.viralSuggestions || [],
    zooms_count: (instructions.zooms || []).length,
    cuts_count: (instructions.cuts || []).length,
    captions_count: (instructions.captions || []).length,
    color_correction: instructions.color_correction || null,
  };

  const { error } = await supabaseAdmin
    .from("clips")
    .update({
      video_url: videoUrl,
      status: "completed",
    })
    .eq("id", clipId);

  if (error) {
    console.error("[Exporter] Failed to update clip record:", error.message);
  }

  return { videoUrl, metadata };
}

export function cleanupTempFiles(...paths) {
  for (const p of paths) {
    try {
      if (p && fs.existsSync(p)) {
        const stat = fs.statSync(p);
        if (stat.isDirectory()) {
          fs.rmSync(p, { recursive: true, force: true });
        } else {
          fs.unlinkSync(p);
        }
      }
    } catch {}
  }
}
