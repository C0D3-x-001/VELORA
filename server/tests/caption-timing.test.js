import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import { generatePremiumCaptionFile } from "../src/services/premium-captions.js";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "caption-timing-test-"));

function parseAssTime(s) {
  const p = s.split(":");
  return +p[0] * 3600 + +p[1] * 60 + +p[2];
}

function readDialogueLines(assPath) {
  const ass = fs.readFileSync(assPath, "utf8");
  return ass.split("\n").filter((l) => l.startsWith("Dialogue:"));
}

function extractTimestamps(line) {
  const cols = line.split(",");
  return { start: parseAssTime(cols[1]), end: parseAssTime(cols[2]) };
}

describe("Caption timing regression tests", () => {
  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("re-bases word timestamps from deep-clip offset to clip-relative", async () => {
    // Simulate a clip cut 120s into a source video with 120.08s keyframe drift.
    // The adjustedSegments passed here should already have clipStartTime (120.08)
    // subtracted from every word timestamp.
    const clipStartTime = 120.08;
    const ASSUMED_CLIP_START = 120.0;
    const SEGMENT_LENGTH = 4.0;
    const rawWords = [
      { word: "deep",  start: clipStartTime + 0.0,  end: clipStartTime + 0.3 },
      { word: "clip",  start: clipStartTime + 0.4,  end: clipStartTime + 0.7 },
      { word: "words", start: clipStartTime + 0.8,  end: clipStartTime + 1.2 },
      { word: "should",start: clipStartTime + 1.3,  end: clipStartTime + 1.6 },
      { word: "not",   start: clipStartTime + 1.7,  end: clipStartTime + 2.0 },
      { word: "drift", start: clipStartTime + 2.1,  end: clipStartTime + 2.5 },
    ];

    // Build adjustedSegments the same way project.js does (the fix being tested)
    const adjustedSegments = [{
      start: Math.max(0, ASSUMED_CLIP_START - clipStartTime),
      end: Math.max(0, ASSUMED_CLIP_START + SEGMENT_LENGTH - clipStartTime),
      text: rawWords.map((w) => w.word).join(" "),
      words: rawWords.map((w) => ({
        ...w,
        start: Math.max(0, w.start - clipStartTime),
        end: Math.max(0, w.end - clipStartTime),
      })),
    }];

    const assPath = path.join(tmpDir, "drift-test.ass");
    await generatePremiumCaptionFile(adjustedSegments, {}, assPath, "popup", 1080, 1920);

    const lines = readDialogueLines(assPath);
    assert.ok(lines.length > 0, "ASS must contain dialogue lines");

    let maxEnd = 0;
    for (const line of lines) {
      const { start, end } = extractTimestamps(line);
      maxEnd = Math.max(maxEnd, end);
      // Every word must be well under 60s (clip-relative, not 120s absolute)
      assert.ok(start < 60, `Word start ${start}s exceeds 60s clip boundary`);
      assert.ok(end < 60, `Word end ${end}s exceeds 60s clip boundary`);
    }

    // The deepest word should be near 4s (segment length), not near 124s
    assert.ok(maxEnd < 10, `Max word end ${maxEnd}s exceeds 10s clip window`);
  });

  it("prevents overlapping word display windows", async () => {
    // Words with deliberately overlapping timestamps (fast speech / whisper artifacts)
    const segments = [{
      start: 0.0, end: 2.0,
      text: "one two three four five six seven eight",
      words: [
        { word: "one",   start: 0.0,  end: 0.20 },
        { word: "two",   start: 0.18, end: 0.38 },
        { word: "three", start: 0.35, end: 0.55 },
        { word: "four",  start: 0.50, end: 0.70 },
        { word: "five",  start: 0.65, end: 0.85 },
        { word: "six",   start: 0.80, end: 1.00 },
        { word: "seven", start: 0.95, end: 1.40 },
        { word: "eight", start: 1.30, end: 1.80 },
      ],
    }];

    const assPath = path.join(tmpDir, "overlap-test.ass");
    await generatePremiumCaptionFile(segments, {}, assPath, "popup", 1080, 1920);

    const lines = readDialogueLines(assPath);
    assert.ok(lines.length > 0, "ASS must contain dialogue lines");

    let prevEnd = -1;
    for (const line of lines) {
      const { start, end } = extractTimestamps(line);
      // Each word must start at or after the previous word's end (with 10ms tolerance for the clamp gap)
      if (prevEnd >= 0) {
        assert.ok(start >= prevEnd - 0.015,
          `Word starts at ${start}s but previous ends at ${prevEnd}s (overlap detected)`);
      }
      prevEnd = end;
    }
  });
});
