import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sliceTranscript } from "../src/services/transcription.js";

const mockTranscript = {
  text: "Hello world this is a test transcript",
  segments: [
    {
      start: 0,
      end: 5,
      text: "Hello world this is a test",
      words: [
        { word: "Hello", start: 0, end: 1 },
        { word: "world", start: 1, end: 2 },
        { word: "this", start: 2, end: 2.5 },
        { word: "is", start: 2.5, end: 3 },
        { word: "a", start: 3, end: 3.2 },
        { word: "test", start: 3.2, end: 5 },
      ],
    },
    {
      start: 5,
      end: 10,
      text: "transcript for testing",
      words: [
        { word: "transcript", start: 5, end: 6 },
        { word: "for", start: 6, end: 6.5 },
        { word: "testing", start: 6.5, end: 10 },
      ],
    },
  ],
};

describe("sliceTranscript", () => {
  it("returns full transcript if range covers everything", () => {
    const result = sliceTranscript(mockTranscript, 0, 10);
    assert.equal(result.text, "Hello world this is a test transcript for testing");
    assert.equal(result.segments.length, 2);
    assert.equal(result.words.length, 9);
  });

  it("slices a window from the middle", () => {
    const result = sliceTranscript(mockTranscript, 1, 6);
    assert.ok(result.text.includes("world"));
    assert.ok(result.text.includes("transcript"));
    assert.ok(!result.text.includes("Hello"));
  });

  it("returns empty for non-overlapping range", () => {
    const result = sliceTranscript(mockTranscript, 20, 30);
    assert.equal(result.text, "");
    assert.equal(result.segments.length, 0);
    assert.equal(result.words.length, 0);
  });

  it("handles null input", () => {
    const result = sliceTranscript(null, 0, 10);
    assert.equal(result.text, "");
    assert.equal(result.segments.length, 0);
  });

  it("adjusts word timestamps relative to window start", () => {
    const result = sliceTranscript(mockTranscript, 2, 4);
    const firstWord = result.words[0];
    assert.ok(firstWord.start >= 0);
    assert.equal(firstWord.start, 0);
  });
});
