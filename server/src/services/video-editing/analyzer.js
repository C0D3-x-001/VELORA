import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import config from "../../config/env.js";
import { buildVisionAnalysisPrompt } from "../../prompts/editingDirector.js";
import { getAIProvider } from "../ai/index.js";
import { isWhisperReady, transcribeAudio } from "../transcription.js";

function runFFmpeg(args, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const proc = spawn(config.video.ffmpegPath, ["-y", ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    let killed = false;
    const timer = setTimeout(() => { killed = true; proc.kill("SIGTERM"); }, timeoutMs);
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (killed) return reject(new Error("FFmpeg timed out"));
      if (code !== 0) return reject(new Error(`FFmpeg exited ${code}: ${stderr.slice(-500)}`));
      resolve({ stderr });
    });
    proc.on("error", (e) => { clearTimeout(timer); reject(e); });
  });
}

async function extractAudio(videoPath, audioPath) {
  await runFFmpeg([
    "-i", videoPath,
    "-vn", "-acodec", "pcm_s16le",
    "-ar", "16000", "-ac", "1",
    audioPath,
  ], 30000);
}

async function transcribeWhisper(audioPath) {
  if (!isWhisperReady()) {
    console.warn("[Analyzer] Whisper not ready — returning empty transcript");
    return { segments: [], language: "en", error: "Whisper not initialized" };
  }
  try {
    return await transcribeAudio(audioPath);
  } catch (err) {
    console.error("[Analyzer] Whisper transcription failed:", err.message);
    return { segments: [], language: "en", error: err.message };
  }
}

async function detectScenes(videoPath) {
  try {
    const { stderr } = await runFFmpeg([
      "-i", videoPath,
      "-vf", "select='gt(scene,0.35)',showinfo",
      "-vsync", "vfr", "-f", "null", "-",
    ], 60000);

    const scenes = [];
    const regex = /pts_time:(\d+\.?\d*)/g;
    let match;
    const changePoints = [];

    while ((match = regex.exec(stderr)) !== null) {
      changePoints.push(parseFloat(match[1]));
    }

    if (changePoints.length > 0) {
      const duration = await getVideoDuration(videoPath);
      if (changePoints[0] > 0.5) {
        scenes.push({ start: 0, end: changePoints[0], duration: changePoints[0] });
      }
      for (let i = 0; i < changePoints.length; i++) {
        const start = changePoints[i];
        const end = i < changePoints.length - 1 ? changePoints[i + 1] : duration;
        scenes.push({ start, end, duration: end - start });
      }
    } else {
      const duration = await getVideoDuration(videoPath);
      scenes.push({ start: 0, end: duration, duration });
    }

    return scenes;
  } catch (err) {
    console.error("[Analyzer] Scene detection failed:", err.message);
    return [];
  }
}

async function analyzeMotion(videoPath) {
  try {
    const { stderr } = await runFFmpeg([
      "-i", videoPath,
      "-vf", "signalstats",
      "-f", "null", "-",
    ], 60000);

    const frames = [];
    const yavgRegex = /YAVG:(\d+)/g;
    let match;

    while ((match = yavgRegex.exec(stderr)) !== null) {
      frames.push(parseInt(match[1], 10));
    }

    if (frames.length < 2) {
      return { avg_motion: 0, stability: 100, dark_segments: [] };
    }

    let totalMotion = 0;
    for (let i = 1; i < frames.length; i++) {
      totalMotion += Math.abs(frames[i] - frames[i - 1]);
    }
    const avgMotion = totalMotion / (frames.length - 1);

    const stability = Math.max(0, 100 - avgMotion * 2);

    const darkSegments = [];
    let darkStart = null;
    for (let i = 0; i < frames.length; i++) {
      const ts = (i / (frames.length - 1)) * (await getVideoDuration(videoPath));
      if (frames[i] < 30) {
        if (darkStart === null) darkStart = ts;
      } else if (darkStart !== null) {
        darkSegments.push({ start: darkStart, end: ts, duration: ts - darkStart });
        darkStart = null;
      }
    }
    if (darkStart !== null) {
      darkSegments.push({ start: darkStart, end: await getVideoDuration(videoPath), duration: (await getVideoDuration(videoPath)) - darkStart });
    }

    return { avg_motion: avgMotion, stability, dark_segments: darkSegments, frame_count: frames.length };
  } catch (err) {
    console.error("[Analyzer] Motion analysis failed:", err.message);
    return { avg_motion: 0, stability: 100, dark_segments: [] };
  }
}

async function getVideoDuration(videoPath) {
  try {
    const ffprobePath = config.video.ffprobePath || config.video.ffmpegPath?.replace("ffmpeg", "ffprobe") || "ffprobe";
    const { stdout } = await new Promise((resolve, reject) => {
      const proc = spawn(ffprobePath, [
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "csv=p=0",
        videoPath,
      ], { stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => { proc.kill("SIGTERM"); reject(new Error("ffprobe timeout")); }, 5000);
      proc.stdout.on("data", (d) => { stdout += d.toString(); });
      proc.stderr.on("data", (d) => { stderr += d.toString(); });
      proc.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) return reject(new Error(`ffprobe exited ${code}: ${stderr.slice(-200)}`));
        resolve({ stdout });
      });
      proc.on("error", (e) => { clearTimeout(timer); reject(e); });
    });
    const duration = parseFloat(stdout.trim());
    if (!isNaN(duration) && duration > 0) return duration;
  } catch {}
  return 30;
}

async function extractFrames(videoPath, outputDir, intervalSec = 1) {
  const duration = await getVideoDuration(videoPath);
  const frames = [];
  const frameCount = Math.min(Math.ceil(duration / intervalSec), 30);

  for (let i = 0; i < frameCount; i++) {
    const timestamp = i * intervalSec;
    if (timestamp >= duration) break;

    const framePath = path.join(outputDir, `frame_${i}.jpg`);
    try {
      await runFFmpeg([
        "-ss", timestamp.toString(),
        "-i", videoPath,
        "-vframes", "1",
        "-q:v", "5",
        framePath,
      ], 10000);

      if (fs.existsSync(framePath)) {
        const buffer = await sharp(framePath).resize(512, 512, { fit: "inside" }).jpeg({ quality: 70 }).toBuffer();
        frames.push({ timestamp, base64: buffer.toString("base64") });
        try { fs.unlinkSync(framePath); } catch {}
      }
    } catch {}
  }

  return frames;
}

export async function analyzeClip(videoPath, options = {}) {
  const tempDir = path.join(path.dirname(videoPath), "ai_analysis_" + Date.now());
  fs.mkdirSync(tempDir, { recursive: true });

  const analysis = { duration: 0, transcript: null, scenes: [], motion: null, faces: null };

  try {
    analysis.duration = await getVideoDuration(videoPath);
    const clipDuration = options.clipDuration || analysis.duration;

    const audioPath = path.join(tempDir, "audio.wav");
    const [transcript, scenes, motion] = await Promise.all([
      (async () => {
        try {
          await extractAudio(videoPath, audioPath);
          const result = await transcribeWhisper(audioPath);
          try { fs.unlinkSync(audioPath); } catch {}
          return result;
        } catch (err) {
          console.error("[Analyzer] Audio extraction/transcription failed:", err.message);
          return { segments: [], language: "en", error: err.message };
        }
      })(),
      detectScenes(videoPath),
      analyzeMotion(videoPath),
    ]);

    analysis.transcript = transcript;
    analysis.scenes = scenes;
    analysis.motion = motion;

    try {
      const frames = await extractFrames(videoPath, tempDir, 1);
      if (frames.length > 0) {
        const provider = getAIProvider();
        const visionPrompt = buildVisionAnalysisPrompt(clipDuration);
        analysis.faces = await provider.analyzeFrames(frames, visionPrompt);
      }
    } catch (err) {
      console.error("[Analyzer] Gemini Vision analysis failed:", err.message);
      analysis.faces = [];
    }
  } catch (err) {
    console.error("[Analyzer] Analysis failed:", err.message);
    analysis.error = err.message;
  } finally {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }

  return analysis;
}
