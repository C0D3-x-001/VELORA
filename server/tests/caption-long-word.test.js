import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import { generatePremiumCaptionFile } from "../src/services/premium-captions.js";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "caption-longword-test-"));

function readDialogueLines(assPath) {
  const ass = fs.readFileSync(assPath, "utf8");
  return ass.split("\n").filter((l) => l.startsWith("Dialogue:"));
}

function textOf(line) {
  return line.slice(line.lastIndexOf(",,") + 2);
}

// "supercalifragilisticexpialidocious" — 34 letters, wider than the 907px safe
// box at the classic preset's 56px bold font (34 * 56 * 0.58 = 1104px).
const LONG_WORD = "supercalifragilisticexpialidocious";
const LONG_SEGMENT = [{
  start: 0.0,
  end: 3.0,
  text: LONG_WORD,
  words: [{ word: LONG_WORD, start: 0.1, end: 2.8 }],
}];

describe("Long-word handling (\fs shrink to 70% floor)", () => {
  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("shrinks an overflowing single word with \fs down to the 70% floor", async () => {
    const assPath = path.join(tmpDir, "longword-classic.ass");
    await generatePremiumCaptionFile(LONG_SEGMENT, {}, assPath, "classic", 1080, 1920);

    const lines = readDialogueLines(assPath);
    const text = textOf(lines[0]);
    // 34 letters * 56px * 0.58 = 1104px > 907px safe → scale = 907/1104 ≈ 0.82
    const fsMatch = text.match(/\\fs(\d+)/);
    assert.ok(fsMatch, `expected a \\fs tag in: ${text}`);
    const fsValue = Number(fsMatch[1]);
    assert.ok(fsValue >= 39 && fsValue <= 56, `\\fs ${fsValue} must stay within [floor 39, natural 56]`);
  });

  it("emits no \fs tag when the text already fits the safe box", async () => {
    const shortSegment = [{
      start: 0.0,
      end: 1.0,
      text: "hello world",
      words: [
        { word: "hello", start: 0.0, end: 0.4 },
        { word: "world", start: 0.5, end: 0.9 },
      ],
    }];
    const assPath = path.join(tmpDir, "longword-short.ass");
    await generatePremiumCaptionFile(shortSegment, {}, assPath, "classic", 1080, 1920);

    const lines = readDialogueLines(assPath);
    for (const line of lines) {
      assert.ok(!/\\fs\d+/.test(textOf(line)), `unexpected \\fs on fitting line: ${textOf(line)}`);
    }
  });

  it("shows a word wider than 60% of the safe box alone (solo window)", async () => {
    const segment = [{
      start: 0.0,
      end: 4.0,
      text: "hello " + LONG_WORD + " world",
      words: [
        { word: "hello", start: 0.0, end: 0.3 },
        { word: LONG_WORD, start: 0.4, end: 3.0 },
        { word: "world", start: 3.2, end: 3.8 },
      ],
    }];
    const assPath = path.join(tmpDir, "longword-popup.ass");
    await generatePremiumCaptionFile(segment, {}, assPath, "popup", 1080, 1920);

    const lines = readDialogueLines(assPath);
    // popup maxWordsOnScreen = 3, so a normal word is rendered in a 3-word
    // window; the long word (34 chars * 80 * 0.58 = 1578px > 60% of 907) must be
    // its own 1-word window, so at least one Dialogue event renders it alone.
    const plainLines = lines.map((l) => textOf(l).replace(/\{[^}]*\}/g, "").trim());
    const soloEvents = plainLines.filter((t) => t === LONG_WORD);
    assert.ok(soloEvents.length >= 1, `long word must be displayed solo, lines: ${JSON.stringify(plainLines)}`);
  });

  it("shrinks a long word inside a highlight sentence", async () => {
    const assPath = path.join(tmpDir, "longword-highlight.ass");
    await generatePremiumCaptionFile(LONG_SEGMENT, {}, assPath, "highlight", 1080, 1920);

    const lines = readDialogueLines(assPath);
    assert.ok(lines.length >= 1, "expected at least one highlight line");
    const text = textOf(lines[0]);
    assert.ok(/\\fs\d+/.test(text), `expected a \\fs tag in highlight line: ${text}`);
  });

  it("shrinks a long word in a karaoke run", async () => {
    const assPath = path.join(tmpDir, "longword-karaoke.ass");
    await generatePremiumCaptionFile(LONG_SEGMENT, {}, assPath, "karaoke", 1080, 1920);

    const lines = readDialogueLines(assPath);
    assert.ok(lines.length >= 1, "expected at least one karaoke line");
    const text = textOf(lines[0]);
    assert.ok(/\\fs\d+/.test(text), `expected a \\fs tag in karaoke line: ${text}`);
  });
});
