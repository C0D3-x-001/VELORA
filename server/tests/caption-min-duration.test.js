import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import { generatePremiumCaptionFile } from "../src/services/premium-captions.js";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "caption-mindur-test-"));

function parseAssTime(s) {
  const p = s.split(":");
  return +p[0] * 3600 + +p[1] * 60 + +p[2];
}

function readDialogueLines(assPath) {
  const ass = fs.readFileSync(assPath, "utf8");
  return ass.split("\n").filter((l) => l.startsWith("Dialogue:"));
}

function extractWindow(line) {
  const cols = line.split(",");
  return { start: parseAssTime(cols[1]), end: parseAssTime(cols[2]) };
}

// Fast speech: every word is shorter than 180ms.
const FAST_SEGMENT = [{
  start: 0.0,
  end: 2.5,
  text: "quick fast rapid snappy words",
  words: [
    { word: "quick", start: 0.00, end: 0.10 },
    { word: "fast",  start: 0.22, end: 0.30 },
    { word: "rapid", start: 0.42, end: 0.52 },
    { word: "snappy", start: 0.64, end: 0.75 },
    { word: "words", start: 0.86, end: 0.97 },
  ],
}];

describe("Minimum on-screen duration (180ms floor)", () => {
  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("extends End (never Start) so each word-by-word caption shows >= 180ms", async () => {
    const assPath = path.join(tmpDir, "mindur-popup.ass");
    await generatePremiumCaptionFile(FAST_SEGMENT, {}, assPath, "popup", 1080, 1920);

    const windows = readDialogueLines(assPath).map(extractWindow);
    for (const w of windows) {
      const dur = w.end - w.start;
      assert.ok(dur >= 0.18 - 0.001, `word visible only ${dur}s — must be >= 180ms`);
    }
  });

  it("caps the floor at the next word's start so captions never overlap", async () => {
    const overlapping = [{
      start: 0.0,
      end: 1.0,
      text: "aaa bbb",
      words: [
        { word: "aaa", start: 0.0,  end: 0.05 },
        { word: "bbb", start: 0.08, end: 0.12 },
      ],
    }];
    const assPath = path.join(tmpDir, "mindur-overlap.ass");
    await generatePremiumCaptionFile(overlapping, {}, assPath, "popup", 1080, 1920);

    const windows = readDialogueLines(assPath).map(extractWindow);
    windows.sort((a, b) => a.start - b.start);
    let prevEnd = -1;
    for (const w of windows) {
      assert.ok(w.start >= prevEnd - 0.015, `caption ${w.start}-${w.end} overlaps previous end ${prevEnd}`);
      prevEnd = w.end;
    }
  });

  it("applies the floor to grouped Dialogue events (bounce)", async () => {
    const assPath = path.join(tmpDir, "mindur-bounce.ass");
    await generatePremiumCaptionFile(FAST_SEGMENT, {}, assPath, "bounce", 1080, 1920);

    const windows = readDialogueLines(assPath).map(extractWindow);
    for (const w of windows) {
      const dur = w.end - w.start;
      assert.ok(dur >= 0.18 - 0.001, `group visible only ${dur}s — must be >= 180ms`);
    }
  });

  it("does not bridge a real pause when flooring (gap suppression still wins)", async () => {
    const paused = [{
      start: 0.0,
      end: 3.0,
      text: "aa bb",
      words: [
        { word: "aa", start: 0.0, end: 0.05 },
        { word: "bb", start: 2.0, end: 2.05 },
      ],
    }];
    const assPath = path.join(tmpDir, "mindur-pause.ass");
    await generatePremiumCaptionFile(paused, {}, assPath, "classic", 1080, 1920);

    const windows = readDialogueLines(assPath).map(extractWindow);
    for (const w of windows) {
      assert.ok(!(w.start < 1.0 && w.end > 1.5), `caption ${w.start}-${w.end} bridges the pause`);
    }
  });
});
