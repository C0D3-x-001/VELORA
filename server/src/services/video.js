import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import config from "../config/env.js";
import { generatePremiumCaptionFile } from "./premium-captions.js";

export const videoService = {
  async extractAudio(inputPath, outputPath) {
    return this.runFFmpeg([
      "-i", inputPath,
      "-vn",
      "-acodec", "libmp3lame",
      "-q:a", "4",
      outputPath,
    ]);
  },

  async probeCodec(inputPath) {
    return new Promise((resolve) => {
      const probe = spawn(config.video.ffmpegPath, ["-y", "-i", inputPath], { stdio: ["ignore", "pipe", "pipe"] });
      let stderr = "";
      let killed = false;
      const timer = setTimeout(() => {
        killed = true;
        try { probe.kill("SIGKILL"); } catch {}
        resolve("unknown");
      }, 15000);
      probe.stderr.on("data", (d) => { stderr += d.toString(); });
      probe.on("close", () => {
        clearTimeout(timer);
        if (killed) return;
        const match = stderr.match(/Video:\s*(\w+)/i);
        resolve(match ? match[1].toLowerCase() : "unknown");
      });
      probe.on("error", () => { clearTimeout(timer); resolve("unknown"); });
    });
  },

  async cutClip(inputPath, outputPath, startTime, duration) {
    const start = Date.now();
    console.log(`[Video] Cutting clip: start=${startTime}s duration=${duration}s`);
    const codec = await this.probeCodec(inputPath);
    const useCopy = codec === "h264";
    if (useCopy) console.log(`[Video] Source is H.264 — using stream copy (fast)`);

    const result = await this.runFFmpeg([
      "-ss", startTime.toString(),
      "-i", inputPath,
      "-t", duration.toString(),
      ...(useCopy
        ? ["-c", "copy", "-movflags", "+faststart"]
        : [      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart"]
      ),
      outputPath,
    ]);
    console.log(`[Video] Cut done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
    return result;
  },

  async extractThumbnail(inputPath, outputPath, startTime) {
    return this.runFFmpeg([
      "-ss", startTime.toString(),
      "-i", inputPath,
      "-vframes", "1",
      "-q:v", "2",
      outputPath,
    ]);
  },

  async convertToVertical(inputPath, outputPath) {
    const start = Date.now();
    const dims = await this.getVideoResolution(inputPath);
    const srcW = dims.width || 1920;
    const srcH = dims.height || 1080;
    const srcAspect = srcW / srcH;
    const targetAspect = 9 / 16;
    console.log(`[Video] Converting to vertical: ${srcW}x${srcH} (aspect ${srcAspect.toFixed(3)}) → 1080x1920 (target ${targetAspect.toFixed(3)})`);

    let vf;
    if (Math.abs(srcAspect - targetAspect) < 0.02) {
      vf = "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black";
    } else if (srcAspect > targetAspect) {
      const cropW = Math.round(srcH * targetAspect);
      const cropX = Math.floor((srcW - cropW) / 2);
      vf = `crop=${cropW}:${srcH}:${cropX}:0,scale=1080:1920`;
    } else {
      const cropH = Math.round(srcW / targetAspect);
      const cropY = Math.floor((srcH - cropH) / 2);
      vf = `crop=${srcW}:${cropH}:0:${cropY},scale=1080:1920`;
    }

    console.log(`[Video] FFmpeg filter: ${vf}`);
    const result = await this.runFFmpeg([
      "-i", inputPath,
      "-vf", vf,
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-c:a", "copy",
      "-movflags", "+faststart",
      outputPath,
    ]);

    if (result?.success) {
      const outDims = await this.getVideoResolution(outputPath);
      console.log(`[Video] Vertical convert done in ${((Date.now() - start) / 1000).toFixed(1)}s — output ${outDims.width}x${outDims.height}`);
      if (outDims.width !== 1080 || outDims.height !== 1920) {
        console.warn(`[Video] WARNING: output is ${outDims.width}x${outDims.height}, expected 1080x1920`);
      }
    }

    return result;
  },

  async addCaptions(inputPath, outputPath, captionsPath) {
    const fwdPath = captionsPath.replace(/\\/g, "/");
    const escapedPath = fwdPath.replace(/:/g, "\\:");
    return this.runFFmpeg([
      "-i", inputPath,
      "-vf", `subtitles=${escapedPath}:force_style='FontName=Inter,FontSize=24,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=2,Shadow=1'`,
      "-c:a", "copy",
      outputPath,
    ]);
  },

  async addPopupCaptions(inputPath, outputPath, assPath) {
    const fwdPath = assPath.replace(/\\/g, "/");
    const escapedPath = fwdPath.replace(/:/g, "\\:");
    const fontsDir = path.join(process.cwd(), "fonts");
    const fontsDirFwd = fs.existsSync(fontsDir) ? fontsDir.replace(/\\/g, "/") : null;
    const fontsDirEscaped = fontsDirFwd ? fontsDirFwd.replace(/:/g, "\\:") : null;
    const vfFilter = fontsDirEscaped
      ? `ass='${escapedPath}':fontsdir='${fontsDirEscaped}'`
      : `ass='${escapedPath}'`;
    const vfFilterNoQuote = fontsDirEscaped
      ? `ass=${escapedPath}:fontsdir=${fontsDirEscaped}`
      : `ass=${escapedPath}`;
    const baseArgs = [
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-movflags", "+faststart",
    ];
    console.log(`[Video] ASS burn: ass="${assPath}" filter="${vfFilter}"`);
    try {
      const result = await this.runFFmpeg([
        "-i", inputPath,
        "-vf", vfFilter,
        ...baseArgs,
        outputPath,
      ]);
      console.log(`[Video] ASS burn succeeded (quoted)`);
      return result;
    } catch (assErr) {
      console.warn(`[Video] ASS burn failed (quoted): ${assErr.message}`);
      console.warn(`[Video] ASS filter used: ${vfFilter}`);
      try {
        const result = await this.runFFmpeg([
          "-i", inputPath,
          "-vf", vfFilterNoQuote,
          ...baseArgs,
          outputPath,
        ]);
        console.log(`[Video] ASS burn succeeded (unquoted)`);
        return result;
      } catch (retryErr) {
        console.warn(`[Video] ASS retry also failed (unquoted): ${retryErr.message}`);
        console.warn(`[Video] ASS filter used: ${vfFilterNoQuote}`);
        console.warn(`[Video] Falling back to raw clip — no captions will be burned`);
        fs.copyFileSync(inputPath, outputPath);
        return { success: true, fallback: true };
      }
    }
  },

  async generatePopupCaptionFile(segments, emphasisMap, outputPath, frameWidth, frameHeight, options) {
    return generatePremiumCaptionFile(segments, emphasisMap, outputPath, "popup", frameWidth, frameHeight, options);
  },

  async generatePremiumCaptionFile(segments, emphasisMap, outputPath, presetName, frameWidth, frameHeight, options) {
    return generatePremiumCaptionFile(segments, emphasisMap, outputPath, presetName, frameWidth, frameHeight, options);
  },

  formatASSTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`;
  },

  async probeVideo(inputPath) {
    return new Promise((resolve) => {
      const probe = spawn(config.video.ffmpegPath, ["-y", "-i", inputPath], { stdio: ["ignore", "pipe", "pipe"] });
      let stderr = "";
      let killed = false;

      const timer = setTimeout(() => {
        killed = true;
        try { probe.kill("SIGKILL"); } catch {}
        console.warn("[Video] probeVideo timed out after 30s");
        resolve({ duration: 0, width: 0, height: 0 });
      }, 30000);

      probe.stderr.on("data", (d) => { stderr += d.toString(); });
      probe.on("close", () => {
        clearTimeout(timer);
        if (killed) return;
        const durationMatch = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/);
        const resolutionMatch = stderr.match(/,\s*(\d{2,5})x(\d{2,5})/);
        resolve({
          duration: durationMatch
            ? parseInt(durationMatch[1]) * 3600 + parseInt(durationMatch[2]) * 60 + parseInt(durationMatch[3]) + (durationMatch[4] ? parseInt(durationMatch[4].slice(0, 2)) / 100 : 0)
            : 0,
          width: resolutionMatch ? parseInt(resolutionMatch[1]) : 0,
          height: resolutionMatch ? parseInt(resolutionMatch[2]) : 0,
        });
      });
      probe.on("error", () => {
        clearTimeout(timer);
        resolve({ duration: 0, width: 0, height: 0 });
      });
    });
  },

  async getVideoDuration(inputPath) {
    const result = await this.probeVideo(inputPath);
    return result.duration;
  },

  async getVideoResolution(inputPath) {
    const result = await this.probeVideo(inputPath);
    return { width: result.width, height: result.height };
  },

  runFFmpeg(args, timeoutMs = 300000) {
    return new Promise((resolve, reject) => {
      const ffmpegPath = config.video.ffmpegPath;
      const ffmpeg = spawn(ffmpegPath, ["-y", "-threads", "0", ...args], { stdio: ["ignore", "pipe", "pipe"] });
      let stderr = "";
      let killed = false;
      
      const timer = setTimeout(() => {
        killed = true;
        ffmpeg.kill("SIGKILL");
        reject(new Error(`FFmpeg timed out after ${timeoutMs / 1000}s`));
      }, timeoutMs);

      ffmpeg.stderr.on("data", (data) => { stderr += data.toString(); });
      ffmpeg.on("close", (code) => {
        clearTimeout(timer);
        if (killed) return;
        if (code === 0) resolve({ success: true });
        else reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(0, 500)}`));
      });
      ffmpeg.on("error", (err) => {
        clearTimeout(timer);
        reject(new Error(`FFmpeg not found at "${ffmpegPath}": ${err.message}`));
      });
    });
  },

  async generateCaptionFile(segments, outputPath) {
    let vtt = "WEBVTT\n\n";
    let count = 0;
    segments
      .filter((s) => s.end > s.start && s.start >= 0 && s.text?.trim())
      .forEach((seg, i) => {
        const start = this.formatTime(seg.start);
        const end = this.formatTime(seg.end);
        vtt += `${i + 1}\n${start} --> ${end}\n${seg.text.trim()}\n\n`;
        count++;
      });
    if (count === 0) {
      console.warn("[Video] No valid segments for VTT, creating empty file");
      vtt += "1\n00:00:00.000 --> 00:00:01.000\n \n";
    }
    await fs.promises.writeFile(outputPath, vtt, "utf-8");
    return outputPath;
  },

  parseSRT(content) {
    const blocks = content.trim().split(/\n\n+/);
    return blocks.map((block) => {
      const lines = block.trim().split("\n");
      if (lines.length < 3) return null;
      const timeMatch = lines[1]?.match(
        /(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/
      );
      if (!timeMatch) return null;
      const start =
        parseInt(timeMatch[1]) * 3600 +
        parseInt(timeMatch[2]) * 60 +
        parseInt(timeMatch[3]) +
        parseInt(timeMatch[4]) / 1000;
      const end =
        parseInt(timeMatch[5]) * 3600 +
        parseInt(timeMatch[6]) * 60 +
        parseInt(timeMatch[7]) +
        parseInt(timeMatch[8]) / 1000;
      const text = lines.slice(2).join(" ").replace(/<[^>]+>/g, "").trim();
      return { start, end, text };
    }).filter(Boolean);
  },

  formatTime(seconds) {
    const h = Math.floor(seconds / 3600).toString().padStart(2, "0");
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
    const s = Math.floor(seconds % 60).toString().padStart(2, "0");
    const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, "0");
    return `${h}:${m}:${s}.${ms}`;
  },
};
