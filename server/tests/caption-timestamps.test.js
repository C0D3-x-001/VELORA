import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import { generatePremiumCaptionFile } from "../src/services/premium-captions.js";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "caption-ts-test-"));

function buildAdjustedSegments(rawSegments, clipStartTime) {
  return rawSegments
    .filter((s) => s.end > clipStartTime && s.start < clipStartTime + 10)
    .map((s) => ({
      start: Math.max(0, s.start - clipStartTime),
      end: Math.max(0, s.end - clipStartTime),
      text: s.text,
      words: s.words
        ? s.words.map((w) => ({
            ...w,
            start: Math.max(0, w.start - clipStartTime),
            end: Math.max(0, w.end - clipStartTime),
          }))
        : undefined,
    }));
}

describe("Caption word-timestamp re-basing", () => {
  it("re-bases word timestamps for a near-start clip (0.5s drift)", () => {
    const drift = 0.5;
    const clipStartTime = 0.5;
    const raw = [
      { start: drift + 0.0, end: drift + 1.0, text: "hello world",
        words: [{ word: "hello", start: drift + 0.0, end: drift + 0.3 }, { word: "world", start: drift + 0.4, end: drift + 0.8 }] },
    ];
    const adj = buildAdjustedSegments(raw, clipStartTime);
    assert.equal(adj.length, 1);
    assert.equal(adj[0].words.length, 2);
    assert(Math.abs(adj[0].words[0].start - 0.0) < 0.001);
    assert(Math.abs(adj[0].words[0].end - 0.3) < 0.001);
    assert(Math.abs(adj[0].words[1].start - 0.4) < 0.001);
    assert(Math.abs(adj[0].words[0].start + clipStartTime - raw[0].words[0].start) < 0.001);
    assert(Math.abs(adj[0].words[1].start + clipStartTime - raw[0].words[1].start) < 0.001);
  });

  it("re-bases word timestamps for a deep clip (180s drift)", () => {
    const drift = 180.24;
    const clipStartTime = 180.0;
    const raw = [
      { start: drift + 0.0, end: drift + 1.2, text: "deep in video",
        words: [{ word: "deep", start: drift + 0.0, end: drift + 0.3 }, { word: "in", start: drift + 0.5, end: drift + 0.6 }, { word: "video", start: drift + 0.8, end: drift + 1.1 }] },
    ];
    const adj = buildAdjustedSegments(raw, clipStartTime);
    assert.equal(adj.length, 1);
    assert.equal(adj[0].words.length, 3);
    for (const w of adj[0].words) {
      const orig = raw[0].words.find((ow) => ow.word === w.word);
      assert(orig, "word " + w.word + " not found in original");
      assert(Math.abs(w.start + clipStartTime - orig.start) < 0.001, w.word + ": adj " + w.start + " + clipStart " + clipStartTime + " != " + orig.start);
    }
  });

  it("ASS file has correct clip-relative times", async () => {
    const drift = 10.12;
    const clipStartTime = 10.0;
    const raw = [
      { start: drift + 0.0, end: drift + 1.0, text: "ASS test",
        words: [{ word: "ASS", start: drift + 0.0, end: drift + 0.4 }, { word: "test", start: drift + 0.5, end: drift + 0.9 }] },
    ];
    const adj = buildAdjustedSegments(raw, clipStartTime);
    const assPath = path.join(tmpDir, "test_assen.ass");
    await generatePremiumCaptionFile(adj, {}, assPath, "popup", 1080, 1920);
    const ass = fs.readFileSync(assPath, "utf8");
    const lines = ass.split("\n").filter((l) => l.startsWith("Dialogue:"));
    assert.equal(lines.length, 2);
    const startStr = lines[0].split(",")[1];
    assert(startStr.startsWith("0:00:00.1"), "expected ~0:00:00.12, got " + startStr);
  });

  it("handles missing words array (SRT path)", () => {
    const clipStartTime = 5.0;
    const raw = [{ start: 7.0, end: 9.0, text: "srt fallback" }];
    const adj = buildAdjustedSegments(raw, clipStartTime);
    assert.equal(adj.length, 1);
    assert.equal(adj[0].words, undefined);
    assert(Math.abs(adj[0].start - 2.0) < 0.001);
  });

  it("preserves no-drift case (precise keyframe)", () => {
    const clipStartTime = 5.0;
    const raw = [
      { start: 5.0, end: 6.0, text: "no drift",
        words: [{ word: "no", start: 5.0, end: 5.2 }, { word: "drift", start: 5.3, end: 5.8 }] },
    ];
    const adj = buildAdjustedSegments(raw, clipStartTime);
    assert(Math.abs(adj[0].words[0].start - 0.0) < 0.001);
    assert(Math.abs(adj[0].words[1].start - 0.3) < 0.001);
  });
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
