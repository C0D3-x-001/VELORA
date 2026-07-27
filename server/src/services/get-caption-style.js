const FONT_SIZE_PCT_DEFAULT = 5;
const MAX_WIDTH_PCT_DEFAULT = 88;
const SAFE_MARGIN_TOP_PCT_DEFAULT = 10;
const SAFE_MARGIN_BOTTOM_PCT_DEFAULT = 10;
const LINE_HEIGHT_DEFAULT = 1.3;
const MAX_LINES_DEFAULT = 2;
const FONT_SCALE_STEPS = [1.0, 0.92, 0.84, 0.76];

function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function getCaptionStyle(videoWidth, videoHeight, options = {}) {
  const w = Math.max(1, videoWidth || 1080);
  const h = Math.max(1, videoHeight || 1920);
  const aspect = w / h;

  const fontSizePct = options.fontSizePct ?? FONT_SIZE_PCT_DEFAULT;
  const lineH = options.lineHeight ?? LINE_HEIGHT_DEFAULT;
  const maxLines = options.maxLines ?? MAX_LINES_DEFAULT;
  const scaleSteps = options.scaleSteps ?? FONT_SCALE_STEPS;

  const fontSize = Math.round(h * (fontSizePct / 100));

  let maxWidthPct;
  if (aspect < 0.7) {
    maxWidthPct = lerp(82, 85, (aspect - 0.4) / 0.3);
  } else if (aspect < 1.3) {
    maxWidthPct = lerp(85, 90, (aspect - 0.7) / 0.6);
  } else {
    maxWidthPct = lerp(90, 92, Math.min(1, (aspect - 1.3) / 0.5));
  }
  maxWidthPct = Math.round(maxWidthPct);

  let marginTopPct;
  let marginBottomPct;
  if (aspect < 0.7) {
    marginTopPct = 12;
    marginBottomPct = 12;
  } else if (aspect < 1.3) {
    const t = (aspect - 0.7) / 0.6;
    marginTopPct = Math.round(lerp(12, 6, t));
    marginBottomPct = Math.round(lerp(12, 8, t));
  } else {
    marginTopPct = 6;
    marginBottomPct = 8;
  }

  const marginTop = Math.round(h * (marginTopPct / 100));
  const marginBottom = Math.round(h * (marginBottomPct / 100));

  const marginV = options.marginV ?? marginBottom;

  const usableWidth = w * (maxWidthPct / 100);
  const scaledSteps = scaleSteps.map((s) => Math.round(fontSize * s));

  return {
    playResX: w,
    playResY: h,
    fontSize,
    maxWidthPct,
    usableWidth: Math.round(usableWidth),
    marginTop,
    marginBottom,
    marginV,
    marginTopPct,
    marginBottomPct,
    lineHeight: lineH,
    maxLines,
    scaleSteps: scaledSteps,
    aspect,
    isPortrait: aspect < 0.7,
    isSquare: aspect >= 0.7 && aspect <= 1.3,
    isLandscape: aspect > 1.3,
  };
}

export { getCaptionStyle, FONT_SIZE_PCT_DEFAULT, MAX_WIDTH_PCT_DEFAULT, SAFE_MARGIN_TOP_PCT_DEFAULT, SAFE_MARGIN_BOTTOM_PCT_DEFAULT, LINE_HEIGHT_DEFAULT, MAX_LINES_DEFAULT, FONT_SCALE_STEPS };
