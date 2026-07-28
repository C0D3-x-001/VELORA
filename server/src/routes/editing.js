import { Router } from "express";
import { supabaseAdmin } from "../config/supabase.js";
import { editClip, getJobStatus } from "../services/video-editing/index.js";
import { getBalance, reserveCredits, refundCredits } from "../services/credit.js";
import config from "../config/env.js";

const router = Router();

router.post("/:projectId/:clipId", async (req, res) => {
  try {
    const { projectId, clipId } = req.params;
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    if (!config.isConfigured("gemini") && process.env.AI_PROVIDER !== "gemini") {
      return res.status(503).json({ error: "AI editing is not configured. Gemini API key required." });
    }

    if (process.env.AI_EDITING_ENABLED === "false") {
      return res.status(503).json({ error: "AI editing is currently disabled." });
    }

    const { data: project, error: projErr } = await supabaseAdmin
      .from("projects")
      .select("id, user_id")
      .eq("id", projectId)
      .eq("user_id", userId)
      .single();

    if (projErr || !project) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { data: clip, error: clipErr } = await supabaseAdmin
      .from("clips")
      .select("id, project_id, status")
      .eq("id", clipId)
      .eq("project_id", projectId)
      .single();

    if (clipErr || !clip) {
      return res.status(404).json({ error: "Clip not found" });
    }

    if (clip.status === "analyzing" || clip.status === "editing" || clip.status === "rendering") {
      return res.status(409).json({ error: "Clip is already being processed" });
    }

    const creditCost = config.ai.editing.creditCost || 15;
    const balance = await getBalance(userId);
    if (balance.balance < creditCost) {
      return res.status(402).json({ error: `Insufficient credits. AI editing costs ${creditCost} credits, you have ${balance.balance}` });
    }

    await reserveCredits(userId, creditCost, "AI clip editing", projectId);

    let result;
    try {
      result = await editClip(projectId, clipId, userId, {
        platform: req.body?.platform || "tiktok",
        captionStyle: req.body?.captionStyle || "classic",
      });
    } catch (err) {
      await refundCredits(userId, creditCost, "AI editing failed — refund", projectId);
      throw err;
    }

    if (result.status === "already_processing") {
      return res.status(409).json({ error: "Clip is already being processed" });
    }

    if (result.status === "failed") {
      await refundCredits(userId, creditCost, "AI editing failed — refund", projectId);
      return res.status(500).json({ error: result.error || "AI editing failed" });
    }

    res.json({
      status: "completed",
      videoUrl: result.videoUrl,
      qualityScore: result.qualityScore,
    });
  } catch (err) {
    console.error("[Editing] Route error:", err.message);
    res.status(500).json({ error: "AI editing failed" });
  }
});

router.get("/:projectId/:clipId/status", async (req, res) => {
  try {
    const { projectId, clipId } = req.params;
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", userId)
      .single();

    if (!project) return res.status(403).json({ error: "Not authorized" });

    const status = getJobStatus(projectId, clipId);

    if (!status) {
      return res.json({ status: "idle" });
    }

    res.json(status);
  } catch {
    res.status(500).json({ error: "Failed to fetch status" });
  }
});

export default router;
