import { Router } from "express";
import { getSettings, updateSettings } from "../services/settings.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const settings = await getSettings(req.auth.userId);
    res.json(settings);
  } catch {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.put("/", async (req, res) => {
  try {
    const result = await updateSettings(req.auth.userId, req.body);
    res.json(result);
  } catch {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

export default router;
