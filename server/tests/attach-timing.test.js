import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { attachTiming } from "../src/services/caption-layout.js";

describe("attachTiming", () => {
  it("matches word-for-word when counts are equal", () => {
    const layoutWords = [{ word: "hello", index: 0 }, { word: "world", index: 1 }];
    const timestamps = [{ word: "hello", start: 0.0, end: 0.3 }, { word: "world", start: 0.4, end: 0.8 }];
    const result = attachTiming(layoutWords, timestamps);
    assert.equal(result[0].start, 0.0);
    assert.equal(result[1].start, 0.4);
  });

  it("matches repeated words to the next unclaimed occurrence in order, not an arbitrary earlier one", () => {
    // "know" and "you" each appear twice. A naive "first unused occurrence anywhere"
    // search can jump backwards/forwards to the wrong copy. A forward-only pointer
    // must keep every match in original speech order.
    const layoutWords = [
      { word: "you", index: 0 },
      { word: "know", index: 1 },
      { word: "you", index: 2 },
      { word: "know", index: 3 },
    ];
    // One extra timestamp entry ("uh") forces the count mismatch path.
    const timestamps = [
      { word: "you", start: 0.0, end: 0.2 },
      { word: "uh", start: 0.2, end: 0.3 },
      { word: "know", start: 0.3, end: 0.5 },
      { word: "you", start: 0.5, end: 0.7 },
      { word: "know", start: 0.7, end: 0.9 },
    ];
    const result = attachTiming(layoutWords, timestamps);
    // Every match must be strictly increasing in time — never out of order,
    // never two words pointing at the same timestamp.
    for (let i = 1; i < result.length; i++) {
      assert.ok(
        result[i].start >= result[i - 1].start,
        `word ${i} ("${result[i].word}") starts at ${result[i].start}, before word ${i - 1} ("${result[i - 1].word}") at ${result[i - 1].start}`
      );
    }
    assert.equal(result[0].start, 0.0);
    assert.equal(result[1].start, 0.3);
    assert.equal(result[2].start, 0.5);
    assert.equal(result[3].start, 0.7);
  });

  it("leaves timing null for a word with no match ahead of the pointer, instead of guessing by raw index", () => {
    const layoutWords = [{ word: "apple", index: 0 }, { word: "banana", index: 1 }];
    const timestamps = [{ word: "apple", start: 0.0, end: 0.3 }];
    const result = attachTiming(layoutWords, timestamps);
    assert.equal(result[0].start, 0.0);
    assert.equal(result[1].start, null);
    assert.equal(result[1].end, null);
  });
});
