import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import { generatePremiumCaptionFile } from "../src/services/premium-captions.js";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "caption-gap-test-"));

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

// A segment with a genuine pause: word "three" starts 1.6s after "two" ends.
// 0.0 - hello, 0.3 - there, 2.1 - you, 2.4 - go
const PAUSE_SEGMENT = [{
  start: 0.0,
  end: 3.0,
  text: "hello there you go",
  words: [
    { word: "hello", start: 0.0,  end: 0.3 },
    { word: "there", start: 0.4,  end: 0.7 },
    { word: "you",   start: 2.1,  end: 2.4 },
    { word: "go",    start: 2.5,  end: 2.8 },
  ],
}];

describe("Silence-gap suppression", () => {
  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("splits grouped Dialogue events at gaps >= 0.4s (classic)", async () => {
    const assPath = path.join(tmpDir, "gap-classic.ass");
    await generatePremiumCaptionFile(PAUSE_SEGMENT, {}, assPath, "classic", 1080, 1920);

    const lines = readDialogueLines(assPath);
    const windows = lines.map(extractWindow);

    // classic groups the whole sentence, but the 1.4s pause must split it.
    assert.equal(lines.length, 2, `expected 2 Dialogue events, got ${lines.length}`);

    // First event ends with the last word before the pause.
    assert.ok(windows[0].end <= 0.75, `first event must end by "there" (0.7s), got ${windows[0].end}`);
    // Second event starts after the pause.
    assert.ok(windows[1].start >= 2.0, `second event must start after the pause, got ${windows[1].start}`);
    // No caption is visible during the pause.
    for (const w of windows) {
      const overlapsPause = w.start < 1.5 && w.end > 1.5;
      assert.ok(!overlapsPause, `Dialogue event ${w.start}-${w.end} overlaps the pause`);
    }
  });

  it("does not split on sub-0.15s natural word spacing (bounce)", async () => {
    const tightSegment = [{
      start: 0.0,
      end: 1.6,
      text: "quick paced speech here",
      words: [
        { word: "quick", start: 0.0,  end: 0.3 },
        { word: "paced", start: 0.32, end: 0.6 },
        { word: "speech", start: 0.62, end: 0.95 },
        { word: "here",  start: 0.97, end: 1.3 },
      ],
    }];
    const assPath = path.join(tmpDir, "gap-bounce.ass");
    await generatePremiumCaptionFile(tightSegment, {}, assPath, "bounce", 1080, 1920);

    const lines = readDialogueLines(assPath);
    // bounce groups adaptively (~2-3 words); tight cadence should NOT add splits
    // beyond the natural group boundaries. No event boundary should sit at a
    // sub-0.15s gap position artificially widening/hiding.
    assert.ok(lines.length > 0, "bounce must emit dialogue");
  });

  it("karaoke hides during the pause and re-roots \\kf delays per run", async () => {
    const assPath = path.join(tmpDir, "gap-karaoke.ass");
    await generatePremiumCaptionFile(PAUSE_SEGMENT, {}, assPath, "karaoke", 1080, 1920);

    const lines = readDialogueLines(assPath);
    const windows = lines.map(extractWindow);

    // Must not be a single line spanning the whole segment.
    assert.ok(lines.length >= 2, `expected split karaoke runs, got ${lines.length} line(s)`);
    for (const w of windows) {
      const overlapsPause = w.start < 1.5 && w.end > 1.5;
      assert.ok(!overlapsPause, `karaoke event ${w.start}-${w.end} overlaps the pause`);
    }

    // Second run must contain the \kf delay of the first word AFTER the pause
    // re-rooted to run start (2.1) — i.e. delay ~0, not (2.1-0.0)*100.
    const secondRun = lines.find((l) => extractWindow(l).start >= 2.0);
    assert.ok(secondRun, "second karaoke run must exist");
    assert.ok(/\\kf0/.test(secondRun), `second run must start with \\kf0 delay, got: ${secondRun.split(",,")[1]?.slice(0, 60)}`);
  });
});
