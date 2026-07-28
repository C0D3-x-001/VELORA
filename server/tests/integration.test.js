import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const WHISPER_CLI = path.join(process.cwd(), "bin", "whisper", "whisper-cli.exe");
const MODEL = path.join(process.cwd(), "models", "ggml-base.en.bin");
const FFMPEG = path.join(process.cwd(), "..", "node_modules", "ffmpeg-static", "ffmpeg.exe");
const TMPDIR = os.tmpdir();

function getWhisperCli() {
  return fs.existsSync(WHISPER_CLI) ? WHISPER_CLI : null;
}

function generateTestAudio() {
  const outPath = path.join(TMPDIR, "velora-test-tone.wav");
  try {
    execFileSync(FFMPEG, ["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-ar", "16000", "-ac", "1", outPath]);
  } catch (e) {
    return null;
  }
  return fs.existsSync(outPath) ? outPath : null;
}

const execFileSync = (cmd, args) => {
  try {
    const result = require("child_process").execFileSync(cmd, args, { timeout: 15000, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    return { stdout: result.toString(), stderr: "" };
  } catch (e) {
    return { stdout: e.stdout?.toString() || "", stderr: e.stderr?.toString() || e.message };
  }
};

describe("Transcription via whisper CLI", () => {
  const cli = getWhisperCli();

  it("whisper-cli.exe exists", () => {
    assert.ok(cli, "whisper-cli.exe not found at " + WHISPER_CLI);
    assert.ok(fs.existsSync(MODEL), "Model not found at " + MODEL);
  });

  it("whisper-cli --help returns usage", async () => {
    if (!cli) return;
    const { stdout, stderr } = await execFileAsync(cli, ["--help"], { timeout: 5000, windowsHide: true });
    const output = stdout + stderr;
    assert.ok(output.includes("whisper-cli"), "Should contain usage info");
    assert.ok(output.includes("--model"), "Should list --model flag");
  });

  it("transcribes jfk sample via JSON output", { timeout: 120000 }, async () => {
    if (!cli) return;

    const outPrefix = path.join(TMPDIR, "velora-jfk-test");
    const jsonPath = outPrefix + ".json";

    try {
      await execFileAsync(cli, [
        "-m", MODEL,
        "-f", path.join(process.cwd(), "tests", "test-audio.wav"),
        "--language", "en", "-t", "2", "-bo", "1", "-sow",
        "-dtw", "base.en", "-ojf", "-np", "-of", outPrefix,
      ], { timeout: 120000, windowsHide: true, maxBuffer: 50 * 1024 * 1024 });

      assert.ok(fs.existsSync(jsonPath), "JSON output should exist");
      const json = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
      assert.ok(json.transcription, "Should have transcription array");
      assert.ok(json.transcription.length > 0, "Should have at least one segment");
      assert.ok(json.result?.language, "Should detect language");
    } finally {
      try { fs.unlinkSync(jsonPath); } catch {}
    }
  });
});

describe("Caption generation with all presets", () => {
  let generatePremiumCaptionFile;
  let CAPTION_PRESETS;

  before(async () => {
    const mod = await import("../src/services/premium-captions.js");
    generatePremiumCaptionFile = mod.generatePremiumCaptionFile;
    CAPTION_PRESETS = mod.CAPTION_PRESETS;
  });

  const mockSegments = [
    {
      start: 0, end: 3,
      text: "The biggest mistake people make",
      words: [
        { word: "The", start: 0, end: 0.3 },
        { word: "biggest", start: 0.3, end: 1.0 },
        { word: "mistake", start: 1.0, end: 1.8 },
        { word: "people", start: 1.8, end: 2.3 },
        { word: "make", start: 2.3, end: 3.0 },
      ],
    },
    {
      start: 3.2, end: 6.5,
      text: "is focusing on tools instead of problems",
      words: [
        { word: "is", start: 3.2, end: 3.4 },
        { word: "focusing", start: 3.4, end: 4.1 },
        { word: "on", start: 4.1, end: 4.3 },
        { word: "tools", start: 4.3, end: 4.9 },
        { word: "instead", start: 4.9, end: 5.4 },
        { word: "of", start: 5.4, end: 5.6 },
        { word: "problems", start: 5.6, end: 6.5 },
      ],
    },
    {
      start: 7.0, end: 10.0,
      text: "Do you understand the issue?",
      words: [
        { word: "Do", start: 7.0, end: 7.3 },
        { word: "you", start: 7.3, end: 7.5 },
        { word: "understand", start: 7.5, end: 8.3 },
        { word: "the", start: 8.3, end: 8.5 },
        { word: "issue?", start: 8.5, end: 10.0 },
      ],
    },
  ];

  const mockEmphasis = {
    0: [
      { word: "biggest", level: 2, type: "hook" },
      { word: "mistake", level: 1, type: "statement" },
    ],
    1: [
      { word: "tools", level: 3, type: "punchline" },
    ],
    2: [
      { word: "understand", level: 1, type: "question" },
    ],
  };

  const presets = ["classic", "bounce", "highlight", "karaoke", "minimal", "tiktok", "popup"];

  for (const presetName of presets) {
    it(`generates valid ASS for preset "${presetName}"`, async () => {
      const outPath = path.join(TMPDIR, `velora-test-${presetName}.ass`);
      try {
        await generatePremiumCaptionFile(mockSegments, mockEmphasis, outPath, presetName, 1080, 1920);

        assert.ok(fs.existsSync(outPath), "ASS file should be created");
        const content = fs.readFileSync(outPath, "utf-8");
        assert.ok(content.includes("[Script Info]"), "Should have Script Info header");
        assert.ok(content.includes("[V4+ Styles]"), "Should have V4+ Styles");
        assert.ok(content.includes("[Events]"), "Should have Events section");
        assert.ok(content.includes("Format: Layer, Start, End"), "Should have Events Format line");
        assert.ok(content.includes("Dialogue:"), "Should have dialogue lines");

        const dialogueCount = (content.match(/^Dialogue:/gm) || []).length;
        assert.ok(dialogueCount > 0, `Should have >0 dialogue lines, got ${dialogueCount}`);

        const styleNames = content.match(/Style: (\w+)/g) || [];
        assert.ok(styleNames.length >= 2, `Should have at least 2 styles, got ${styleNames.length}`);
      } finally {
        try { fs.unlinkSync(outPath); } catch {}
      }
    });
  }

  it("karaoke preset has \\kf tags", async () => {
    const outPath = path.join(TMPDIR, "velora-test-karaoke.ass");
    try {
      await generatePremiumCaptionFile(mockSegments, mockEmphasis, outPath, "karaoke", 1080, 1920);
      const content = fs.readFileSync(outPath, "utf-8");
      assert.ok(content.includes("\\kf"), "Karaoke should have \\kf tags");
    } finally {
      try { fs.unlinkSync(outPath); } catch {}
    }
  });

  it("handles empty segments gracefully", async () => {
    const outPath = path.join(TMPDIR, "velora-test-empty.ass");
    try {
      await generatePremiumCaptionFile([], {}, outPath, "classic", 1080, 1920);
      assert.ok(fs.existsSync(outPath), "Should still create ASS file");
      const content = fs.readFileSync(outPath, "utf-8");
      assert.ok(content.includes("[Events]"), "Should have valid header even with no dialogue");
    } finally {
      try { fs.unlinkSync(outPath); } catch {}
    }
  });

  it("handles non-speech segments by filtering them out", async () => {
    const segmentsWithNoise = [
      { start: 0, end: 2, text: "[music]", words: [{ word: "[music]", start: 0, end: 2 }] },
      { start: 2, end: 5, text: "Real speech here", words: [
        { word: "Real", start: 2, end: 2.5 },
        { word: "speech", start: 2.5, end: 3.5 },
        { word: "here", start: 3.5, end: 5 },
      ]},
    ];
    const outPath = path.join(TMPDIR, "velora-test-nospeech.ass");
    try {
      await generatePremiumCaptionFile(segmentsWithNoise, {}, outPath, "minimal", 1080, 1920);
      const content = fs.readFileSync(outPath, "utf-8");
      assert.ok(!content.includes("[music]"), "Should filter out [music]");
      assert.ok(content.includes("Real"), "Should keep Real");
      assert.ok(content.includes("speech"), "Should keep speech");
      assert.ok(content.includes("here"), "Should keep here");
    } finally {
      try { fs.unlinkSync(outPath); } catch {}
    }
  });

  it("emphasis words get different style names", async () => {
    const outPath = path.join(TMPDIR, "velora-test-emphasis.ass");
    try {
      await generatePremiumCaptionFile(mockSegments, mockEmphasis, outPath, "classic", 1080, 1920);
      const content = fs.readFileSync(outPath, "utf-8");
      const hasEmphasis = content.includes("Emphasis1") || content.includes("Emphasis2") || content.includes("Emphasis3");
      assert.ok(hasEmphasis, "Should have emphasis style lines for words with emphasis level > 0");
    } finally {
      try { fs.unlinkSync(outPath); } catch {}
    }
  });
});

describe("sliceTranscript with real whisper output format", () => {
  let sliceTranscript;

  before(async () => {
    const mod = await import("../src/services/transcription.js");
    sliceTranscript = mod.sliceTranscript;
  });

  it("slices whisper-format transcript correctly", () => {
    const transcript = {
      text: "The biggest mistake people make is focusing on tools",
      segments: [
        {
          start: 0, end: 3.2,
          text: "The biggest mistake people make",
          words: [
            { word: "The", start: 0, end: 0.3 },
            { word: "biggest", start: 0.3, end: 1.0 },
            { word: "mistake", start: 1.0, end: 1.8 },
            { word: "people", start: 1.8, end: 2.3 },
            { word: "make", start: 2.3, end: 3.2 },
          ],
        },
        {
          start: 3.5, end: 7.0,
          text: "is focusing on tools",
          words: [
            { word: "is", start: 3.5, end: 3.7 },
            { word: "focusing", start: 3.7, end: 4.5 },
            { word: "on", start: 4.5, end: 4.7 },
            { word: "tools", start: 4.7, end: 7.0 },
          ],
        },
      ],
    };

    const result = sliceTranscript(transcript, 0.5, 5.0);
    assert.ok(result.text.includes("biggest"), "Should include words from within the window");
    assert.ok(!result.text.startsWith("The"), "Should exclude words before window start");
    assert.ok(result.words.length > 0, "Should have sliced words");
    result.words.forEach((w) => {
      assert.ok(w.start >= 0, `Word start ${w.start} should be >= 0`);
      assert.ok(w.end <= 4.5, `Word end ${w.end} should be <= 4.5 (window duration)`);
    });
  });
});
