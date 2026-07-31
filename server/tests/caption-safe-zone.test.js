import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import { generatePremiumCaptionFile } from "../src/services/premium-captions.js";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "caption-safezone-test-"));

// Baseline Y = frameHeight - MarginV (MarginV is the distance from the bottom
// edge to the text baseline with Alignment 2). The renderer clamps that
// baseline into the vertical safe zone [200, 1420] at the 1920px reference
// height, scaled proportionally for other heights.
const SAFE_TOP = 200;
const SAFE_BOTTOM = 1420;
const REF_H = 1920;

const SEGMENT = [{
  start: 0.0,
  end: 2.0,
  text: "hello world",
  words: [
    { word: "hello", start: 0.0, end: 0.8 },
    { word: "world", start: 1.0, end: 1.9 },
  ],
}];

function readMarginV(assPath) {
  const ass = fs.readFileSync(assPath, "utf8");
  const styleLine = ass.split("\n").find((l) => l.startsWith("Style: Normal"));
  assert.ok(styleLine, "expected a Normal style line");
  const marginV = Number(styleLine.split(",")[21]);
  assert.ok(Number.isFinite(marginV), `bad MarginV in: ${styleLine}`);
  return marginV;
}

function baselineY(assPath, frameHeight) {
  return frameHeight - readMarginV(assPath);
}

describe("Vertical safe zone (baseline clamped to Y 200-1420 at 1920px)", () => {
  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("keeps every preset baseline inside the safe zone at 1080x1920", async () => {
    const presets = ["classic", "minimal", "highlight", "karaoke", "bounce", "tiktok", "popup"];
    for (const preset of presets) {
      const assPath = path.join(tmpDir, `safezone-${preset}.ass`);
      await generatePremiumCaptionFile(SEGMENT, {}, assPath, preset, 1080, 1920);
      const y = baselineY(assPath, 1920);
      assert.ok(y >= SAFE_TOP && y <= SAFE_BOTTOM,
        `preset "${preset}" baseline Y ${y} must be within [${SAFE_TOP}, ${SAFE_BOTTOM}]`);
    }
  });

  it("anchors lower presets to the bottom of the safe zone", async () => {
    const assPath = path.join(tmpDir, "safezone-lower.ass");
    await generatePremiumCaptionFile(SEGMENT, {}, assPath, "classic", 1080, 1920);
    assert.equal(baselineY(assPath, 1920), SAFE_BOTTOM);
  });

  it("anchors the upper preset to the top of the safe zone", async () => {
    const assPath = path.join(tmpDir, "safezone-upper.ass");
    await generatePremiumCaptionFile(SEGMENT, {}, assPath, "classic", 1080, 1920, { positionOverride: "upper" });
    assert.equal(baselineY(assPath, 1920), SAFE_TOP);
  });

  it("keeps percent positions inside the safe zone (clamped near the edges)", async () => {
    // pct 10 would put the baseline at ~1728px (above safe top) → clamped to 200.
    const topPath = path.join(tmpDir, "safezone-pct-top.ass");
    await generatePremiumCaptionFile(SEGMENT, {}, topPath, "classic", 1080, 1920, { positionOverride: "10" });
    assert.equal(baselineY(topPath, 1920), SAFE_TOP);

    // pct 90 would put the baseline at ~192px (below safe bottom) → clamped to 1420.
    const bottomPath = path.join(tmpDir, "safezone-pct-bottom.ass");
    await generatePremiumCaptionFile(SEGMENT, {}, bottomPath, "classic", 1080, 1920, { positionOverride: "90" });
    assert.equal(baselineY(bottomPath, 1920), SAFE_BOTTOM);
  });

  it("scales the safe zone proportionally for other frame heights", async () => {
    const fH = 960;
    const scale = fH / REF_H;
    const safeTop = SAFE_TOP * scale;
    const safeBottom = SAFE_BOTTOM * scale;

    const assPath = path.join(tmpDir, "safezone-540x960.ass");
    await generatePremiumCaptionFile(SEGMENT, {}, assPath, "classic", 540, fH);
    assert.equal(baselineY(assPath, fH), safeBottom);

    const upperPath = path.join(tmpDir, "safezone-540x960-upper.ass");
    await generatePremiumCaptionFile(SEGMENT, {}, upperPath, "classic", 540, fH, { positionOverride: "upper" });
    assert.equal(baselineY(upperPath, fH), safeTop);
  });
});
