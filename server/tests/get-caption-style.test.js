import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getCaptionStyle } from "../src/services/get-caption-style.js";

describe("getCaptionStyle", () => {
  describe("9:16 vertical (1080x1920)", () => {
    const s = getCaptionStyle(1080, 1920);

    it("sets PlayRes to actual dimensions", () => {
      assert.equal(s.playResX, 1080);
      assert.equal(s.playResY, 1920);
    });

    it("computes fontSize as ~5% of height", () => {
      assert.equal(s.fontSize, 96);
      assert.ok(s.fontSize >= 90 && s.fontSize <= 102);
    });

    it("isPortrait is true", () => {
      assert.equal(s.isPortrait, true);
      assert.equal(s.isLandscape, false);
      assert.equal(s.isSquare, false);
    });

    it("maxWidthPct is narrower for portrait", () => {
      assert.ok(s.maxWidthPct >= 82 && s.maxWidthPct <= 86);
    });

    it("has tall safe margins for platform UI", () => {
      assert.ok(s.marginTopPct >= 11 && s.marginTopPct <= 13);
      assert.ok(s.marginBottomPct >= 11 && s.marginBottomPct <= 13);
    });

    it("marginTop and marginBottom are ~12% of height", () => {
      assert.ok(s.marginTop >= 220 && s.marginTop <= 240);
      assert.ok(s.marginBottom >= 220 && s.marginBottom <= 240);
    });

    it("scaleSteps has 4 steps descending from fontSize", () => {
      assert.equal(s.scaleSteps.length, 4);
      assert.ok(s.scaleSteps[0] >= s.scaleSteps[1]);
      assert.ok(s.scaleSteps[1] >= s.scaleSteps[2]);
      assert.ok(s.scaleSteps[2] >= s.scaleSteps[3]);
      assert.equal(s.scaleSteps[0], s.fontSize);
    });
  });

  describe("16:9 horizontal (1920x1080)", () => {
    const s = getCaptionStyle(1920, 1080);

    it("sets PlayRes to actual dimensions", () => {
      assert.equal(s.playResX, 1920);
      assert.equal(s.playResY, 1080);
    });

    it("computes fontSize as ~5% of height", () => {
      assert.equal(s.fontSize, 54);
    });

    it("isLandscape is true", () => {
      assert.equal(s.isLandscape, true);
      assert.equal(s.isPortrait, false);
    });

    it("maxWidthPct is wider for landscape", () => {
      assert.ok(s.maxWidthPct >= 89 && s.maxWidthPct <= 93);
    });

    it("has shorter safe margins for landscape", () => {
      assert.ok(s.marginTopPct >= 5 && s.marginTopPct <= 7);
      assert.ok(s.marginBottomPct >= 7 && s.marginBottomPct <= 9);
    });
  });

  describe("1:1 square (1080x1080)", () => {
    const s = getCaptionStyle(1080, 1080);

    it("sets PlayRes to actual dimensions", () => {
      assert.equal(s.playResX, 1080);
      assert.equal(s.playResY, 1080);
    });

    it("computes fontSize as ~5% of height", () => {
      assert.equal(s.fontSize, 54);
    });

    it("isSquare is true", () => {
      assert.equal(s.isSquare, true);
      assert.equal(s.isPortrait, false);
      assert.equal(s.isLandscape, false);
    });

    it("maxWidthPct is between portrait and landscape", () => {
      assert.ok(s.maxWidthPct >= 85 && s.maxWidthPct <= 91);
    });

    it("marginV defaults to marginBottom", () => {
      assert.equal(s.marginV, s.marginBottom);
    });
  });

  describe("options override", () => {
    it("fontSizePct overrides default 5%", () => {
      const s = getCaptionStyle(1080, 1920, { fontSizePct: 6 });
      assert.equal(s.fontSize, 115);
    });

    it("lineHeight is passed through", () => {
      const s = getCaptionStyle(1080, 1920, { lineHeight: 1.5 });
      assert.equal(s.lineHeight, 1.5);
    });

    it("maxLines is passed through", () => {
      const s = getCaptionStyle(1080, 1920, { maxLines: 3 });
      assert.equal(s.maxLines, 3);
    });

    it("scaleSteps can be overridden", () => {
      const s = getCaptionStyle(1080, 1920, { scaleSteps: [1.0, 0.8] });
      assert.equal(s.scaleSteps.length, 2);
    });

    it("marginV can be overridden", () => {
      const s = getCaptionStyle(1080, 1920, { marginV: 50 });
      assert.equal(s.marginV, 50);
    });
  });

  describe("defaults and fallbacks", () => {
    it("defaults to 1080x1920 when no args", () => {
      const s = getCaptionStyle();
      assert.equal(s.playResX, 1080);
      assert.equal(s.playResY, 1920);
    });

    it("handles zero dimensions by falling back to defaults", () => {
      const s = getCaptionStyle(0, 0);
      assert.equal(s.playResX, 1080);
      assert.equal(s.playResY, 1920);
    });

    it("handles extreme ultra-wide (21:9)", () => {
      const s = getCaptionStyle(2520, 1080);
      assert.equal(s.isLandscape, true);
      assert.ok(s.maxWidthPct >= 90);
    });
  });

  describe("font size scaling across aspect ratios", () => {
    it("9:16 gets a larger font than 16:9 at the same pixel height", () => {
      const vertical = getCaptionStyle(1080, 1920);
      const horizontal = getCaptionStyle(1920, 1080);
      assert.ok(vertical.fontSize > horizontal.fontSize);
    });

    it("all three standard ratios produce valid font sizes", () => {
      const ratios = [
        getCaptionStyle(1080, 1920),
        getCaptionStyle(1920, 1080),
        getCaptionStyle(1080, 1080),
      ];
      for (const s of ratios) {
        assert.ok(s.fontSize > 0, `fontSize ${s.fontSize} should be > 0`);
        assert.ok(s.fontSize < 300, `fontSize ${s.fontSize} should be < 300`);
        assert.ok(s.maxWidthPct > 70 && s.maxWidthPct < 100);
      }
    });
  });
});
