import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { createProject, getProjects, getProject, getProjectStatus, getProjectClips, deleteProject, generateClips, updateProjectFilePath } from "../services/project.js";
import { downloadService } from "../services/download.js";
import { deleteProjectFiles } from "../services/storage.js";

const TEMP_DIR = path.join(process.cwd(), "temp");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TEMP_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".mp4";
    cb(null, `upload_${req.auth.userId}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /mp4|avi|mov|mkv|webm|flv|wmv/;
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (allowed.test(ext)) cb(null, true);
    else cb(new Error("Invalid file type. Allowed: mp4, avi, mov, mkv, webm, flv, wmv"));
  },
});

const router = Router();

router.get("/validate-youtube", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "URL is required" });

    const info = await downloadService.getVideoInfo(url);
    res.json(info);
  } catch (err) {
    console.error("YouTube validation error:", err.message);
    res.status(400).json({ error: "Could not fetch video info. Check the URL and try again." });
  }
});

router.get("/", async (req, res) => {
  try {
    const projects = await getProjects(req.auth.userId);
    res.json(projects);
  } catch {
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { title, source, url } = req.body;
    const project = await createProject(req.auth.userId, { title, source, url });
    res.status(201).json({ projectId: project.id, status: project.status });
  } catch {
    res.status(500).json({ error: "Failed to create project" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const project = await getProject(req.auth.userId, req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  } catch {
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

router.get("/:id/status", async (req, res) => {
  try {
    const status = await getProjectStatus(req.auth.userId, req.params.id);
    if (!status) return res.status(404).json({ error: "Project not found" });
    res.json(status);
  } catch {
    res.status(500).json({ error: "Failed to fetch project status" });
  }
});

router.get("/:id/clips", async (req, res) => {
  try {
    const clips = await getProjectClips(req.auth.userId, req.params.id);
    if (clips === null) return res.status(404).json({ error: "Project not found" });
    res.json(clips);
  } catch {
    res.status(500).json({ error: "Failed to fetch clips" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.auth.userId;

    await deleteProject(userId, id);
    res.json({ success: true });

    deleteProjectFiles(userId, id).catch(() => {});
    try { downloadService.cleanupAll(id); } catch {}
  } catch {
    res.status(500).json({ error: "Failed to delete project" });
  }
});

router.post("/:id/upload", upload.single("video"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No video file uploaded" });

    const { id } = req.params;
    const project = await getProject(req.auth.userId, id);
    if (!project) {
      try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(404).json({ error: "Project not found" });
    }

    await updateProjectFilePath(req.auth.userId, id, req.file.path);

    res.json({
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  } catch {
    try { if (req.file?.path) fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ error: "Failed to upload video" });
  }
});

router.post("/:id/generate", async (req, res) => {
  try {
    const result = await generateClips(req.auth.userId, req.params.id, req.body.settings || {});
    res.json(result);
  } catch (err) {
    const msg = err.message || "Failed to start generation";
    if (msg.includes("already being processed")) {
      return res.status(409).json({ error: msg });
    }
    if (msg.includes("Insufficient credits") || msg.includes("requires a Pro") || msg.includes("subscription")) {
      return res.status(400).json({ error: msg });
    }
    if (msg.includes("YouTube requires authentication") || msg.includes("cookies.txt")) {
      return res.status(400).json({ error: msg, code: "youtube_blocked" });
    }
    res.status(500).json({ error: msg });
  }
});

export default router;
