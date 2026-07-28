import { supabaseAdmin, isConfigured } from "../config/supabase.js";
import { calculateCredits, getBalance, reserveCredits, refundCredits } from "./credit.js";
import { downloadService } from "./download.js";
import { videoService } from "./video.js";
import { aiService } from "./ai.js";
import { refineAllClipBoundaries, findResolvingEndPoint, flattenWords } from "./clip-boundary.js";
import { deleteProjectFiles } from "./storage.js";
import { uploadFile, getSignedUrl } from "./storage.js";
import { applyVideoEnhancements } from "./video-processing/index.js";
import { transcribeAudio, sliceTranscript, isWhisperReady } from "./transcription.js";
import { segmentsToSRT } from "./srt-utils.js";
import config from "../config/env.js";
import fs from "fs";
import path from "path";

const devProjects = new Map();
const devClips = new Map();
let devIdCounter = 1;

const activePipelines = new Map();

const REFUND_TTL_MS = 60 * 60 * 1000;
const refundedProjects = new Map();
const inflightRefunds = new Map();

function markRefunded(projectId) {
  refundedProjects.set(projectId, Date.now());
}

function isRefunded(projectId) {
  const ts = refundedProjects.get(projectId);
  if (!ts) return false;
  if (Date.now() - ts > REFUND_TTL_MS) {
    refundedProjects.delete(projectId);
    return false;
  }
  return true;
}

function cleanupRefundCache() {
  const now = Date.now();
  for (const [k, ts] of refundedProjects) {
    if (now - ts > REFUND_TTL_MS) refundedProjects.delete(k);
  }
}
setInterval(cleanupRefundCache, 10 * 60 * 1000).unref();

async function guardedRefund(userId, amount, reason, projectId) {
  if (isRefunded(projectId)) return false;
  const existing = inflightRefunds.get(projectId);
  if (existing) {
    await existing;
    return false;
  }
  const promise = refundCredits(userId, amount, reason, projectId)
    .then(() => { markRefunded(projectId); })
    .finally(() => { inflightRefunds.delete(projectId); });
  inflightRefunds.set(projectId, promise);
  await promise;
  return true;
}

function makeId() {
  return `dev_${Date.now()}_${devIdCounter++}`;
}

export async function createProject(userId, { title, source, url, settings }) {
  if (!isConfigured) {
    const id = makeId();
    const project = {
      id,
      user_id: userId,
      title,
      source_type: source,
      source_url: url,
      thumbnail_url: "https://picsum.photos/seed/" + id + "/640/360",
      duration_seconds: 7200,
      status: "created",
      settings: settings || {},
      clips_count: 0,
      avg_viral_score: null,
      created_at: new Date().toISOString(),
    };
    devProjects.set(id, project);
    return { id, status: "created" };
  }

  const { data, error } = await supabaseAdmin
    .from("projects")
    .insert({
      user_id: userId,
      title,
      source_type: source,
      source_url: url,
      settings,
      status: "created",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getProjects(userId) {
  if (!isConfigured) {
    // Add sample projects if none exist
    if (devProjects.size === 0) {
      const sample1Id = makeId();
      const sample1 = {
        id: sample1Id,
        user_id: userId,
        title: "How to Go Viral in 2026",
        source_type: "upload",
        source_url: "",
        thumbnail_url: "https://picsum.photos/seed/sample1/640/360",
        duration_seconds: 3600,
        status: "completed",
        settings: {},
        clips_count: 8,
        avg_viral_score: 85,
        created_at: new Date(Date.now() - 86400000).toISOString(),
      };
      devProjects.set(sample1Id, sample1);
      // Add mock clips for sample1
      devClips.set(sample1Id, generateMockClips(sample1Id, 8, 60, {}));
      
      const sample2Id = makeId();
      const sample2 = {
        id: sample2Id,
        user_id: userId,
        title: "The Future of Content Creation",
        source_type: "youtube",
        source_url: "https://youtube.com/watch?v=dQw4w9WgXcQ",
        thumbnail_url: "https://picsum.photos/seed/sample2/640/360",
        duration_seconds: 1800,
        status: "processing",
        settings: {},
        clips_count: 0,
        avg_viral_score: null,
        created_at: new Date(Date.now() - 172800000).toISOString(),
      };
      devProjects.set(sample2Id, sample2);
    }

    return Array.from(devProjects.values())
      .filter((p) => p.user_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("*, clips(count)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getProject(userId, projectId) {
  if (!isConfigured) {
    const project = devProjects.get(projectId);
    if (!project) return null;
    const clips = devClips.get(projectId) || [];
    return { ...project, clips, transcripts: [] };
  }

  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("*, clips(*, clip_metadata(*))")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  return data;
}

const STATUS_TO_INDEX = {
  downloading: 0, transcribing: 1, analyzing: 2,
  processing: 3, enhancing: 4, uploading: 5, completed: 6, failed: 7,
};

export async function getProjectStatus(userId, projectId) {
  if (!isConfigured) {
    const project = devProjects.get(projectId);
    if (!project) return null;
    return {
      id: project.id,
      status: project.status,
      progress: 0,
      currentStep: project.status,
      clipsGenerated: (devClips.get(projectId) || []).length,
      totalClips: project.settings?.clipCount || 0,
      error: project.error_message || null,
      updatedAt: project.updated_at,
    };
  }

  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("id, status, clips_count, settings, error_message, updated_at")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  if (!data) return null;

  const idx = STATUS_TO_INDEX[data.status] ?? 0;
  const total = 7;

  return {
    id: data.id,
    status: data.status,
    progress: Math.min(100, Math.round((idx / total) * 100)),
    currentStep: data.status,
    clipsGenerated: data.clips_count || 0,
    totalClips: data.settings?.clipCount || 0,
    error: data.error_message || null,
    updatedAt: data.updated_at,
  };
}

export async function getProjectClips(userId, projectId) {
  if (!isConfigured) {
    return devClips.get(projectId) || [];
  }

  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (!project) return null;

  const { data, error } = await supabaseAdmin
    .from("clips")
    .select("*, clip_metadata(*)")
    .eq("project_id", projectId)
    .order("order_index", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function deleteProject(userId, projectId) {
  if (!isConfigured) {
    devProjects.delete(projectId);
    devClips.delete(projectId);
    return { success: true };
  }

  try {
    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("original_video_url, source_url")
      .eq("id", projectId)
      .eq("user_id", userId)
      .single();

    if (project) {
      if (project.original_video_url) downloadService.cleanup(project.original_video_url);
      if (project.source_url) downloadService.cleanup(project.source_url);
    }
  } catch (err) {
    console.error(`[Project] Error cleaning up local files on delete:`, err.message);
  }

  downloadService.cleanupAll(projectId);

  try { await deleteProjectFiles(userId, projectId); } catch { /* best effort */ }

  const { error } = await supabaseAdmin
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", userId);

  if (error) throw error;
  return { success: true };
}

export async function generateClips(userId, projectId, settings) {
  if (!isConfigured) {
    return generateMockClipsDev(projectId, settings);
  }

  const { data: project, error: projError } = await supabaseAdmin
    .from("projects")
    .select("source_type, source_url, original_video_url, status, updated_at, duration_seconds, settings")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (projError || !project) throw new Error("Project not found");

  // Allow re-run if project is stuck in processing/analyzing for >15 minutes
  const stuckThreshold = 15 * 60 * 1000;
  const stuckStatuses = ["processing", "analyzing", "downloading", "transcribing", "uploading", "enhancing"];
  const isStuck = stuckStatuses.includes(project.status) &&
    project.updated_at && (Date.now() - new Date(project.updated_at).getTime()) > stuckThreshold;

  if (stuckStatuses.includes(project.status) && !isStuck) {
    throw new Error("This project is already being processed");
  }

  if (project.status === "failed" || project.status === "completed" || isStuck) {
    await supabaseAdmin.from("clips").delete().eq("project_id", projectId);
    await supabaseAdmin.from("transcripts").delete().eq("project_id", projectId);
    await supabaseAdmin.from("projects").update({
      clips_count: 0,
      avg_viral_score: null,
      error_message: isStuck ? "Recovering from stuck pipeline" : null,
    }).eq("id", projectId);
    if (isStuck) console.log(`[Pipeline] Project ${projectId} was stuck for >15 min, recovering`);
  }

  const clipCount = settings.clipCount || 10;
  const clipDuration = settings.clipDuration ?? null;
  const estimatedCredits = clipDuration != null
    ? calculateCredits(clipCount, clipDuration)
    : calculateCredits(clipCount, 120);

  const balance = await getBalance(userId);
  if (balance.balance < estimatedCredits) {
    throw new Error(`Insufficient credits. Need ${estimatedCredits}, have ${balance.balance}`);
  }

  const CLOSEUP_FRAMING_TIERS = ["pro", "business"];
  if (settings.closeUpFraming && !CLOSEUP_FRAMING_TIERS.includes(balance.plan)) {
    throw new Error("AI Close-Up Framing requires a Pro or Business subscription. Please upgrade your plan.");
  }

  // Reserve credits upfront to avoid double spending
  await reserveCredits(userId, estimatedCredits, `Generating ${clipCount} clips`, projectId);

  if (activePipelines.has(projectId)) {
    await guardedRefund(userId, estimatedCredits, "Refund for duplicate pipeline", projectId);
    throw new Error("This project is already being processed");
  }

  const abortController = new AbortController();
  activePipelines.set(projectId, abortController);

  processVideoBackground(projectId, project, userId, settings, estimatedCredits, balance.plan, abortController.signal).catch((err) => {
    console.error(`[Pipeline] Fatal error for project ${projectId}:`, err);

    if (!isRefunded(projectId)) {
      console.error(`[Pipeline] Attempting safety-net refund for project ${projectId}`);
      guardedRefund(userId, estimatedCredits, "Refund for fatal pipeline error", projectId)
        .then((refunded) => {
          if (refunded) console.log(`[Pipeline] Safety-net refund succeeded for project ${projectId}`);
        })
        .catch((refErr) => console.error(`[Pipeline] Safety-net refund also failed:`, refErr.message));
    }

    activePipelines.delete(projectId);

    supabaseAdmin.from("projects").update({
      status: "failed",
      error_message: err.message || "Pipeline crashed",
    }).eq("id", projectId).then(() => {}).catch(() => {});
  });

  return { jobId: `job_${Date.now()}`, status: "queued" };
}

async function processVideoBackground(projectId, project, userId, settings, estimatedCredits, userPlan = "free", signal) {
  const PID = projectId.slice(0, 8);
  const log = (msg) => console.log(`[Pipeline:${PID}] ${msg}`);
  const warn = (msg) => console.warn(`[Pipeline:${PID}] ${msg}`);
  const err = (msg) => console.error(`[Pipeline:${PID}] ${msg}`);
  const pipelineStart = Date.now();

  let videoPath = null;
  let audioPath = null;
  let subtitlePath = null;

  // Safety timeout: scales with video duration (min 30 min, or 1.5x video length)
  let PIPELINE_TIMEOUT_MS = 30 * 60 * 1000;
  let pipelineTimer = null;

  function startPipelineTimer() {
    if (pipelineTimer) clearTimeout(pipelineTimer);
    pipelineTimer = setTimeout(async () => {
      err(`TIMEOUT: exceeded ${PIPELINE_TIMEOUT_MS / 60000} min — marking failed and refunding`);
      if (signal) signal.abort(new Error(`Pipeline timed out after ${Math.round(PIPELINE_TIMEOUT_MS / 60000)} minutes`));
      try {
        await supabaseAdmin.from("projects").update({
          status: "failed",
          error_message: `Pipeline timed out after ${Math.round(PIPELINE_TIMEOUT_MS / 60000)} minutes`,
        }).eq("id", projectId);
      } catch (e) { err(`Timeout DB update failed: ${e.message}`); }
      try {
        const refunded = await guardedRefund(userId, estimatedCredits, "Refund for pipeline timeout", projectId);
        if (refunded) log(`Credits refunded after timeout`);
      } catch (e) {
        err(`Timeout refund failed: ${e.message}`);
      }
    }, PIPELINE_TIMEOUT_MS);
  }
  startPipelineTimer();

  try {
    const updateStatus = async (status) => {
      log(`Status → ${status}`);
      try {
        const { error } = await supabaseAdmin
          .from("projects")
          .update({ status, updated_at: new Date().toISOString() })
          .eq("id", projectId);
        if (error) {
          if (error.code === "23514" || error.message?.includes("check constraint")) {
            err(`DB constraint violation for status "${status}" — migration may not be applied. Status: ${status}`);
          } else {
            err(`Failed to update status to ${status}: ${error.message}`);
          }
        }
      } catch (e) {
        err(`Status update exception for "${status}": ${e.message}`);
      }
    };

    await updateStatus("downloading");

    // ── Download ──
    if (project.source_type === "youtube") {
      const dlStart = Date.now();
      const DOWNLOAD_TIMEOUT_MS = 600000;
      try {
        log(`Downloading video from YouTube...`);
        const downloadPromise = downloadService.downloadVideo(project.source_url, projectId, signal);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Download timed out after 10 minutes")), DOWNLOAD_TIMEOUT_MS)
        );
        const downloaded = await Promise.race([downloadPromise, timeoutPromise]);
        videoPath = downloaded.path;
        subtitlePath = downloaded.subtitlePath || null;
        log(`Download complete (${((Date.now() - dlStart) / 1000).toFixed(1)}s) — duration: ${downloaded.duration}s`);
        await supabaseAdmin.from("projects").update({
          duration_seconds: downloaded.duration,
          original_video_url: downloaded.path,
        }).eq("id", projectId);
        project.duration_seconds = downloaded.duration;
      } catch (downloadErr) {
        err(`Download failed after ${((Date.now() - dlStart) / 1000).toFixed(1)}s: ${downloadErr.message}`);
        const msg = downloadErr.code ? downloadErr.message : `Failed to download YouTube video: ${downloadErr.message}`;
        const classified = new Error(msg);
        if (downloadErr.code) classified.code = downloadErr.code;
        throw classified;
      }
    } else if (project.original_video_url && fs.existsSync(project.original_video_url)) {
      videoPath = project.original_video_url;
      log(`Using uploaded file: ${videoPath}`);
    } else if (project.source_url && fs.existsSync(project.source_url)) {
      videoPath = project.source_url;
      log(`Using source file: ${videoPath}`);
    } else {
      throw new Error("No video source found. Re-upload the file and try again.");
    }

    if (!videoPath || !fs.existsSync(videoPath)) {
      throw new Error("Video file not found on disk. Re-upload and try again.");
    }

    // ── Probe ──
    const probeStart = Date.now();
    log(`Probing video duration...`);
    const probe = await videoService.probeVideo(videoPath);
    project.duration_seconds = probe.duration;
    log(`Probe complete (${((Date.now() - probeStart) / 1000).toFixed(1)}s) — ${probe.duration}s, ${probe.width}x${probe.height}`);
    if (probe.duration === 0) {
      throw new Error("Could not determine video duration — file may be corrupted");
    }
    PIPELINE_TIMEOUT_MS = Math.max(30 * 60 * 1000, probe.duration * 1000 * 1.5);
    startPipelineTimer();
    await supabaseAdmin.from("projects").update({ duration_seconds: probe.duration }).eq("id", projectId);

    await updateStatus("transcribing");

    // ── Transcript ──
    let transcript;
    if (subtitlePath && fs.existsSync(subtitlePath)) {
      const srtStart = Date.now();
      try {
        log(`Parsing YouTube auto-captions...`);
        const srtContent = await fs.promises.readFile(subtitlePath, "utf-8");
        const segments = videoService.parseSRT(srtContent);
        if (segments.length > 0) {
          transcript = {
            text: segments.map((s) => s.text).join(" "),
            segments,
            source: "youtube_auto_caption",
          };
          log(`Auto-captions parsed (${((Date.now() - srtStart) / 1000).toFixed(1)}s) — ${segments.length} segments, ${Math.round(segments[segments.length - 1]?.end || 0)}s coverage`);
        } else {
          warn(`SRT parsed to 0 segments, falling back to transcription`);
          subtitlePath = null;
        }
      } catch (parseErr) {
        err(`SRT parse failed: ${parseErr.message}`);
        subtitlePath = null;
      }
    }

    if (!transcript) {
      const transcribeStart = Date.now();
      try {
        const audioDir = path.dirname(videoPath);
        audioPath = path.join(audioDir, `audio_${projectId}.mp3`);
        log(`Extracting audio...`);
        const audioResult = await videoService.extractAudio(videoPath, audioPath);

        if (audioResult.success && fs.existsSync(audioPath)) {
          log(`Audio extracted (${((Date.now() - transcribeStart) / 1000).toFixed(1)}s) — transcribing with Whisper...`);
          transcript = await transcribeAudio(audioPath);
          log(`Transcription complete (${((Date.now() - transcribeStart) / 1000).toFixed(1)}s) — ${transcript.segments?.length || 0} segments`);
        } else {
          warn(`Audio extraction failed, re-extracting from video`);
          const fallbackAudio = path.join(audioDir, `audio_fallback_${projectId}.mp3`);
          const fallbackResult = await videoService.extractAudio(videoPath, fallbackAudio);
          if (fallbackResult?.success && fs.existsSync(fallbackAudio)) {
            transcript = await transcribeAudio(fallbackAudio);
            try { fs.unlinkSync(fallbackAudio); } catch {}
          } else {
            throw new Error("Audio extraction failed completely");
          }
          audioPath = null;
        }
      } catch (transcribeErr) {
        err(`Transcription step failed: ${transcribeErr.message}`);
        throw new Error(`Transcription failed: ${transcribeErr.message}`);
      }
    }

    // ── Save transcript ──
    if (transcript && transcript.text) {
      try {
        await supabaseAdmin.from("transcripts").insert({
          project_id: projectId,
          content: transcript.text,
          segments: transcript.segments || [],
          language: "en",
        });
        log(`Transcript saved to DB`);
      } catch (saveErr) {
        err(`Failed to save transcript: ${saveErr.message}`);
      }
    }

    await updateStatus("analyzing");

    // ── AI Analysis ──
    const clipCount = settings.clipCount || 10;
    const clipDuration = settings.clipDuration ?? null;
    const totalDuration = project.duration_seconds || 60;

    const analysisStart = Date.now();
    let analysis;
    try {
      log(`Running AI analysis on transcript...`);
      analysis = await aiService.analyze(transcript.text || "", totalDuration, clipDuration, transcript.segments || []);
      log(`Analysis complete (${((Date.now() - analysisStart) / 1000).toFixed(1)}s) — ${(analysis.moments || []).length} moments found (provider: ${analysis.provider || "unknown"})`);
    } catch (analysisErr) {
      err(`Analysis failed: ${analysisErr.message} — using fallback`);
      const fallbackDuration = clipDuration || 60;
      analysis = {
        moments: [
          { start: 0, end: fallbackDuration, overallScore: 75, hookScore: 8, reason: "Opening segment" },
        ],
        provider: "fallback",
      };
    }

    const moments = analysis.moments || [];
    const targetDuration = clipDuration;
    const maxStart = clipDuration != null ? Math.max(0, totalDuration - targetDuration) : totalDuration;

    // ── Resolution validation: fix AI-optimized moments with unresolved endings ──
    if (clipDuration == null && transcript.segments && transcript.segments.length > 0) {
      const flatWords = flattenWords(transcript.segments);
      let resolvedCount = 0;
      let discardedCount = 0;

      for (let mi = moments.length - 1; mi >= 0; mi--) {
        const m = moments[mi];
        if (!m._needsResolutionFix) continue;

        const mStart = Number(m.start) || 0;
        const mEnd = Number(m.end) || mStart + 60;

        // Try to find a resolving end point within the 30-120s window
        const fix = findResolvingEndPoint(mStart, mEnd, transcript.segments, flatWords, totalDuration, 25);

        if (fix && fix.resolved) {
          const oldEnd = m.end;
          m.end = Math.round(fix.newEnd);
          delete m._needsResolutionFix;
          resolvedCount++;
          log(`Clip "${m.title}": adjusted end ${oldEnd}s → ${m.end}s (${fix.reason})`);
        } else {
          // No resolving end point found — discard
          console.warn(`[Resolution] Discarding "${m.title}" (${mStart}-${mEnd}s) — no resolving endpoint in 30-120s window`);
          moments.splice(mi, 1);
          discardedCount++;
        }
      }

      if (resolvedCount > 0 || discardedCount > 0) {
        log(`Resolution pass: ${resolvedCount} adjusted, ${discardedCount} discarded`);
      }
    }

    const rawSchedule = [];
    for (let i = 0; i < clipCount; i++) {
      let startTime, endTime;
      if (moments.length > 0 && moments[i]) {
        startTime = Math.max(0, Math.floor(moments[i].start || 0));
        if (clipDuration != null) {
          endTime = startTime + targetDuration;
        } else {
          endTime = Math.floor(Number(moments[i].end) || startTime + 60);
          if (endTime <= startTime) endTime = startTime + 60;
        }
      } else {
        const fallbackDuration = targetDuration || 60;
        const safeMax = Math.max(0, totalDuration - fallbackDuration);
        startTime = Math.floor((i / Math.max(clipCount, 1)) * safeMax);
        endTime = startTime + fallbackDuration;
      }
      startTime = Math.min(startTime, maxStart);
      endTime = Math.min(endTime, totalDuration || (startTime + (targetDuration || 60)));
      if (endTime - startTime < 10) endTime = Math.min(startTime + 10, totalDuration || (startTime + 10));
      rawSchedule.push({ i, startTime, endTime });
    }

    const clipSchedule = refineAllClipBoundaries(rawSchedule, transcript, totalDuration, {
      maxSnapBack: 5,
      maxSnapForward: 3,
      minClipDuration: 10,
      maxClipDuration: (targetDuration || 120) + 15,
      leadInMs: 200,
    });

    for (const clip of clipSchedule) {
      const snapBack = rawSchedule[clip.i]?.startTime - clip.startTime;
      const snapFwd = clip.endTime - rawSchedule[clip.i]?.endTime;
      if (Math.abs(snapBack) > 0.5 || Math.abs(snapFwd) > 0.5) {
        log(`Clip ${clip.i}: snapped start ${snapBack > 0 ? "-" : "+"}${Math.abs(snapBack).toFixed(1)}s, end ${snapFwd > 0 ? "+" : "-"}${Math.abs(snapFwd).toFixed(1)}s (boundary: ${clip._boundary?.startType || "none"})`);
      }
      // Post-processing: log resolution status from boundary refinement safety net
      const res = clip._boundary?.resolution;
      if (res && !res.resolved) {
        log(`Clip ${clip.i}: ⚠ post-process flagged unresolved ending — ${res.reason} ("${(res.closingText || "").slice(0, 60)}")`);
      }
    }

    const needsVertical = settings.platform === "vertical";

    const metadataInput = clipSchedule.map(({ i, startTime, endTime }) => {
      const clipSegments = (transcript.segments || []).filter((s) => s.end > startTime && s.start < endTime);
      const viralScore = moments[i]?.overallScore || moments[i]?.score || Math.floor(Math.random() * 35) + 65;
      return {
        i,
        viralScore,
        transcript: clipSegments.map((s) => s.text).join(" ") || transcript.text || "",
      };
    });

    // Start metadata generation early (runs in parallel with cutting)
    const metadataPromise = aiService.generateAllMetadata(metadataInput).catch(() =>
      metadataInput.map((c) => ({ title: `Clip ${c.i + 1}`, caption: "", hashtags: [] }))
    );

    await updateStatus("processing");

    // ── Clean stale temp files from any previous run ──
    const clipDir = videoPath ? path.dirname(videoPath) : null;
    if (clipDir && fs.existsSync(clipDir)) {
        const stalePrefixes = [`clip_${projectId}_`, `clip_v_${projectId}_`, `thumb_${projectId}_`, `sub_${projectId}_`, `clip_burned_${projectId}_`, `enhanced_`];
      fs.readdirSync(clipDir)
        .filter((f) => stalePrefixes.some((p) => f.startsWith(p)))
        .forEach((f) => { try { fs.unlinkSync(path.join(clipDir, f)); } catch {} });
      log(`Cleaned stale temp files from previous runs`);
    }

    // ── Cut Clips ──
    const CONCURRENCY = 3;
    const cutStart = Date.now();
    log(`Cutting & converting ${clipCount} clips (concurrency ${CONCURRENCY})...`);

    const cutTasks = clipSchedule.map(({ i, startTime, endTime }) => async () => {
      const clipVideoPath = path.join(path.dirname(videoPath), `clip_${projectId}_${i}.mp4`);
      let actualStartTime = startTime;
      try {
        const cutResult = await videoService.cutClip(videoPath, clipVideoPath, startTime, endTime - startTime);
        actualStartTime = cutResult.actualStartTime ?? startTime;
        const clipStats = fs.statSync(clipVideoPath);
        if (clipStats.size < 1024) {
          throw new Error(`Cut produced invalid file (${clipStats.size} bytes)`);
        }
      } catch (cutErr) {
        err(`Failed to cut clip ${i}: ${cutErr.message}`);
        return { i, ok: false, error: cutErr.message };
      }

      if (needsVertical) {
        if (settings.closeUpFraming) {
          console.log(`[Pipeline] Clip ${i}: skipping vertical conversion — close-up framing will output 1080×1920`);
          return { i, clipVideoPath, finalClipPath: clipVideoPath, startTime, endTime, actualStartTime, ok: true };
        }
        try {
          const convertedPath = path.join(path.dirname(videoPath), `clip_v_${projectId}_${i}.mp4`);
          await videoService.convertToVertical(clipVideoPath, convertedPath);
          if (fs.existsSync(convertedPath)) {
            const vStats = fs.statSync(convertedPath);
            if (vStats.size < 1024) {
              throw new Error(`Vertical conversion produced invalid file (${vStats.size} bytes)`);
            }
            try { fs.unlinkSync(clipVideoPath); } catch {}
            return { i, clipVideoPath: convertedPath, finalClipPath: convertedPath, startTime, endTime, actualStartTime, ok: true };
          }
          throw new Error("Vertical conversion produced no output file");
        } catch (convErr) {
          err(`Vertical conversion failed for clip ${i}: ${convErr.message} — uploading original`);
          return { i, clipVideoPath, finalClipPath: clipVideoPath, startTime, endTime, actualStartTime, ok: true, conversionFailed: true };
        }
      }

      return { i, clipVideoPath, finalClipPath: clipVideoPath, startTime, endTime, actualStartTime, ok: true };
    });

    const cutResults = await runWithConcurrency(cutTasks, CONCURRENCY);
    const successfulCuts = cutResults.filter(r => r && r.ok);
    log(`Cut ${successfulCuts.length}/${clipCount} clips in ${((Date.now() - cutStart) / 1000).toFixed(1)}s`);

    if (successfulCuts.length === 0) {
      const cutErrors = cutResults.filter(r => r && r.error).map(r => r.error);
      throw new Error(`No clips could be cut — FFmpeg failed for all ${clipCount} segments. ${cutErrors[0] ? `First error: ${cutErrors[0]}` : "Check server logs for details."}`);
    }

    // ── Video Enhancements ──
    const hasEnhancements = settings.stabilization || settings.faceTracking || settings.autoReframe || settings.closeUpFraming;
    if (hasEnhancements) {
      await updateStatus("enhancing");
      log("Applying video enhancements...");
      const enhanceStart = Date.now();

      const enhanceTasks = successfulCuts.map((cut) => async () => {
        const { i, finalClipPath: cutPath, startTime, endTime } = cut;
        const clipDuration = endTime - startTime;

        if (!fs.existsSync(cutPath)) return;

        const enhancedDir = path.dirname(cutPath);
        try {
          const clipSegments = (transcript.segments || []).filter(
            (s) => s.end > startTime && s.start < endTime
          );

          const result = await applyVideoEnhancements(cutPath, enhancedDir, {
            stabilization: settings.stabilization,
            faceTracking: settings.faceTracking,
            autoReframe: settings.autoReframe,
            closeUpFraming: settings.closeUpFraming,
            closeUpMode: settings.closeUpMode || "closeup",
            autoPunchIn: settings.autoPunchIn || false,
            autoSpeakerSwitch: settings.autoSpeakerSwitch !== false,
            plan: userPlan,
            platform: settings.platform,
            duration: clipDuration,
            emphasisMap,
            segments: clipSegments,
            clipStart: startTime,
          });

          if (result.finalPath !== cutPath && fs.existsSync(result.finalPath)) {
            cut.enhancedPath = result.finalPath;
            if (result.enhancements.stabilization) log(`Clip ${i}: stabilization applied`);
            if (result.enhancements.faceTracking) log(`Clip ${i}: face tracking applied`);
            if (result.enhancements.autoReframe) log(`Clip ${i}: auto-reframe applied`);
          }
        } catch (enhErr) {
          err(`Clip ${i} enhancement failed: ${enhErr.message} — using original`);
        }
      });

      await runWithConcurrency(enhanceTasks, 3);
      log(`Enhancements done in ${((Date.now() - enhanceStart) / 1000).toFixed(1)}s`);
    }

    // ── Wait for Metadata ──
    const metadataStart = Date.now();
    log(`Waiting for metadata...`);
    const allMetadata = await metadataPromise;
    const metadataMap = new Map(
      metadataInput.map((input, idx) => [input.i, allMetadata[idx]])
    );
    log(`Metadata ready (${((Date.now() - metadataStart) / 1000).toFixed(1)}s)`);

    await updateStatus("uploading");

    // ── Upload ──
    const uploadStart = Date.now();
    log(`Uploading clips, thumbnails, subtitles...`);

    // Phase 1: Upload all files with concurrency limit
    const uploadTasks = successfulCuts.map((cut) => async () => {
      const { i, startTime, endTime, actualStartTime } = cut;
      const finalClipPath = cut.enhancedPath || cut.finalClipPath;
      const clipStartTime = actualStartTime ?? startTime;
      const clipSegments = (transcript.segments || []).filter((s) => s.end > clipStartTime && s.start < endTime);

      let clipVideoUrl = null;
      let clipThumbnailUrl = null;
      let clipSubtitlesUrl = null;

      if (!fs.existsSync(finalClipPath)) {
        return { i, startTime, endTime, clipVideoUrl, clipThumbnailUrl, clipSubtitlesUrl };
      }

      let videoToUpload = finalClipPath;
      try {
        const clipBuffer = await fs.promises.readFile(videoToUpload);
        const clipFileName = `clip_${projectId}_${i}.mp4`;
        await uploadFile("velora-storage", `users/${userId}/projects/${projectId}/clips/${clipFileName}`, clipBuffer, "video/mp4");
        clipVideoUrl = await getSignedUrl("velora-storage", `users/${userId}/projects/${projectId}/clips/${clipFileName}`, 86400 * 7);

        try {
          const thumbPath = path.join(path.dirname(videoPath), `thumb_${projectId}_${i}.jpg`);
          await videoService.extractThumbnail(finalClipPath, thumbPath, 0);
          if (fs.existsSync(thumbPath)) {
            const thumbBuffer = await fs.promises.readFile(thumbPath);
            const thumbFileName = `thumb_${projectId}_${i}.jpg`;
            await uploadFile("velora-storage", `users/${userId}/projects/${projectId}/thumbnails/${thumbFileName}`, thumbBuffer, "image/jpeg");
            clipThumbnailUrl = await getSignedUrl("velora-storage", `users/${userId}/projects/${projectId}/thumbnails/${thumbFileName}`, 86400 * 7);
            try { fs.unlinkSync(thumbPath); } catch {}
          }
        } catch (thumbErr) {
          err(`Failed to generate thumbnail ${i}: ${thumbErr.message}`);
        }

        if (videoToUpload !== cut.clipVideoPath) {
          try { fs.unlinkSync(videoToUpload); } catch {}
        }
        if (finalClipPath !== cut.clipVideoPath && finalClipPath !== videoToUpload) {
          try { fs.unlinkSync(finalClipPath); } catch {}
        }
      } catch (uploadErr) {
        err(`Failed to upload clip ${i}: ${uploadErr.message}`);
      }

      try {
        if (captionStyle !== "none" && clipSegments.length > 0) {
          const adjustedSegments = clipSegments.map((s) => ({
            start: Math.max(0, s.start - clipStartTime),
            end: Math.max(0, s.end - clipStartTime),
            text: s.text,
          }));
          const vttPath = path.join(path.dirname(videoPath), `sub_${projectId}_${i}.vtt`);
          await videoService.generateCaptionFile(adjustedSegments, vttPath);
          if (fs.existsSync(vttPath)) {
            const vttBuffer = await fs.promises.readFile(vttPath);
            const vttFileName = `sub_${projectId}_${i}.vtt`;
            const vttStoragePath = `users/${userId}/projects/${projectId}/subtitles/${vttFileName}`;
            await uploadFile("velora-storage", vttStoragePath, vttBuffer, "text/vtt");
            clipSubtitlesUrl = `/api/v1/clips/subtitles/${userId}/${projectId}/${vttFileName}`;
            try { fs.unlinkSync(vttPath); } catch {}
          }
        }
      } catch (subErr) {
        err(`Failed to generate subtitles for clip ${i}: ${subErr.message}`);
        clipSubtitlesUrl = null;
      }

      log(`Clip ${i + 1}/${clipCount} uploaded`);
      return { i, startTime, endTime, clipVideoUrl, clipThumbnailUrl, clipSubtitlesUrl };
    });

    const uploadResults = await runWithConcurrency(uploadTasks, 3);
    log(`All uploads done (${((Date.now() - uploadStart) / 1000).toFixed(1)}s)`);

    // Phase 2: Batch insert clips
    const clipInserts = uploadResults.map((result) => {
      const { i, startTime, endTime, clipVideoUrl, clipThumbnailUrl, clipSubtitlesUrl } = result;
      const viralScore = metadataInput[i]?.viralScore ?? 75;
      return {
        project_id: projectId,
        video_url: clipVideoUrl || `https://placeholder.velora.app/clip_${i}.mp4`,
        thumbnail_url: clipThumbnailUrl || `https://picsum.photos/seed/${projectId}_clip_${i}/320/568`,
        subtitles_url: clipSubtitlesUrl || null,
        duration_seconds: Math.round(endTime - startTime),
        start_time: Math.round(startTime),
        end_time: Math.round(endTime),
        viral_score: viralScore,
        caption_style: settings.captionStyle || "modern",
        caption_preset: settings.captionPreset || "classic",
        caption_config: settings.captionConfig || null,
        caption_position: settings.captionPosition || null,
        status: "completed",
        order_index: i,
      };
    });

    let { data: insertedClips, error: bulkClipError } = await supabaseAdmin
      .from("clips")
      .insert(clipInserts)
      .select("id, order_index");

    if (bulkClipError) {
      err(`Bulk insert failed: ${bulkClipError.message} — retrying one by one`);
      insertedClips = [];
      for (const clip of clipInserts) {
        try {
          const { data: single, error: singleErr } = await supabaseAdmin
            .from("clips")
            .insert(clip)
            .select("id, order_index")
            .single();
          if (singleErr) {
            err(`  Individual insert failed for clip ${clip.order_index}: ${singleErr.message}`);
          } else if (single) {
            insertedClips.push(single);
          }
        } catch (e) {
          err(`  Individual insert exception for clip ${clip.order_index}: ${e.message}`);
        }
      }
      log(`Individual insert recovered ${insertedClips.length}/${clipInserts.length} clips`);
    }

    // Phase 3: Batch insert metadata
    if (insertedClips && insertedClips.length > 0) {
      const metadataInserts = insertedClips.map((clip) => {
        const metadata = metadataMap.get(clip.order_index) || { title: `Clip ${clip.order_index + 1}`, caption: "", hashtags: [] };
        return {
          clip_id: clip.id,
          title: metadata.title || `Clip ${clip.order_index + 1}`,
          caption: metadata.caption || "",
          hashtags: metadata.hashtags || [],
        };
      });

      const { error: metaError } = await supabaseAdmin.from("clip_metadata").insert(metadataInserts);
      if (metaError) err(`Failed to bulk insert metadata: ${metaError.message}`);

      // Phase 4: Trigger AI editing
      if (config.ai.editing?.enabled) {
        for (const clip of insertedClips) {
          import("./video-editing/index.js").then(({ editClip }) => {
            editClip(projectId, clip.id, userId, {
              platform: settings.platform || "tiktok",
              captionStyle: settings.captionStyle || "classic",
            }).catch((e) => console.error(`[AI-Edit] Auto-edit failed for clip ${clip.id}:`, e.message));
          }).catch(() => {});
        }
      }
    }

    const clips = uploadResults.map((result) => {
      const { i, clipVideoUrl } = result;
      const viralScore = metadataInput[i]?.viralScore ?? 75;
      const metadata = metadataMap.get(i) || { title: `Clip ${i + 1}`, caption: "", hashtags: [] };
      return {
        id: insertedClips?.find(c => c.order_index === i)?.id || `clip_${i}`,
        video_url: clipVideoUrl,
        viral_score: viralScore,
        title: metadata.title,
      };
    });

    if (clips.length === 0) {
      throw new Error("No clips could be saved. Video files were cut but upload to cloud storage failed for every clip. Check server logs for Supabase/storage errors.");
    }

    // ── Complete ──
    const avgScore = Math.round(clips.reduce((s, c) => s + c.viral_score, 0) / clips.length);

    try {
      await supabaseAdmin.from("projects").update({
        status: "completed",
        clips_count: clips.length,
        avg_viral_score: avgScore,
      }).eq("id", projectId);
    } catch (finalErr) {
      err(`Failed to mark project completed: ${finalErr.message}`);
      if (finalErr.code === "23514" || finalErr.message?.includes("check constraint")) {
        err(`DB constraint issue — migration may not be applied. Project clips exist but status not updated.`);
      } else {
        await new Promise(r => setTimeout(r, 2000));
        try {
          await supabaseAdmin.from("projects").update({
            status: "completed",
            clips_count: clips.length,
            avg_viral_score: avgScore,
          }).eq("id", projectId);
        } catch (retryErr) {
          err(`Retry also failed: ${retryErr.message} — project may show stuck, use startup recovery`);
        }
      }
    }

    const totalSec = ((Date.now() - pipelineStart) / 1000).toFixed(1);
    log(`COMPLETED — ${clips.length} clips, avg score ${avgScore}, total time ${totalSec}s`);
    clearTimeout(pipelineTimer);
    activePipelines.delete(projectId);

  } catch (pipelineErr) {
    clearTimeout(pipelineTimer);
    activePipelines.delete(projectId);
    err(`FAILED after ${((Date.now() - pipelineStart) / 1000).toFixed(1)}s: ${pipelineErr.message}`);

    // Update status (best effort — must not block refund)
    try {
      await supabaseAdmin.from("projects").update({
        status: "failed",
        error_message: pipelineErr.message,
      }).eq("id", projectId);
      log(`Status → failed`);
    } catch (updateErr) {
      err(`Failed to update project status: ${updateErr.message}`);
    }

    // Refund credits (critical — retry up to 3 times with backoff)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const refunded = await guardedRefund(userId, estimatedCredits, `Refund for failed clip generation (attempt ${attempt + 1})`, projectId);
        if (refunded) log(`Credits refunded on attempt ${attempt + 1}`);
        break;
      } catch (refErr) {
        err(`Refund attempt ${attempt + 1} failed: ${refErr.message}`);
        if (attempt < 2) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  } finally {
    if (videoPath) downloadService.cleanup(videoPath);
    if (audioPath) downloadService.cleanup(audioPath);
    if (subtitlePath) downloadService.cleanup(subtitlePath);
    const tempDir = path.join(process.cwd(), "temp");
    if (fs.existsSync(tempDir)) {
      fs.readdirSync(tempDir)
        .filter((f) => f.includes(projectId) && !f.includes("upload_"))
        .forEach((f) => { try { fs.unlinkSync(path.join(tempDir, f)); } catch {} });
    }
    try {
      const clipDir = videoPath ? path.dirname(videoPath) : null;
      if (clipDir && fs.existsSync(clipDir)) {
        const prefixes = [`clip_${projectId}_`, `clip_v_${projectId}_`, `thumb_${projectId}_`, `sub_${projectId}_`, `clip_burned_${projectId}_`];
        fs.readdirSync(clipDir)
          .filter((f) => prefixes.some((p) => f.startsWith(p)))
          .forEach((f) => { try { fs.unlinkSync(path.join(clipDir, f)); } catch {} });
      }
    } catch { /* best effort cleanup */ }
  }
}

async function runWithConcurrency(tasks, limit) {
  const results = new Array(tasks.length);
  let cursor = 0;
  const workers = new Array(Math.min(limit, tasks.length)).fill(0).map(async () => {
    while (cursor < tasks.length) {
      const index = cursor++;
      results[index] = await tasks[index]();
    }
  });
  await Promise.all(workers);
  return results;
}

export async function updateProjectFilePath(userId, projectId, filePath) {
  if (!isConfigured) {
    const project = devProjects.get(projectId);
    if (project) {
      project.source_url = filePath;
      project.original_video_url = filePath;
      devProjects.set(projectId, project);
    }
    return;
  }

  await supabaseAdmin.from("projects").update({
    source_url: filePath,
    original_video_url: filePath,
  }).eq("id", projectId).eq("user_id", userId);
}

function generateMockClipsDev(projectId, settings) {
  const project = devProjects.get(projectId);
  if (!project) throw new Error("Project not found");

  const clipCount = settings.clipCount || 10;
  const clipDuration = settings.clipDuration ?? null;

  project.status = "analyzing";
  devProjects.set(projectId, project);

  setTimeout(() => {
    const p = devProjects.get(projectId);
    if (p) { p.status = "processing"; devProjects.set(projectId, p); }
  }, 2000);

  setTimeout(() => {
    const p = devProjects.get(projectId);
    if (p) { p.status = "processing"; devProjects.set(projectId, p); }
  }, 4000);

  setTimeout(() => {
    const p = devProjects.get(projectId);
    if (!p) return;

    const mockClips = generateMockClips(projectId, clipCount, clipDuration || 60, settings);
    devClips.set(projectId, mockClips);

    p.status = "completed";
    p.clips_count = mockClips.length;
    p.avg_viral_score = Math.round(mockClips.reduce((s, c) => s + c.viral_score, 0) / mockClips.length);
    devProjects.set(projectId, p);
  }, 6000);

  return { jobId: `job_${Date.now()}`, status: "queued" };
}

export async function recoverStuckProjects() {
  if (!isConfigured) return;

  try {
    const STUCK_THRESHOLD_MS = 5 * 60 * 1000;
    const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS).toISOString();

    const { data: stuckProjects, error } = await supabaseAdmin
      .from("projects")
      .select("id, user_id, settings, updated_at")
      .in("status", ["processing", "analyzing", "downloading", "transcribing", "uploading", "enhancing"])
      .lt("updated_at", cutoff);

    if (error || !stuckProjects || stuckProjects.length === 0) return;

    console.log(`[Startup] Recovering ${stuckProjects.length} stuck project(s)...`);

    for (const project of stuckProjects) {
      try {
        const clipCount = project.settings?.clipCount || 10;
        const clipDuration = project.settings?.clipDuration ?? null;
        const estimatedCredits = clipDuration != null
          ? calculateCredits(clipCount, clipDuration)
          : calculateCredits(clipCount, 120);

        await supabaseAdmin.from("projects").update({
          status: "failed",
          error_message: "Server restarted during processing — please retry",
        }).eq("id", project.id);

        if (!isRefunded(project.id)) {
          await guardedRefund(project.user_id, estimatedCredits, "Startup recovery refund", project.id);
          console.log(`[Startup] Refunded ${estimatedCredits} credits for project ${project.id}`);
        }
      } catch (err) {
        console.error(`[Startup] Failed to recover project ${project.id}:`, err.message);
      }
    }

    console.log(`[Startup] Recovery complete`);
  } catch (err) {
    console.error(`[Startup] Recovery scan failed:`, err.message);
  }
}

function generateMockClips(projectId, count, duration, settings) {
  const titles = [
    "The AI Revolution Nobody Talks About",
    "This Changed Everything About Content",
    "Why Most Creators Fail (The Truth)",
    "The Secret to Going Viral in 2026",
    "How I 10x'd My Audience in 30 Days",
    "The Future of Content Creation",
    "Why Short-Form is King",
    "The #1 Mistake New Creators Make",
    "Behind the Scenes: Building an Empire",
    "The Psychology of Viral Content",
    "Stop Doing This If You Want Views",
    "The Algorithm Hack Nobody Shares",
    "From 0 to 100K: The Real Story",
    "Content Strategy That Actually Works",
    "Why Consistency Beats Quality",
  ];

  const captions = [
    "This is the moment that changed my entire perspective on content creation.",
    "The data doesn't lie - this is what the algorithm rewards in 2026.",
    "I spent 3 years figuring this out so you don't have to.",
    "Most people skip this step and wonder why their videos flop.",
    "This single insight generated over a million views for me.",
  ];

  const hashtags = [
    ["viral", "contentcreator", "ai", "socialmedia", "growth"],
    ["shorts", "reels", "tiktok", "creator", "marketing"],
    ["podcastclips", "interview", "motivation", "business", "startup"],
    ["tips", "howto", "education", "knowledge", "learn"],
    ["trending", "fyp", "explore", "viralvideo", "content"],
  ];

  const clips = [];
  for (let i = 0; i < count; i++) {
    const clipId = `${projectId}_clip_${i}`;
    const viralScore = Math.floor(Math.random() * 35) + 65;
    const startTime = Math.floor(Math.random() * (3600 - duration));
    clips.push({
      id: clipId,
      project_id: projectId,
      video_url: `https://storage.example.com/clips/${clipId}.mp4`,
      thumbnail_url: `https://picsum.photos/seed/${clipId}/320/568`,
      duration_seconds: duration,
      start_time: startTime,
      end_time: startTime + duration,
      viral_score: viralScore,
      caption_style: settings.captionStyle || "modern",
      caption_preset: settings.captionPreset || "classic",
      status: "completed",
      order_index: i,
      title: titles[i % titles.length],
      caption: captions[i % captions.length],
      hashtags: hashtags[i % hashtags.length],
      created_at: new Date().toISOString(),
    });
  }

  return clips;
}
