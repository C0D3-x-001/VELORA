import { Router } from "express";
import fs from "fs";
import path from "path";
import { supabaseAdmin, isConfigured } from "../config/supabase.js";
import { getProject } from "../services/project.js";
import { calculateCredits, getBalance, reserveCredits, refundCredits } from "../services/credit.js";
import { videoService } from "../services/video.js";
import { aiService } from "../services/ai.js";
import { downloadService } from "../services/download.js";
import { uploadFile, getSignedUrl, refreshSignedUrl } from "../services/storage.js";

const router = Router();

router.get("/:projectId/clips", async (req, res) => {
  try {
    const project = await getProject(req.auth.userId, req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const clips = project.clips || [];
    const refreshed = await Promise.all(clips.map(async (c) => ({
      ...c,
      video_url: c.video_url ? await refreshSignedUrl("velora-storage", c.video_url) : c.video_url,
      thumbnail_url: c.thumbnail_url ? await refreshSignedUrl("velora-storage", c.thumbnail_url) : c.thumbnail_url,
    })));
    res.json(refreshed);
  } catch {
    res.status(500).json({ error: "Failed to fetch clips" });
  }
});

router.post("/:clipId/regenerate", async (req, res) => {
  try {
    const { projectId, settings } = req.body;
    if (!projectId) return res.status(400).json({ error: "projectId is required" });

    if (!isConfigured) {
      return res.json({ jobId: `regen_${Date.now()}`, status: "completed" });
    }

    const { data: clip, error: clipError } = await supabaseAdmin
      .from("clips")
      .select("id, project_id, start_time, end_time, duration_seconds, viral_score, caption_style, caption_preset, caption_config, caption_position, subtitles_url, video_url, status")
      .eq("id", req.params.clipId)
      .eq("project_id", projectId)
      .single();

    if (clipError || !clip) return res.status(404).json({ error: "Clip not found" });

    const { data: project, error: projError } = await supabaseAdmin
      .from("projects")
      .select("id, source_type, source_url, original_video_url, settings, duration_seconds")
      .eq("id", projectId)
      .eq("user_id", req.auth.userId)
      .single();

    if (projError || !project) return res.status(404).json({ error: "Project not found" });

    const duration = clip.duration_seconds || 60;
    const creditsNeeded = calculateCredits(1, duration);
    const balance = await getBalance(req.auth.userId);
    if (balance.balance < creditsNeeded) {
      return res.status(402).json({ error: `Insufficient credits. Need ${creditsNeeded}, have ${balance.balance}` });
    }

    const POPUP_CAPTION_TIERS = ["pro", "business"];
    const requestedStyle = settings?.captionStyle || clip.caption_style || "modern";
    if (requestedStyle === "popup" && !POPUP_CAPTION_TIERS.includes(balance.plan)) {
      return res.status(403).json({ error: "Pop-Up Captions require a Pro or Business subscription. Please upgrade your plan." });
    }

    await reserveCredits(req.auth.userId, creditsNeeded, "Regenerating clip", projectId);

    regenerateClipBackground({
      clip,
      project,
      userId: req.auth.userId,
      creditsNeeded,
      projectId,
      clipId: req.params.clipId,
      settings: settings || {},
    }).catch((err) => {
      console.error(`[Regen] Fatal error for clip ${req.params.clipId}:`, err.message);
    });

    res.json({ jobId: `regen_${Date.now()}`, status: "processing" });
  } catch {
    res.status(500).json({ error: "Failed to regenerate clip" });
  }
});

router.post("/:clipId/caption-style", async (req, res) => {
  try {
    const { style, projectId, preset, position } = req.body;
    if (!projectId) return res.status(400).json({ error: "projectId is required" });

    const { data: clip, error: clipErr } = await supabaseAdmin
      .from("clips")
      .select("id, project_id")
      .eq("id", req.params.clipId)
      .eq("project_id", projectId)
      .single();
    if (clipErr || !clip) return res.status(404).json({ error: "Clip not found" });

    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", req.auth.userId)
      .single();
    if (!project) return res.status(403).json({ error: "Not authorized" });

    const POPUP_CAPTION_TIERS = ["pro", "business"];
    if (style === "popup") {
      const balance = await getBalance(req.auth.userId);
      if (!POPUP_CAPTION_TIERS.includes(balance.plan)) {
        return res.status(403).json({ error: "Pop-Up Captions require a Pro or Business subscription." });
      }
    }
    const updateData = { caption_style: style };
    if (preset) updateData.caption_preset = preset;
    if (position) updateData.caption_position = position;
    if (req.body.captionConfig) updateData.caption_config = req.body.captionConfig;
    const { error } = await supabaseAdmin
      .from("clips")
      .update(updateData)
      .eq("id", req.params.clipId)
      .eq("project_id", projectId);
    if (error) throw error;
    res.json({ success: true, style, preset, position });
  } catch {
    res.status(500).json({ error: "Failed to update caption style" });
  }
});

export default router;

async function findVideoFile(project) {
  if (project.original_video_url && fs.existsSync(project.original_video_url)) {
    return project.original_video_url;
  }
  if (project.source_url && fs.existsSync(project.source_url)) {
    return project.source_url;
  }
  if (project.source_type === "youtube" && project.source_url) {
    console.log(`[Regen] Re-downloading YouTube video for project ${project.id}`);
    const downloaded = await downloadService.downloadVideo(project.source_url, `regen_${project.id}`);
    return downloaded.path;
  }
  return null;
}

async function regenerateClipBackground({ clip, project, userId, creditsNeeded, projectId, clipId, settings }) {
  const shortId = clipId.slice(0, 8);
  const log = (msg) => console.log(`[Regen:${shortId}] ${msg}`);
  const err = (msg) => console.error(`[Regen:${shortId}] ${msg}`);

  let videoPath = null;
  let tempFiles = [];

  try {
    log(`Starting — clip ${clip.start_time}s–${clip.end_time}s (${clip.duration_seconds}s)`);

    await supabaseAdmin.from("clips").update({ status: "processing" }).eq("id", clipId);

    videoPath = await findVideoFile(project);
    if (!videoPath || !fs.existsSync(videoPath)) {
      throw new Error("Original video not available. Re-upload and try again.");
    }
    log(`Video found: ${videoPath}`);

    const videoDims = await videoService.probeVideo(videoPath);
    const clipDir = path.dirname(videoPath);
    const clipVideoPath = path.join(clipDir, `regen_${shortId}.mp4`);
    tempFiles.push(clipVideoPath);

    log(`Cutting clip...`);
    await videoService.cutClip(videoPath, clipVideoPath, clip.start_time, clip.duration_seconds);
    log(`Clip cut complete`);

    const platform = settings.platform || project.settings?.platform;
    let finalClipPath = clipVideoPath;
    const isVertical = platform === "vertical";
    if (isVertical) {
      const convertedPath = path.join(clipDir, `regen_v_${shortId}.mp4`);
      tempFiles.push(convertedPath);
      try {
        await videoService.convertToVertical(clipVideoPath, convertedPath);
        if (fs.existsSync(convertedPath)) {
          const vStats = fs.statSync(convertedPath);
          if (vStats.size < 1024) {
            throw new Error(`Vertical conversion produced invalid file (${vStats.size} bytes)`);
          }
          finalClipPath = convertedPath;
          log(`Converted to vertical`);
        } else {
          throw new Error("Vertical conversion produced no output file");
        }
      } catch (convErr) {
        err(`Vertical conversion failed: ${convErr.message}`);
        throw convErr;
      }
    }

    const thumbPath = path.join(clipDir, `regen_thumb_${shortId}.jpg`);
    tempFiles.push(thumbPath);
    try {
      await videoService.extractThumbnail(finalClipPath, thumbPath, 0);
      log(`Thumbnail extracted`);
    } catch (thumbErr) {
      err(`Thumbnail extraction failed: ${thumbErr.message}`);
    }

    let clipSegments = [];
    try {
      const { data: transcript } = await supabaseAdmin
        .from("transcripts")
        .select("segments")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      clipSegments = (transcript?.segments || []).filter(
        (s) => s.end > clip.start_time && s.start < clip.end_time
      );
      log(`Found ${clipSegments.length} transcript segments for this clip`);
    } catch (transErr) {
      err(`Failed to fetch transcript: ${transErr.message}`);
    }

    const captionStyle = settings.captionStyle || clip.caption_style || "modern";
    let clipSubtitlesUrl = clip.subtitles_url;
    let videoToUpload = finalClipPath;

    if (captionStyle === "popup" && clipSegments.length > 0) {
      try {
        const adjustedSegments = clipSegments.map((s) => ({
          start: Math.max(0, s.start - clip.start_time),
          end: Math.max(0, s.end - clip.start_time),
          text: s.text,
          words: (s.words || []).map((w) => ({
            word: w.word,
            start: Math.max(0, w.start - clip.start_time),
            end: Math.max(0, w.end - clip.start_time),
          })),
        }));

        let clipEmphasis = {};
        try {
          const allSegments = clipSegments.map((s) => ({ start: s.start - clip.start_time, end: s.end - clip.start_time, text: s.text }));
          clipEmphasis = await aiService.analyzeTranscriptEmphasis(allSegments);
        } catch (emphErr) {
          err(`Emphasis analysis failed: ${emphErr.message}`);
        }

        const assPath = path.join(clipDir, `regen_popup_${shortId}.ass`);
        tempFiles.push(assPath);
        const captionWidth = isVertical ? 1080 : videoDims.width;
        const captionHeight = isVertical ? 1920 : videoDims.height;
        const captionPreset = settings.captionPreset || clip.caption_preset || "popup";
        const captionOpts = {};
        if (settings.captionPosition || clip.caption_position) captionOpts.positionOverride = settings.captionPosition || clip.caption_position;
        const clipCaptionConfig = settings.captionConfig || clip.caption_config || null;
        if (clipCaptionConfig) captionOpts.captionConfig = clipCaptionConfig;
        await videoService.generatePremiumCaptionFile(adjustedSegments, clipEmphasis, assPath, captionPreset, captionWidth, captionHeight, captionOpts);

        if (fs.existsSync(assPath)) {
          const assContent = fs.readFileSync(assPath, "utf-8");
          if (!assContent.includes("Dialogue:")) {
            log(`ASS file has no dialogue lines — skipping burn`);
            try { fs.unlinkSync(assPath); } catch {}
          } else {
            const burnedPath = path.join(clipDir, `regen_burned_${shortId}.mp4`);
            tempFiles.push(burnedPath);
            const burnResult = await videoService.addPopupCaptions(finalClipPath, burnedPath, assPath);
            if (burnResult?.fallback) {
              log(`Pop-up captions fell back to raw clip — FFmpeg ASS filter may have failed`);
            } else if (fs.existsSync(burnedPath)) {
              videoToUpload = burnedPath;
              log(`Pop-up captions burned into clip`);
            }
          }
        }
        clipSubtitlesUrl = null;
        if (videoToUpload === finalClipPath) {
          try {
            const vttPath = path.join(clipDir, `regen_sub_fallback_${shortId}.vtt`);
            tempFiles.push(vttPath);
            await videoService.generateCaptionFile(adjustedSegments, vttPath);
            if (fs.existsSync(vttPath)) {
              const vttBuffer = await fs.promises.readFile(vttPath);
              const vttFileName = `sub_${clipId}.vtt`;
              const vttStoragePath = `users/${userId}/projects/${projectId}/subtitles/${vttFileName}`;
              await uploadFile("velora-storage", vttStoragePath, vttBuffer, "text/vtt");
              clipSubtitlesUrl = `/api/v1/clips/subtitles/${userId}/${projectId}/${vttFileName}`;
              log(`Popup VTT fallback generated (ASS burn was skipped)`);
            }
          } catch (vttErr) {
            log(`Popup VTT fallback failed: ${vttErr.message}`);
          }
        }
      } catch (popupErr) {
        err(`Pop-up caption rendering failed: ${popupErr.message}`);
      }
    } else if (captionStyle !== "none" && clipSegments.length > 0) {
      try {
        const adjustedSegments = clipSegments.map((s) => ({
          start: Math.max(0, s.start - clip.start_time),
          end: Math.max(0, s.end - clip.start_time),
          text: s.text,
        }));
        const vttPath = path.join(clipDir, `regen_sub_${shortId}.vtt`);
        tempFiles.push(vttPath);
        await videoService.generateCaptionFile(adjustedSegments, vttPath);

        if (fs.existsSync(vttPath)) {
          const vttBuffer = await fs.promises.readFile(vttPath);
          const vttFileName = `sub_${clipId}.vtt`;
          const vttStoragePath = `users/${userId}/projects/${projectId}/subtitles/${vttFileName}`;
          await uploadFile("velora-storage", vttStoragePath, vttBuffer, "text/vtt");
          clipSubtitlesUrl = `/api/v1/clips/subtitles/${userId}/${projectId}/${vttFileName}`;
          log(`Subtitles generated and uploaded`);
        }
      } catch (subErr) {
        err(`Subtitle generation failed: ${subErr.message}`);
      }
    } else if (captionStyle === "none") {
      clipSubtitlesUrl = null;
    }

    const clipTranscriptText = clipSegments.map((s) => s.text).join(" ") || "";
    let metadata;
    try {
      metadata = await aiService.generateMetadata(clipTranscriptText, clip.viral_score || 75);
      log(`AI metadata generated: "${metadata.title}"`);
    } catch (metaErr) {
      err(`AI metadata failed: ${metaErr.message} — using defaults`);
      metadata = { title: null, caption: "", hashtags: [] };
    }

    log(`Uploading clip video...`);
    const clipBuffer = await fs.promises.readFile(videoToUpload);
    const clipFileName = `clip_${clipId}.mp4`;
    const clipStoragePath = `users/${userId}/projects/${projectId}/clips/${clipFileName}`;
    await uploadFile("velora-storage", clipStoragePath, clipBuffer, "video/mp4");
    const clipVideoUrl = await getSignedUrl("velora-storage", clipStoragePath, 86400 * 7);

    let clipThumbnailUrl = clip.thumbnail_url;
    if (fs.existsSync(thumbPath)) {
      try {
        const thumbBuffer = await fs.promises.readFile(thumbPath);
        const thumbFileName = `thumb_${clipId}.jpg`;
        const thumbStoragePath = `users/${userId}/projects/${projectId}/thumbnails/${thumbFileName}`;
        await uploadFile("velora-storage", thumbStoragePath, thumbBuffer, "image/jpeg");
        clipThumbnailUrl = await getSignedUrl("velora-storage", thumbStoragePath, 86400 * 7);
        log(`Thumbnail uploaded`);
      } catch (thumbUploadErr) {
        err(`Thumbnail upload failed: ${thumbUploadErr.message}`);
      }
    }

    await supabaseAdmin.from("clips").update({
      video_url: clipVideoUrl,
      thumbnail_url: clipThumbnailUrl,
      subtitles_url: clipSubtitlesUrl,
      caption_style: captionStyle,
      status: "completed",
    }).eq("id", clipId);

    await supabaseAdmin.from("clip_metadata").delete().eq("clip_id", clipId);
    await supabaseAdmin.from("clip_metadata").insert({
      clip_id: clipId,
      title: metadata.title || `Clip`,
      caption: metadata.caption || "",
      hashtags: metadata.hashtags || [],
    });

    log(`Regeneration complete`);
  } catch (regenErr) {
    err(`Failed: ${regenErr.message}`);

    try {
      await supabaseAdmin.from("clips").update({ status: "failed" }).eq("id", clipId);
    } catch { /* best effort */ }

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await refundCredits(userId, creditsNeeded, "Clip regeneration failed — refund", projectId);
        log(`Credits refunded`);
        break;
      } catch (refErr) {
        err(`Refund attempt ${attempt + 1} failed: ${refErr.message}`);
        if (attempt < 2) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  } finally {
    for (const f of tempFiles) {
      try { if (f && fs.existsSync(f)) fs.unlinkSync(f); } catch { /* ignore */ }
    }
  }
}
