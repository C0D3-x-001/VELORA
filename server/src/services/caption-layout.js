const DEFAULT_CONFIG = {
  frameWidth: 1080,
  frameHeight: 1920,
  fontSize: 120,
  fontName: "Poppins",
  fontWeight: 700,
  maxWidthPct: 80,
  maxLines: 2,
  horizontalAlign: "center",
  verticalPct: 50,
  letterSpacing: 1,
  lineHeight: 1.3,
  paddingX: 20,
  paddingY: 20,
  highlightScale: 1.15,
  animIn: 80,
  animOut: 80,
  highlightColor: "#00D4FF",
  textColor: "#FFFFFF",
  outlineColor: "#000000",
  outlineWidth: 4,
  shadowColor: "#000000",
  shadowDepth: 3,
  highlightBg: null,
  highlightRadius: 0,
  highlightGlow: false,
  highlightGlowColor: "#00D4FF",
  highlightGlowIntensity: 5,
};

const UNSPLITTABLE = /^(?:[\d$€£¥%.,]+|[A-Z]\.[A-Z]?\.?|@|#|https?:\/\/)/i;

function estimateCharWidth(fontSize, fontWeight) {
  const baseRatio = fontWeight >= 700 ? 0.58 : 0.52;
  return fontSize * baseRatio;
}

function measureWord(word, fontSize, fontWeight, letterSpacing) {
  const charW = estimateCharWidth(fontSize, fontWeight);
  const cleanLen = word.replace(/[^a-zA-Z0-9]/g, "").length || 1;
  const punctLen = word.length - cleanLen;
  return cleanLen * charW + punctLen * (charW * 0.3) + letterSpacing * Math.max(0, word.length - 1);
}

function breakLines(words, maxWidth, maxLines, fontSize, fontWeight, letterSpacing) {
  if (words.length === 0) return [];

  const wordWidths = words.map((w) => measureWord(w, fontSize, fontWeight, letterSpacing));
  const spaceWidth = measureWord(" ", fontSize, fontWeight, letterSpacing);
  const totalNaturalWidth = wordWidths.reduce((s, w) => s + w, 0) + spaceWidth * (words.length - 1);

  if (words.length <= maxLines && totalNaturalWidth <= maxWidth) {
    return [{ words: words.map((w, i) => ({ word: w, index: i, width: wordWidths[i] })), width: totalNaturalWidth }];
  }

  if (maxLines === 1) {
    return [{ words: words.map((w, i) => ({ word: w, index: i, width: wordWidths[i] })), width: totalNaturalWidth }];
  }

  const lines = [];
  let currentLine = [];
  let currentWidth = 0;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const ww = wordWidths[i];
    const testWidth = currentLine.length === 0 ? ww : currentWidth + spaceWidth + ww;

    if (testWidth > maxWidth && currentLine.length > 0) {
      if (!UNSPLITTABLE.test(w) && currentLine.length > 0) {
        lines.push({ words: currentLine, width: currentWidth });
        currentLine = [{ word: w, index: i, width: ww }];
        currentWidth = ww;
      } else {
        currentLine.push({ word: w, index: i, width: ww });
        currentWidth = testWidth;
      }
    } else {
      currentLine.push({ word: w, index: i, width: ww });
      currentWidth = testWidth;
    }
  }

  if (currentLine.length > 0) {
    lines.push({ words: currentLine, width: currentWidth });
  }

  while (lines.length > maxLines && lines.length > 1) {
    let minIdx = 0;
    let minLen = Infinity;
    for (let i = 0; i < lines.length - 1; i++) {
      if (i > 0 && lines[i].words.length < minLen) {
        minLen = lines[i].words.length;
        minIdx = i;
      }
    }
    if (minIdx === 0 && lines.length > 1) minIdx = 1;
    const merged = {
      words: [...lines[minIdx - 1].words, ...lines[minIdx].words],
      width: lines[minIdx - 1].width + spaceWidth + lines[minIdx].width,
    };
    lines.splice(minIdx - 1, 2, merged);
  }

  return lines;
}

function computeWordPositions(lines, config) {
  const {
    frameWidth,
    frameHeight,
    fontSize,
    horizontalAlign,
    verticalPct,
    lineHeight,
    paddingX,
    letterSpacing,
  } = config;

  const spaceWidth = measureWord(" ", fontSize, config.fontWeight, letterSpacing);
  const usableWidth = frameWidth * (config.maxWidthPct / 100) - paddingX * 2;
  const lineH = fontSize * lineHeight;
  const totalTextHeight = lines.length * lineH;
  const startY = frameHeight * (1 - verticalPct / 100) - totalTextHeight / 2;

  const positionedWords = [];
  const lineData = [];

  lines.forEach((line, lineIdx) => {
    let x;
    const lineY = startY + lineIdx * lineH + fontSize * 0.8;

    if (horizontalAlign === "left") {
      x = paddingX;
    } else if (horizontalAlign === "right") {
      x = frameWidth - paddingX - line.width;
    } else {
      x = (frameWidth - line.width) / 2;
    }

    const lineWords = [];

    line.words.forEach((w) => {
      positionedWords.push({
        word: w.word,
        index: w.index,
        x: Math.round(x),
        y: Math.round(lineY),
        width: Math.round(w.width),
        height: Math.round(fontSize),
        lineIndex: lineIdx,
        assAlign: 8,
      });

      lineWords.push({
        word: w.word,
        x: Math.round(x),
        width: Math.round(w.width),
      });

      x += w.width + spaceWidth;
    });

    lineData.push({
      y: Math.round(lineY),
      width: Math.round(line.width),
      height: Math.round(lineH),
      wordCount: line.words.length,
      x: horizontalAlign === "left"
        ? paddingX
        : horizontalAlign === "right"
          ? frameWidth - paddingX - line.width
          : (frameWidth - line.width) / 2,
    });
  });

  return { words: positionedWords, lines: lineData };
}

export function computeCenteredGroupPositions(words, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const spaceWidth = estimateCharWidth(cfg.fontSize, cfg.fontWeight) * 0.6;
  const widths = words.map((w) => measureWord(w, cfg.fontSize, cfg.fontWeight, cfg.letterSpacing));
  const totalWidth = widths.reduce((sum, w) => sum + w, 0) + spaceWidth * Math.max(0, words.length - 1);
  const y = Math.round(cfg.frameHeight * (1 - cfg.verticalPct / 100));
  let cursorX = Math.round((cfg.frameWidth - totalWidth) / 2);
  return words.map((word, i) => {
    const width = widths[i];
    const pos = { word, x: Math.round(cursorX), y, width: Math.round(width) };
    cursorX += width + spaceWidth;
    return pos;
  });
}

export function computeCenteredWordPosition(word, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const width = measureWord(word, cfg.fontSize, cfg.fontWeight, cfg.letterSpacing);
  const x = Math.round((cfg.frameWidth - width) / 2);
  const y = Math.round(cfg.frameHeight * (1 - cfg.verticalPct / 100));
  return { word, x, y, width: Math.round(width), height: Math.round(cfg.fontSize) };
}

export function computeLayout(rawWords, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (!rawWords || rawWords.length === 0) {
    return { words: [], lines: [], totalWidth: 0, totalHeight: 0, totalLines: 0 };
  }

  const cleanWords = rawWords.filter((w) => w && w.trim().length > 0);
  if (cleanWords.length === 0) {
    return { words: [], lines: [], totalWidth: 0, totalHeight: 0, totalLines: 0 };
  }

  const usableWidth = cfg.frameWidth * (cfg.maxWidthPct / 100) - cfg.paddingX * 2;
  const lines = breakLines(cleanWords, usableWidth, cfg.maxLines, cfg.fontSize, cfg.fontWeight, cfg.letterSpacing);
  const { words, lines: lineData } = computeWordPositions(lines, cfg);

  const totalWidth = lineData.length > 0
    ? Math.max(...lineData.map((l) => l.width))
    : 0;
  const totalHeight = lines.length * cfg.fontSize * cfg.lineHeight;

  return {
    words,
    lines: lineData,
    totalWidth: Math.round(totalWidth),
    totalHeight: Math.round(totalHeight),
    totalLines: lines.length,
  };
}

export function computeLayoutForSegment(words, segmentStart, segmentEnd, config = {}) {
  const layout = computeLayout(words, config);

  const wordsWithTiming = layout.words.map((w) => ({
    ...w,
    start: null,
    end: null,
  }));

  return { ...layout, words: wordsWithTiming };
}

export function attachTiming(layoutWords, wordTimestamps) {
  if (!wordTimestamps || wordTimestamps.length === 0) return layoutWords;

  if (layoutWords.length === wordTimestamps.length) {
    return layoutWords.map((w, i) => ({
      ...w,
      start: wordTimestamps[i].start,
      end: wordTimestamps[i].end,
    }));
  }

  const used = new Set();
  const matched = layoutWords.map((w) => {
    const cleanTarget = w.word.toLowerCase().replace(/[^a-z]/g, "");
    for (let i = 0; i < wordTimestamps.length; i++) {
      if (used.has(i)) continue;
      const cleanTs = wordTimestamps[i].word.toLowerCase().replace(/[^a-z]/g, "");
      if (cleanTs === cleanTarget) {
        used.add(i);
        return { ...w, start: wordTimestamps[i].start, end: wordTimestamps[i].end };
      }
    }
    return w;
  });

  return matched.map((w) => {
    if (w.start != null) return w;
    const idx = w.index;
    if (idx < wordTimestamps.length && !used.has(idx)) {
      used.add(idx);
      return { ...w, start: wordTimestamps[idx].start, end: wordTimestamps[idx].end };
    }
    return w;
  });
}

export { DEFAULT_CONFIG };
