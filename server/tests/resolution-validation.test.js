import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateEndingResolution } from "../src/services/clip-boundary.js";

function makeWords(texts, startTime = 0) {
  return texts.map((t, i) => ({
    word: t,
    start: startTime + i * 0.5,
    end: startTime + i * 0.5 + 0.4,
    segmentIndex: 0,
  }));
}

describe("validateEndingResolution", () => {
  it("marks complete sentences as resolved", () => {
    const words = makeWords(["And", "that", "is", "the", "only", "thing", "that", "matters."]);
    const result = validateEndingResolution(words, 4.0);
    assert.equal(result.resolved, true);
    assert.equal(result.reason, "ok");
  });

  it("detects never-end pattern 'anyway'", () => {
    const words = makeWords(["So", "yeah", "anyway"]);
    const result = validateEndingResolution(words, 2.0);
    assert.equal(result.resolved, false);
    assert.ok(result.reason.includes("never_end"));
  });

  it("detects never-end pattern 'you know what i mean'", () => {
    const words = makeWords(["That's", "how", "it", "works", "you", "know", "what", "I", "mean"]);
    const result = validateEndingResolution(words, 5.0);
    assert.equal(result.resolved, false);
    assert.ok(result.reason.includes("never_end"));
  });

  it("detects unresolved cliffhanger 'and that's when'", () => {
    const words = makeWords(["And", "that's", "when", "everything"]);
    const result = validateEndingResolution(words, 2.5);
    assert.equal(result.resolved, false);
    assert.ok(result.reason.includes("unresolved_hook"));
  });

  it("detects unresolved setup 'but then'", () => {
    const words = makeWords(["We", "tried", "everything", "but", "then"]);
    const result = validateEndingResolution(words, 3.0);
    assert.equal(result.resolved, false);
    assert.ok(result.reason.includes("unresolved_hook"));
  });

  it("detects unresolved setup 'the thing is'", () => {
    const words = makeWords(["The", "thing", "is"]);
    const result = validateEndingResolution(words, 2.0);
    assert.equal(result.resolved, false);
    assert.ok(result.reason.includes("unresolved_hook"));
  });

  it("detects trailing question (unresolved via 'what do you think' pattern)", () => {
    const words = makeWords(["What", "do", "you", "think", "about", "that?"]);
    const result = validateEndingResolution(words, 3.5);
    assert.equal(result.resolved, false);
    assert.ok(result.reason.includes("unresolved_hook") || result.reason.includes("question"));
  });

  it("detects trailing off with ellipsis", () => {
    const words = makeWords(["And", "then", "we..."]);
    const result = validateEndingResolution(words, 2.0);
    assert.equal(result.resolved, false);
    assert.ok(result.reason.includes("trailing_off") || result.reason.includes("unresolved"));
  });

  it("detects no sentence ender", () => {
    const words = makeWords(["The", "best", "part", "about", "this"]);
    const result = validateEndingResolution(words, 3.0);
    assert.equal(result.resolved, false);
    assert.ok(result.reason.includes("no_sentence_ender"));
  });

  it("marks mic drop as resolved", () => {
    const words = makeWords(["He", "said", "no.", "Six", "months", "later", "he", "called", "back."]);
    const result = validateEndingResolution(words, 5.0);
    assert.equal(result.resolved, true);
  });

  it("marks conclusion as resolved", () => {
    const words = makeWords(["And", "that's", "the", "only", "thing", "that", "matters."]);
    const result = validateEndingResolution(words, 4.0);
    assert.equal(result.resolved, true);
  });

  it("handles empty input gracefully (no issues to flag)", () => {
    const result = validateEndingResolution([], 5.0);
    // Empty = no words found = nothing to flag as unresolved
    assert.equal(result.resolved, true);
    assert.equal(result.reason, "ok");
  });

  it("uses custom window size", () => {
    // Words outside the default 8s window should be ignored
    const earlyWords = makeWords(["Perfect", "ending."], 0);
    const lateWords = makeWords(["But", "then"], 20);
    const allWords = [...earlyWords, ...lateWords];
    // With a 3s window ending at 21s, only "But then" is in window
    const result = validateEndingResolution(allWords, 21, { windowSec: 3 });
    assert.equal(result.resolved, false);
  });
});
