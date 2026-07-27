import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto";

const execFileAsync = promisify(execFile);

const MODEL_NAME = "ggml-base.en.bin";
let whisperReady = false;

function getWhisperCliPath() {
  const binPath = path.join(process.cwd(), "bin", "whisper", "whisper-cli.exe");
  if (fs.existsSync(binPath)) return binPath;
  const altPath = path.join(process.cwd(), "bin", "whisper-cli.exe");
  if (fs.existsSync(altPath)) return altPath;
  return null;
}

export async function initWhisper() {
  const cliPath = getWhisperCliPath();
  if (!cliPath) {
    console.warn("[Whisper] whisper-cli.exe not found — transcription will use fallback");
    return false;
  }
  const modelPath = path.join(process.cwd(), "models", MODEL_NAME);
  if (!fs.existsSync(modelPath)) {
    console.warn("[Whisper] Model not found at", modelPath, "— transcription will use fallback");
    return false;
  }
  whisperReady = true;
  console.log(`[Whisper] CLI ready: ${cliPath}`);
  console.log(`[Whisper] Model: ${modelPath} (${(fs.statSync(modelPath).size / 1024 / 1024).toFixed(0)} MB)`);
  return true;
}

export function isWhisperReady() {
  return whisperReady;
}

export async function transcribeAudio(audioPath) {
  const cliPath = getWhisperCliPath();
  if (!cliPath || !whisperReady) throw new Error("Whisper not initialized — call initWhisper() first");
  if (!fs.existsSync(audioPath)) throw new Error(`Audio file not found: ${audioPath}`);

  const modelPath = path.join(process.cwd(), "models", MODEL_NAME);
  const tmpId = crypto.randomBytes(8).toString("hex");
  const outPrefix = path.join(os.tmpdir(), `whisper-${tmpId}`);
  const jsonPath = `${outPrefix}.json`;

  const threads = Math.max(2, Math.min(os.cpus().length, 8));

  const args = [
    "-m", modelPath,
    "-f", audioPath,
    "--language", "en",
    "-t", String(threads),
    "-bo", "1",
    "-sow",
    "-dtw", "base.en",
    "-ojf",
    "-np",
    "-of", outPrefix,
  ];

  const start = Date.now();
  let stdout = "";
  let stderr = "";

  try {
    const result = await execFileAsync(cliPath, args, {
      timeout: 30 * 60 * 1000,
      maxBuffer: 50 * 1024 * 1024,
      windowsHide: true,
    });
    stdout = result.stdout || "";
    stderr = result.stderr || "";
  } catch (err) {
    stderr = err.stderr || "";
    stdout = err.stdout || "";
    if (err.killed) throw new Error("Whisper transcription timed out (30 min limit)");
    throw new Error(`Whisper CLI failed: ${err.message}\n${stderr.slice(-500)}`);
  }

  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Whisper output not found at ${jsonPath}\nstderr: ${stderr.slice(-300)}`);
  }

  let json;
  try {
    const raw = fs.readFileSync(jsonPath, "utf-8");
    json = JSON.parse(raw);
  } finally {
    try { fs.unlinkSync(jsonPath); } catch {}
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  const segments = (json.transcription || []).map((seg) => {
    const allTokens = (seg.tokens || []).filter((t) => !t.text.match(/^\[_|^$/));
    const segStart = seg.offsets.from / 1000;
    const segEnd = seg.offsets.to / 1000;

    const validTokens = allTokens.filter((t) => t.t_dtw > 0);

    const words = allTokens.map((t) => {
      if (t.t_dtw > 0) {
        return {
          word: t.text.trim(),
          start: t.offsets.from / 1000,
          end: t.offsets.to / 1000,
        };
      }

      const prevWord = validTokens.filter((v) => v.offsets.from <= t.offsets.from).pop();
      const nextWord = validTokens.find((v) => v.offsets.from >= t.offsets.from);
      const fallbackStart = prevWord ? prevWord.offsets.to / 1000 : segStart;
      const fallbackEnd = nextWord ? nextWord.offsets.from / 1000 : segEnd;
      const start = fallbackStart < fallbackEnd ? fallbackStart : fallbackEnd;
      const end = fallbackEnd > start ? fallbackEnd : start + 0.05;

      return {
        word: t.text.trim(),
        start,
        end,
      };
    }).filter((w) => w.word.length > 0);

    return {
      start: segStart,
      end: segEnd,
      text: (seg.text || "").trim(),
      words,
    };
  });

  const wordCount = segments.reduce((s, seg) => s + seg.words.length, 0);
  console.log(`[Whisper] Transcription complete in ${elapsed}s — ${segments.length} segments, ${wordCount} words`);

  const fullText = segments.map((s) => s.text).join(" ");

  return { text: fullText, segments, language: json.result?.language || "en" };
}

export function sliceTranscript(fullTranscript, startTime, endTime) {
  if (!fullTranscript || !fullTranscript.segments) {
    return { text: "", segments: [], words: [] };
  }

  const slicedSegments = [];
  const allWords = [];

  for (const seg of fullTranscript.segments) {
    if (seg.end <= startTime || seg.start >= endTime) continue;

    const segStart = Math.max(0, seg.start - startTime);
    const segEnd = Math.min(endTime - startTime, seg.end - startTime);

    const segWords = (seg.words || [])
      .filter((w) => w.start < endTime && w.end > startTime)
      .map((w) => ({
        word: w.word,
        start: Math.max(0, w.start - startTime),
        end: Math.min(endTime - startTime, w.end - startTime),
      }));

    const wordsForText = segWords.length > 0 ? segWords : (seg.words || []);
    const text = wordsForText.length > 0
      ? wordsForText.map((w) => w.word).join(" ")
      : seg.text || "";

    slicedSegments.push({
      start: segStart,
      end: segEnd,
      text,
      words: segWords,
    });

    allWords.push(...segWords);
  }

  const fullText = slicedSegments.map((s) => s.text).join(" ");
  return { text: fullText || "", segments: slicedSegments, words: allWords };
}
