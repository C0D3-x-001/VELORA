import { spawn } from "child_process";
import fs from "fs";
import config from "../../config/env.js";

function runFFmpeg(args, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    const proc = spawn(config.video.ffmpegPath, ["-y", ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    let killed = false;
    const timer = setTimeout(() => { killed = true; proc.kill("SIGTERM"); }, timeoutMs);
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (killed) return reject(new Error("FFmpeg render timed out"));
      if (code !== 0) return reject(new Error(`FFmpeg exited ${code}: ${stderr.slice(-500)}`));
      resolve();
    });
    proc.on("error", (e) => { clearTimeout(timer); reject(e); });
  });
}

export async function renderEditedClip(inputPath, instructions, outputPath) {
  const vfFilters = [];
  const afFilters = [];

  const needsFilterComplex = buildCutFilters(instructions, vfFilters, afFilters);
  buildVideoFilters(instructions, vfFilters);
  buildAudioFilters(instructions, afFilters);

  const args = ["-i", inputPath];

  if (needsFilterComplex && vfFilters.length > 0) {
    args.push(
      "-filter_complex",
      `[0:v]${vfFilters.join(",")}[v];[0:a]${afFilters.join(",")}[a]`,
      "-map", "[v]", "-map", "[a]",
    );
  } else {
    if (vfFilters.length > 0) {
      args.push("-vf", vfFilters.join(","));
    }
    if (afFilters.length > 0) {
      args.push("-af", afFilters.join(","));
    }
  }

  args.push(
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-crf", "23",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-movflags", "+faststart",
    outputPath,
  );

  await runFFmpeg(args, 300000);

  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 1024) {
    throw new Error("Rendered output is missing or too small");
  }
}

function buildCutFilters(instructions, vfFilters, afFilters) {
  const { cuts } = instructions;
  if (!cuts || cuts.length === 0) return false;

  const sortedCuts = [...cuts].sort((a, b) => a.start - b.start);
  const segments = [];
  let lastEnd = 0;

  for (const cut of sortedCuts) {
    if (cut.start > lastEnd) {
      segments.push({ start: lastEnd, end: cut.start });
    }
    lastEnd = cut.end;
  }

  const duration = getClipDuration(instructions);
  if (lastEnd < duration) {
    segments.push({ start: lastEnd, end: duration });
  }

  if (segments.length === 0 || segments.length >= sortedCuts.length + 2) return false;

  const selectParts = segments.map((s) =>
    `between(t,${s.start.toFixed(3)},${s.end.toFixed(3)})`
  ).join("+");

  vfFilters.push(`select='${selectParts}',setpts=N/FRAME_RATE/TB`);
  afFilters.push(`aselect='${selectParts}',asetpts=N/SR/TB`);
  return true;
}

function buildVideoFilters(instructions, filters) {
  const { zooms, color_correction, effects } = instructions;

  if (zooms && zooms.length > 0) {
    for (const zoom of zooms) {
      const z = zoom.scale || 1.1;
      const d = Math.round((zoom.duration || 0.5) * 25);
      filters.push(
        `zoompan=z='if(between(t,${zoom.time.toFixed(3)},${(zoom.time + (zoom.duration || 0.5)).toFixed(3)}),min(zoom+0.003,${z.toFixed(2)}),1)'` +
        `:d=${d}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=25`
      );
    }
  }

  if (color_correction) {
    const parts = [];
    if (color_correction.brightness !== 1.0) {
      parts.push(`brightness=${(color_correction.brightness - 1.0).toFixed(2)}`);
    }
    if (color_correction.contrast !== 1.0) {
      parts.push(`contrast=${color_correction.contrast.toFixed(2)}`);
    }
    if (color_correction.saturation !== 1.0) {
      parts.push(`saturation=${color_correction.saturation.toFixed(2)}`);
    }
    if (parts.length > 0) {
      filters.push(`eq=${parts.join(":")}`);
    }
  }

  if (effects) {
    for (const effect of effects) {
      if (effect.type === "speed_change" && effect.params?.speed) {
        const speed = clamp(Number(effect.params.speed), 0.5, 2.0);
        filters.push(`setpts=${(1 / speed).toFixed(3)}*PTS`);
      }
      if (effect.type === "stabilization") {
        filters.push("deshake");
      }
    }
  }
}

function buildAudioFilters(instructions, filters) {
  const { audio } = instructions;

  if (!audio || audio.length === 0) {
    filters.push("loudnorm=I=-16:LRA=11:TP=-1.5");
    return;
  }

  for (const a of audio) {
    if (a.type === "normalize") {
      filters.push("loudnorm=I=-16:LRA=11:TP=-1.5");
    }
    if (a.type === "silence_remove") {
      filters.push("silenceremove=start_periods=1:start_duration=0.1:start_threshold=-50dB");
    }
    if (a.type === "volume_change" && a.params?.level != null) {
      const level = clamp(Number(a.params.level), 0.1, 3.0);
      filters.push(`volume=${level.toFixed(2)}`);
    }
  }

  if (!filters.some((f) => f.includes("loudnorm"))) {
    filters.push("loudnorm=I=-16:LRA=11:TP=-1.5");
  }
}

function getClipDuration(instructions) {
  const allTimes = [
    ...(instructions.cuts || []).map((c) => c.end),
    ...(instructions.zooms || []).map((z) => z.time + (z.duration || 0)),
    ...(instructions.captions || []).map((c) => c.end),
  ];
  return allTimes.length > 0 ? Math.max(...allTimes) : 30;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}
