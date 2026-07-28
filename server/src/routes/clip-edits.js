import { Router } from "express";
import { supabaseAdmin } from "../config/supabase.js";
import { uploadFile } from "../services/storage.js";

const router = Router();

const DEFAULT_EDIT_STATE = {
  trim: { start: 0, end: null },
  captions: { segments: [], overrides: [] },
  captionConfig: {},
  captionPreset: "classic",
  captionStyle: "classic",
  exportSettings: { resolution: "1080x1920", fps: 30, bitrate: "high" },
  version: 1,
  updatedAt: null,
};

function storagePath(userId, projectId, clipId) {
  return `users/${userId}/projects/${projectId}/edits/clip_${clipId}.json`;
}

router.get("/:projectId/:clipId", async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { projectId, clipId } = req.params;

    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", userId)
      .single();
    if (!project) return res.status(404).json({ error: "Project not found" });

    const { data: clip } = await supabaseAdmin
      .from("clips")
      .select("id, project_id, start_time, end_time, duration_seconds, caption_style, caption_preset, caption_config, caption_position, subtitles_url, video_url, thumbnail_url, status")
      .eq("id", clipId)
      .eq("project_id", projectId)
      .single();
    if (!clip) return res.status(404).json({ error: "Clip not found" });

    const sp = storagePath(userId, projectId, clipId);
    let editState = null;

    try {
      const { data, error } = await supabaseAdmin.storage
        .from("velora-storage")
        .download(sp);
      if (!error && data) {
        const text = await data.text();
        editState = JSON.parse(text);
      }
    } catch {
      // No saved state — return defaults merged with clip data
    }

    if (!editState) {
      editState = {
        ...DEFAULT_EDIT_STATE,
        trim: { start: 0, end: clip.duration_seconds || 0 },
      };
    }

    let transcript = null;
    try {
      const { data: t } = await supabaseAdmin
        .from("transcripts")
        .select("segments, content")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (t) {
        const clipStart = clip.start_time || 0;
        const clipEnd = clip.end_time || clip.duration_seconds || 0;
        const rawSegments = t.segments || [];
        const clipSegments = rawSegments
          .filter((s) => s.end > clipStart && s.start < clipEnd)
          .map((s) => ({
            ...s,
            start: Math.max(0, s.start - clipStart),
            end: Math.min(clip.duration_seconds, s.end - clipStart),
            words: (s.words || []).map((w) => ({
              ...w,
              start: Math.max(0, w.start - clipStart),
              end: Math.min(clip.duration_seconds, w.end - clipStart),
            })),
          }));
        transcript = { content: t.content, segments: clipSegments };
      }
    } catch {
      // Transcript not available
    }

    res.json({ editState, clip, transcript });
  } catch (err) {
    console.error("[ClipEdits] Load error:", err.message);
    res.status(500).json({ error: "Failed to load edit state" });
  }
});

router.put("/:projectId/:clipId", async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { projectId, clipId } = req.params;
    const editState = req.body;
    if (!editState || typeof editState !== "object") {
      return res.status(400).json({ error: "Invalid edit state" });
    }

    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", userId)
      .single();
    if (!project) return res.status(404).json({ error: "Project not found" });

    const { data: clip } = await supabaseAdmin
      .from("clips")
      .select("id")
      .eq("id", clipId)
      .eq("project_id", projectId)
      .single();
    if (!clip) return res.status(404).json({ error: "Clip not found" });

    const stateToSave = {
      ...editState,
      updatedAt: new Date().toISOString(),
      version: editState.version || 1,
    };

    const sp = storagePath(userId, projectId, clipId);
    const buffer = Buffer.from(JSON.stringify(stateToSave, null, 2), "utf-8");
    await uploadFile("velora-storage", sp, buffer, "application/json");

    res.json({ success: true, updatedAt: stateToSave.updatedAt });
  } catch (err) {
    console.error("[ClipEdits] Save error:", err.message);
    res.status(500).json({ error: "Failed to save edit state" });
  }
});

export default router;
