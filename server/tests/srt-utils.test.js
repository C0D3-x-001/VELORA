import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { segmentsToSRT, formatSrtTime } from "../src/services/srt-utils.js";

describe("formatSrtTime", () => {
  it("formats 0 seconds", () => {
    assert.equal(formatSrtTime(0), "00:00:00,000");
  });

  it("formats seconds", () => {
    assert.equal(formatSrtTime(36.5), "00:00:36,500");
  });

  it("formats minutes and seconds", () => {
    assert.equal(formatSrtTime(125), "00:02:05,000");
  });

  it("formats hours", () => {
    assert.equal(formatSrtTime(3661.123), "01:01:01,123");
  });

  it("handles string input", () => {
    assert.equal(formatSrtTime("42.5"), "00:00:42,500");
  });
});

describe("segmentsToSRT", () => {
  it("generates valid SRT from segments", () => {
    const segments = [
      { start: 0, end: 2.5, text: "Hello world" },
      { start: 3, end: 5, text: "Second line" },
    ];
    const srt = segmentsToSRT(segments);
    const lines = srt.trim().split("\n");
    assert.equal(lines[0], "1");
    assert.equal(lines[1], "00:00:00,000 --> 00:00:02,500");
    assert.equal(lines[2], "Hello world");
    assert.equal(lines[3], "");
    assert.equal(lines[4], "2");
    assert.equal(lines[5], "00:00:03,000 --> 00:00:05,000");
    assert.equal(lines[6], "Second line");
  });

  it("returns empty string for empty input", () => {
    assert.equal(segmentsToSRT([]), "");
  });

  it("handles single segment", () => {
    const srt = segmentsToSRT([{ start: 10, end: 15, text: "Test" }]);
    assert.ok(srt.includes("00:00:10,000 --> 00:00:15,000"));
    assert.ok(srt.includes("Test"));
  });
});
