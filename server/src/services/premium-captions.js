import fs from "fs";
import { computeCenteredGroupPositions } from "./caption-layout.js";
import { getCaptionStyle } from "./get-caption-style.js";

const W = 1080;
const H = 1920;

// Any inter-word gap >= this (seconds) is a real pause — the caption must
// disappear during it rather than stay visible across the silence.
const GAP_HIDE_THRESHOLD = 0.4;

// Fast speech can leave a word on screen for less than a single frame (~33ms).
// Floor each word's visible duration at this (seconds) so it never flashes.
const MIN_WORD_DURATION = 0.18;

// When the duration floor extends a word's End, cap it just before the next
// word actually starts so two captions never overlap/flicker.
const WORD_END_CAP_GAP = 0.02;

const NON_SPEECH_PATTERN = /^\[.*?\]$|^\(.*?\)$|^\.\.\.$|^…+$|^\s*$/;
const FILLER_WORDS = new Set(["uh", "um", "ah", "er", "hmm", "hm", "huh"]);

function isNonSpeechSegment(text) {
  if (!text) return true;
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (NON_SPEECH_PATTERN.test(trimmed)) return true;
  const clean = trimmed.toLowerCase().replace(/[^a-z]/g, "");
  if (clean.length <= 2 && FILLER_WORDS.has(clean)) return true;
  return false;
}

function getAdaptiveGroupSize(words, frameWidth, frameHeight) {
  const aspect = frameWidth / frameHeight;
  const isPortrait = aspect < 0.8;
  const isSquare = aspect >= 0.8 && aspect <= 1.2;
  const avgLen = words.reduce((s, w) => s + w.replace(/[^a-zA-Z0-9]/g, "").length, 0) / Math.max(1, words.length);

  let maxWords;
  if (isPortrait) {
    maxWords = avgLen >= 7 ? 1 : avgLen >= 4 ? 2 : 3;
  } else if (isSquare) {
    maxWords = avgLen >= 8 ? 1 : avgLen >= 5 ? 2 : 3;
  } else {
    maxWords = avgLen >= 9 ? 1 : avgLen >= 6 ? 2 : 3;
  }

  if (words.length <= 2) return words.length;
  if (words.length <= 3) return Math.min(maxWords, words.length);
  if (words.length <= 5) return Math.min(maxWords, 3);
  if (words.length <= 8) return Math.min(maxWords + 1, 3);
  return Math.min(maxWords + 1, 3);
}

const CAPTION_PRESETS = {
  classic: {
    label: "Classic",
    desc: "Entire sentence displayed at once",
    wordByWord: false,
    groupWords: true,
    groupSize: 999,
    fontSize: 56,
    fontName: "Inter",
    primaryColor: "&H00FFFFFF",
    highlightColor: "&H00F7C34F",
    outlineColor: "&H00000000",
    backColor: "&H80000000",
    outlineWidth: 3,
    shadowDepth: 2,
    bold: true,
    position: "lower",
    animation: "fade",
    animIn: 200,
    animOut: 150,
  },
  tiktok: {
    label: "TikTok",
    desc: "Word-by-word with Impact font, bold style",
    wordByWord: true,
    groupWords: false,
    groupSize: 3,
    fontSize: 80,
    fontName: "Anton",
    primaryColor: "&H00FFFFFF",
    highlightColor: "&H0000DCFF",
    outlineColor: "&H00000000",
    backColor: "&H80000000",
    outlineWidth: 5,
    shadowDepth: 3,
    bold: true,
    position: "center",
    animation: "pop",
    animIn: 80,
    animOut: 80,
    verticalPct: 55,
  },
  bounce: {
    label: "Bounce",
    desc: "Adaptive word-group bounce animation",
    wordByWord: false,
    groupWords: true,
    groupSize: 2,
    fontSize: 68,
    fontName: "Poppins",
    primaryColor: "&H00FFFFFF",
    highlightColor: "&H0000D7FF",
    outlineColor: "&H00000000",
    backColor: "&H80000000",
    outlineWidth: 4,
    shadowDepth: 3,
    bold: true,
    position: "center-low",
    animation: "bounce",
    animIn: 250,
    animOut: 180,
  },
  highlight: {
    label: "Highlight",
    desc: "Full sentence, current word highlighted",
    wordByWord: false,
    groupWords: true,
    groupSize: 999,
    fontSize: 56,
    fontName: "Inter",
    primaryColor: "&H00AAAAAA",
    highlightColor: "&H0000D4FF",
    outlineColor: "&H00000000",
    backColor: "&H80000000",
    outlineWidth: 3,
    shadowDepth: 2,
    bold: true,
    position: "lower",
    animation: "highlight",
    animIn: 100,
    animOut: 100,
  },
  karaoke: {
    label: "Karaoke",
    desc: "Words light up as spoken",
    wordByWord: false,
    groupWords: true,
    groupSize: 999,
    fontSize: 56,
    fontName: "Inter",
    primaryColor: "&H00AAAAAA",
    highlightColor: "&H0000FFFF",
    outlineColor: "&H00000000",
    backColor: "&H80000000",
    outlineWidth: 3,
    shadowDepth: 2,
    bold: true,
    position: "lower",
    animation: "karaoke",
    animIn: 80,
    animOut: 80,
  },
  minimal: {
    label: "Minimal",
    desc: "Simple clean subtitles",
    wordByWord: false,
    groupWords: true,
    groupSize: 999,
    fontSize: 48,
    fontName: "Inter",
    primaryColor: "&H00FFFFFF",
    highlightColor: "&H00FFFFFF",
    outlineColor: "&H00000000",
    backColor: "&H00000000",
    outlineWidth: 2,
    shadowDepth: 1,
    bold: false,
    position: "lower",
    animation: "fade",
    animIn: 150,
    animOut: 100,
  },
  popup: {
    label: "Pop-Up",
    desc: "One word at a time with bounce and color emphasis",
    wordByWord: true,
    groupWords: false,
    groupSize: 1,
    maxWordsOnScreen: 3,
    dimColor: "&H00AAAAAA",
    fontSize: 80,
    fontName: "Anton",
    primaryColor: "&H00FFFFFF",
    highlightColor: "&H0000D4FF",
    outlineColor: "&H00000000",
    backColor: "&H80000000",
    outlineWidth: 5,
    shadowDepth: 3,
    bold: true,
    position: "center",
    animation: "popup",
    animIn: 80,
    animOut: 60,
    verticalPct: 55,
  },
};

function formatASSTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.min(59.99, seconds % 60);
  return `${h}:${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`;
}

function getWordTimestamps(segStart, segEnd, words, realWordTimestamps) {
  if (words.length === 0) return [];
  if (words.length === 1) return [{ word: words[0], start: segStart, end: segEnd }];

  if (realWordTimestamps && realWordTimestamps.length === words.length) {
    return words.map((word, i) => ({
      word,
      start: realWordTimestamps[i].start,
      end: realWordTimestamps[i].end,
    }));
  }

  const segDuration = segEnd - segStart;
  const avgWordDuration = segDuration / words.length;
  return words.map((word, i) => {
    const cleanLen = word.replace(/[^a-zA-Z0-9]/g, "").length;
    const baseLen = Math.max(1, words.reduce((s, w) => s + w.replace(/[^a-zA-Z0-9]/g, "").length, 0));
    const weight = cleanLen / baseLen;
    const weightedDuration = avgWordDuration * weight * words.length;
    const wordDuration = Math.max(0.15, Math.min(avgWordDuration * 2, weightedDuration));
    const start = segStart + i * avgWordDuration;
    return {
      word,
      start: Math.max(segStart, start),
      end: Math.min(segEnd, start + wordDuration),
    };
  });
}

function escapeASSText(text) {
  return text.replace(/\\/g, "\\\\").replace(/\n/g, "\\N").replace(/[{]/g, "\\{").replace(/[}]/g, "\\}");
}

// Split an array of { start, end, word } timestamps into runs at real pauses.
// A gap between consecutive words >= GAP_HIDE_THRESHOLD is a genuine silence:
// the caption must end with the last word before the pause, and the next word
// starts a fresh Dialogue event after it. Groups/segments never straddle a gap.
function splitAtGaps(wordTimestamps) {
  if (!wordTimestamps || wordTimestamps.length === 0) return [];
  const runs = [];
  let current = [wordTimestamps[0]];
  for (let i = 1; i < wordTimestamps.length; i++) {
    const gap = wordTimestamps[i].start - wordTimestamps[i - 1].end;
    if (gap >= GAP_HIDE_THRESHOLD) {
      runs.push(current);
      current = [wordTimestamps[i]];
    } else {
      current.push(wordTimestamps[i]);
    }
  }
  runs.push(current);
  return runs;
}

// Floor each word's visible duration at MIN_WORD_DURATION. Extends the End only
// (a word is never shown before it is actually spoken). If the extension would
// overlap the next word's real start, cap it at nextStart - WORD_END_CAP_GAP so
// two captions never collide/flicker.
function applyMinDuration(wordTimestamps) {
  return wordTimestamps.map((wt, i, arr) => {
    const next = arr[i + 1];
    const rawDuration = wt.end - wt.start;
    if (rawDuration >= MIN_WORD_DURATION) return wt;
    let end = wt.start + MIN_WORD_DURATION;
    if (next && end >= next.start) {
      end = Math.max(wt.end, Math.max(wt.start, next.start - WORD_END_CAP_GAP));
    }
    return { ...wt, end };
  });
}

function hexToASS(hex) {
  if (!hex || hex.startsWith("&H")) return hex || "&H00FFFFFF";
  const rgbaMatch = hex.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/);
  let r, g, b, a;
  if (rgbaMatch) {
    r = parseInt(rgbaMatch[1], 10);
    g = parseInt(rgbaMatch[2], 10);
    b = parseInt(rgbaMatch[3], 10);
    a = rgbaMatch[4] !== undefined ? Math.round((1 - parseFloat(rgbaMatch[4])) * 255) : 0;
  } else {
    const h = hex.replace("#", "");
    r = parseInt(h.substring(0, 2), 16);
    g = parseInt(h.substring(2, 4), 16);
    b = parseInt(h.substring(4, 6), 16);
    a = 0;
  }
  return `&H${a.toString(16).padStart(2, "0").toUpperCase()}${b.toString(16).padStart(2, "0").toUpperCase()}${g.toString(16).padStart(2, "0").toUpperCase()}${r.toString(16).padStart(2, "0").toUpperCase()}`;
}

function buildPopAnimation(effectTag, scaleBase, scaleTarget, animIn, animOut) {
  return `{\\fscx${scaleBase}\\fscy${scaleBase}${effectTag}\\t(0,${animIn},\\fscx${scaleTarget}\\fscy${scaleTarget})\\t(${animIn},${animIn + 60},\\fscx${Math.round((scaleTarget + 100) / 2)}\\fscy${Math.round((scaleTarget + 100) / 2)})\\t(${animIn + 60},${animIn + 120},\\fscx105\\fscy105)\\fad(${animIn},${animOut})\\b1}`;
}

function buildBounceAnimation(effectTag, scaleBase, scaleTarget, animIn, animOut) {
  return `{\\fscx${scaleBase}\\fscy${scaleBase}${effectTag}\\t(0,${Math.round(animIn * 0.4)},\\fscx${scaleTarget}\\fscy${scaleTarget})\\t(${Math.round(animIn * 0.4)},${Math.round(animIn * 0.7)},\\fscx${Math.round(scaleTarget * 0.92)}\\fscy${Math.round(scaleTarget * 0.92)})\\t(${Math.round(animIn * 0.7)},${Math.round(animIn * 0.85)},\\fscx103\\fscy103)\\t(${Math.round(animIn * 0.85)},${animIn},\\fscx100\\fscy100)\\fad(${animIn},${animOut})\\b1}`;
}

function buildFadeAnimation(animIn, animOut) {
  return `{\\fad(${animIn},${animOut})\\b1}`;
}

function buildPopupAnimation(accentColor, scaleBase, scaleTarget, animIn, animOut) {
  const peakTime = Math.round(animIn * 0.6);
  return `{\\fscx${scaleBase}\\fscy${scaleBase}\\1c${accentColor}`
    + `\\t(0,${peakTime},\\fscx${scaleTarget}\\fscy${scaleTarget}\\1c&H00FFFFFF&)`
    + `\\t(${peakTime},${animIn},\\fscx100\\fscy100)`
    + `\\fad(${animIn},${animOut})\\b1}`;
}

function getMarginV(preset, frameHeight) {
  const pos = String(preset.position);
  const pct = parseFloat(pos);
  if (!isNaN(pct) && pct >= 0 && pct <= 100) {
    return Math.round(frameHeight * (1 - pct / 100));
  }
  switch (pos) {
    case "center-low": return Math.round(frameHeight * 0.28);
    case "center": return Math.round(frameHeight * 0.42);
    case "upper": return Math.round(frameHeight * 0.1);
    default: return Math.round(frameHeight * 0.12);
  }
}

export async function generatePremiumCaptionFile(segments, emphasisMap, outputPath, presetName = "classic", frameWidth, frameHeight, options = {}) {
  const preset = { ...(CAPTION_PRESETS[presetName] || CAPTION_PRESETS.classic) };
  if (options.positionOverride) {
    preset.position = options.positionOverride;
  }
  const fW = frameWidth || W;
  const fH = frameHeight || H;

  const capStyle = getCaptionStyle(fW, fH, {
    fontSizePct: options.fontSizePct,
    lineHeight: options.lineHeight,
    maxLines: options.maxLines,
    scaleSteps: options.scaleSteps,
  });

  const marginV = getMarginV(preset, fH);

  let header;
  let dialogueLines = [];

  const nonAdvFontSize = Math.round((preset.fontSize || 120) * fH / 1920);
    header = `[Script Info]
Title: Velora Premium Captions
ScriptType: v4.00+
PlayResX: ${fW}
PlayResY: ${fH}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Normal,${preset.fontName},${nonAdvFontSize},${preset.primaryColor},&H000000FF,${preset.outlineColor},${preset.backColor},${preset.bold ? 1 : 0},0,0,0,100,100,1,0,1,${preset.outlineWidth},${preset.shadowDepth},2,30,30,${marginV},1
Style: Highlight,${preset.fontName},${Math.round(nonAdvFontSize * 1.15)},${preset.highlightColor},&H000000FF,${preset.outlineColor},${preset.backColor},${preset.bold ? 1 : 0},0,0,0,100,100,1,0,1,${preset.outlineWidth + 1},${preset.shadowDepth + 1},2,30,30,${marginV},1
Style: Emphasis1,${preset.fontName},${Math.round(nonAdvFontSize * 1.2)},${preset.highlightColor},&H000000FF,${preset.outlineColor},${preset.backColor},${preset.bold ? 1 : 0},0,0,0,100,100,1,0,1,${preset.outlineWidth + 1},${preset.shadowDepth + 1},2,30,30,${marginV},1
Style: Emphasis2,${preset.fontName},${Math.round(nonAdvFontSize * 1.45)},${preset.highlightColor},&H000000FF,${preset.outlineColor},${preset.backColor},${preset.bold ? 1 : 0},0,0,0,100,100,1,0,1,${preset.outlineWidth + 2},${preset.shadowDepth + 1},2,30,30,${marginV},1
Style: Emphasis3,${preset.fontName},${Math.round(nonAdvFontSize * 1.7)},${preset.highlightColor},&H000000FF,${preset.outlineColor},${preset.backColor},${preset.bold ? 1 : 0},0,0,0,100,100,1,0,1,${preset.outlineWidth + 2},${preset.shadowDepth + 2},2,30,30,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    segments.forEach((seg, segIdx) => {
      if (!seg.text?.trim() || seg.end <= seg.start) return;
      if (isNonSpeechSegment(seg.text)) return;

      const segDuration = seg.end - seg.start;
      const allWords = (seg.words && seg.words.length > 0)
        ? seg.words.map((w) => w.word)
        : seg.text.trim().split(/\s+/).filter(Boolean);
      if (allWords.length === 0) return;

      const segEmphasis = emphasisMap?.[segIdx] || [];
      const emphasisWords = new Map();
      segEmphasis.forEach((e) => {
        const clean = e.word.toLowerCase().replace(/[^a-z]/g, "");
        emphasisWords.set(clean, e);
      });

      if (preset.wordByWord) {
        const rawWordTimestamps = getWordTimestamps(seg.start, seg.end, allWords, seg.words);
        const OVERLAP_GAP = 0.01;
        const overlapClamped = rawWordTimestamps.map((wt, i, arr) => {
          const next = arr[i + 1];
          if (next && wt.end > next.start - OVERLAP_GAP) {
            return { ...wt, end: Math.max(wt.start + 0.03, next.start - OVERLAP_GAP) };
          }
          return wt;
        });
        // Fast speech must still be legible: no word flashes for < MIN_WORD_DURATION.
        const wordTimestamps = applyMinDuration(overlapClamped);
        const normalizedFontSize = Math.round((preset.fontSize || 120) * fH / 1920);
        const verticalPct = preset.verticalPct ?? (preset.position === "center" ? 50 : preset.position === "center-low" ? 60 : 80);
        const maxWordsOnScreen = Math.max(1, preset.maxWordsOnScreen || 1);
        const dimColor = preset.dimColor || preset.primaryColor;

        const wordInfos = wordTimestamps.map((wt) => {
          if (wt.start == null || wt.end == null || wt.end <= wt.start) return null;

          const cleanWord = wt.word.toLowerCase().replace(/[^a-z]/g, "");
          const emph = emphasisWords.get(cleanWord);
          const level = emph?.level || 0;

          let styleName = "Normal";
          let scaleBase = 100;
          let scaleTarget = 100;

          if (level >= 3) {
            styleName = "Emphasis3";
            scaleBase = 70;
            scaleTarget = 160;
          } else if (level >= 2) {
            styleName = "Emphasis2";
            scaleBase = 75;
            scaleTarget = 125;
          } else if (level >= 1) {
            styleName = "Emphasis1";
            scaleBase = 80;
            scaleTarget = 115;
          } else {
            styleName = "Normal";
            scaleBase = 85;
            scaleTarget = 105;
          }

          const displayWord = (level >= 2 && (emph?.type === "punchline" || emph?.type === "hook"))
            ? wt.word.toUpperCase()
            : wt.word;

          const wordDurationMs = (wt.end - wt.start) * 1000;
          let animation;
          if (wordDurationMs < 200) {
            animation = `{\\fad(40,40)\\b1}`;
          } else if (preset.animation === "bounce") {
            animation = buildBounceAnimation("", scaleBase, scaleTarget, preset.animIn, preset.animOut);
          } else if (preset.animation === "pop") {
            animation = buildPopAnimation("", scaleBase, scaleTarget, preset.animIn, preset.animOut);
          } else if (preset.animation === "popup") {
            animation = buildPopupAnimation(preset.highlightColor, scaleBase, scaleTarget, preset.animIn, preset.animOut);
          } else {
            animation = buildFadeAnimation(preset.animIn, preset.animOut);
          }

          return { start: wt.start, end: wt.end, displayWord, styleName, animation };
        });

        wordInfos.forEach((info, i) => {
          if (!info) return;

          const windowStart = Math.max(0, i - maxWordsOnScreen + 1);
          const window = wordInfos.slice(windowStart, i + 1).filter(Boolean);

          const groupPositions = computeCenteredGroupPositions(
            window.map((w) => w.displayWord),
            {
              frameWidth: fW,
              frameHeight: fH,
              fontSize: normalizedFontSize,
              fontWeight: preset.bold ? 700 : 400,
              letterSpacing: 0,
              verticalPct,
            }
          );
          const anchorX = groupPositions[0].x;
          const anchorY = groupPositions[0].y;

          const wordSegments = window.map((w, wi) => {
            const escapedWord = escapeASSText(w.displayWord);
            const isActive = wi === window.length - 1;
            let tag = isActive
              ? w.animation.replace(/^{/, "").replace(/}$/, "")
              : `\\c${dimColor}`;
            if (wi === 0) {
              tag = `\\pos(${anchorX},${anchorY})\\an7${tag}`;
            }
            return `{${tag}}${escapedWord}`;
          });
          const fullText = wordSegments.join(" ");

          const startStr = formatASSTime(info.start);
          const endStr = formatASSTime(info.end);

          dialogueLines.push(`Dialogue: 0,${startStr},${endStr},${info.styleName},,0,0,0,,${fullText}`);
        });

      } else if (preset.animation === "highlight") {
        const wordTimestamps = applyMinDuration(getWordTimestamps(seg.start, seg.end, allWords, seg.words));
        allWords.forEach((word, _i) => {
          const cleanWord = word.toLowerCase().replace(/[^a-z]/g, "");
          const emph = emphasisWords.get(cleanWord);
          const level = emph?.level || 0;

          const wt = wordTimestamps[_i];
          if (!wt) return;

          const allWordsText = allWords.join(" ");
          const startStr = formatASSTime(wt.start);
          const endStr = formatASSTime(wt.end);

          const highlightDelay = Math.round((wt.start - seg.start) * 1000);

          let styleName = "Normal";
          let effectContent = "";
          if (level >= 2) {
            styleName = "Emphasis2";
            effectContent = `{\\1c${preset.highlightColor}\\t(${highlightDelay},${highlightDelay + 80},\\1c&HFFFFFF&)\\fad(80,80)\\b1}`;
          } else if (level >= 1) {
            styleName = "Highlight";
            effectContent = `{\\1c${preset.highlightColor}\\t(${highlightDelay},${highlightDelay + 60},\\1c&HFFFFFF&)\\fad(60,60)\\b1}`;
          } else {
            effectContent = `{\\fad(100,100)\\b1}`;
          }

          dialogueLines.push(`Dialogue: 0,${startStr},${endStr},${styleName},,0,0,0,,${effectContent}${escapeASSText(allWordsText)}`);
        });

      } else if (preset.animation === "karaoke") {
        const rawKaraokeTimestamps = getWordTimestamps(seg.start, seg.end, allWords, seg.words);
        const wordTimestamps = applyMinDuration(rawKaraokeTimestamps);
        let maxLevel = 0;
        let dominantType = "statement";
        allWords.forEach((w) => {
          const clean = w.toLowerCase().replace(/[^a-z]/g, "");
          const emph = emphasisWords.get(clean);
          if (emph && emph.level > maxLevel) {
            maxLevel = emph.level;
            dominantType = emph.type;
          }
        });

        let styleName = "Normal";
        if (maxLevel >= 3) styleName = "Emphasis3";
        else if (maxLevel >= 2) styleName = "Emphasis2";
        else if (maxLevel >= 1) styleName = "Highlight";

        // Karaoke normally keeps one Dialogue event per segment, which would stay
        // visible across real pauses. Split at gaps (raw timestamps, before the
        // 0.18s duration floor) so the line disappears during genuine silence;
        // \kf fill delays stay relative to each run's own start.
        const karaokeRuns = splitAtGaps(rawKaraokeTimestamps);
        let karaokeIdx = 0;
        karaokeRuns.forEach((run) => {
          const runStart = run[0].start;
          // Use the floored end of the run's last word so a short final word
          // still satisfies the minimum on-screen duration.
          const runEnd = wordTimestamps[karaokeIdx + run.length - 1].end;
          const karaokeParts = run.map((wt, wi) => {
            const delay = Math.round((wt.start - runStart) * 100);
            return `{\\kf${delay}}${escapeASSText(wt.word)}`;
          });
          karaokeIdx += run.length;

          let text = karaokeParts.join(" ");
          if (dominantType === "question" && !text.trim().endsWith("?")) text += " ?";
          if (maxLevel >= 2 && (dominantType === "punchline" || dominantType === "hook")) {
            text = text.toUpperCase();
          }

          dialogueLines.push(`Dialogue: 0,${formatASSTime(runStart)},${formatASSTime(runEnd)},${styleName},,0,0,0,,${text}`);
        });

      } else {
        let maxLevel = 0;
        allWords.forEach((w) => {
          const clean = w.toLowerCase().replace(/[^a-z]/g, "");
          const emph = emphasisWords.get(clean);
          if (emph && emph.level > maxLevel) {
            maxLevel = emph.level;
          }
        });

        const groupSize = preset.groupWords
          ? (preset.animation === "pop" || preset.animation === "bounce"
              ? getAdaptiveGroupSize(allWords, fW, fH)
              : allWords.length <= 3 ? allWords.length
                : allWords.length <= 6 ? 3
                : allWords.length <= 10 ? Math.min(4, allWords.length)
                : Math.min(5, allWords.length))
          : allWords.length;
        const groups = [];
        const groupIndexRanges = [];

        // Use real per-word Whisper timestamps for each group's on-screen window
        // instead of evenly dividing the segment duration — even division ignores
        // pauses/pacing within the segment and was causing captions to drift out
        // of sync with the audio.
        const rawGroupWordTimestamps = getWordTimestamps(seg.start, seg.end, allWords, seg.words);

        // Split the word range into runs at real pauses (gap >= GAP_HIDE_THRESHOLD)
        // BEFORE flooring durations — otherwise the 0.18s floor could mask a pause.
        // A group never straddles a pause, so the caption disappears during
        // genuine silence instead of staying visible across it. sub-second gaps
        // (natural speech cadence) still group together as before.
        const gapRuns = splitAtGaps(rawGroupWordTimestamps);
        const groupWordTimestamps = applyMinDuration(rawGroupWordTimestamps);
        let globalWordIdx = 0;
        for (const run of gapRuns) {
          for (let g = 0; g < run.length; g += groupSize) {
            const rangeStart = globalWordIdx + g;
            const rangeEnd = Math.min(rangeStart + groupSize, globalWordIdx + run.length);
            groups.push(allWords.slice(rangeStart, rangeEnd));
            groupIndexRanges.push([rangeStart, rangeEnd]);
          }
          globalWordIdx += run.length;
        }

        groups.forEach((group, gi) => {
          const [rangeStart, rangeEnd] = groupIndexRanges[gi];
          const firstWt = groupWordTimestamps[rangeStart];
          const lastWt = groupWordTimestamps[rangeEnd - 1];
          const groupStart = firstWt ? firstWt.start : seg.start;
          const groupEnd = lastWt ? lastWt.end : seg.end;
          const startStr = formatASSTime(groupStart);
          const endStr = formatASSTime(groupEnd);

          let groupMaxLevel = 0;
          let groupDominantType = "statement";
          group.forEach((w) => {
            const clean = w.toLowerCase().replace(/[^a-z]/g, "");
            const emph = emphasisWords.get(clean);
            if (emph && emph.level > groupMaxLevel) {
              groupMaxLevel = emph.level;
              groupDominantType = emph.type;
            }
          });

          let styleName = "Normal";
          let scaleBase = 100;
          let scaleTarget = 100;
          if (groupMaxLevel >= 3) {
            styleName = "Emphasis3";
            scaleBase = 70;
            scaleTarget = 130;
          } else if (groupMaxLevel >= 2) {
            styleName = "Emphasis2";
            scaleBase = 75;
            scaleTarget = 120;
          } else if (groupMaxLevel >= 1) {
            styleName = "Emphasis1";
            scaleBase = 80;
            scaleTarget = 112;
          } else {
            scaleBase = 85;
            scaleTarget = 105;
          }

          let animation;
          if (preset.animation === "pop") {
            animation = buildPopAnimation("", scaleBase, scaleTarget, preset.animIn, preset.animOut);
          } else if (preset.animation === "bounce") {
            animation = buildBounceAnimation("", scaleBase, scaleTarget, preset.animIn, preset.animOut);
          } else if (preset.animation === "popup") {
            animation = buildPopupAnimation(preset.highlightColor, scaleBase, scaleTarget, preset.animIn, preset.animOut);
          } else {
            animation = buildFadeAnimation(preset.animIn, preset.animOut);
          }

          let text = group.join(" ");
          if (groupDominantType === "question" && !text.trim().endsWith("?")) text += " ?";
          if (groupMaxLevel >= 2 && (groupDominantType === "punchline" || groupDominantType === "hook")) {
            text = text.toUpperCase();
          }

          dialogueLines.push(`Dialogue: 0,${startStr},${endStr},${styleName},,0,0,0,,${animation}${escapeASSText(text)}`);
        });
      }
    });

  const ass = header + dialogueLines.join("\n") + "\n";
  console.log(`[Captions] Generated ASS: ${dialogueLines.length} dialogue lines, ${segments.length} segments, preset=${presetName}`);
  if (dialogueLines.length === 0) {
    console.warn(`[Captions] WARNING: ASS file has NO dialogue lines — captions will be invisible`);
    console.warn(`[Captions] Debug: segments.length=${segments.length}, first segment words=${segments[0]?.words?.length ?? 'none'}, first segment text="${segments[0]?.text?.slice(0, 50) ?? ''}"`);
  }
  await fs.promises.writeFile(outputPath, ass, "utf-8");
  return outputPath;
}

export { CAPTION_PRESETS };
