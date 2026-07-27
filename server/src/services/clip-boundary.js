const FILLER_WORDS = new Set([
  "um", "uh", "erm", "eh", "ah",
  "like", "you know", "basically", "actually",
  "so", "okay", "well", "right", "yeah",
  "i mean", "kind of", "sort of",
]);

const SENTENCE_ENDERS = /[.!?]+$/;
const STRONG_SENTENCE_ENDERS = /[.!?]$/;
const DISCOURSE_MARKERS = new Set([
  "but", "however", "now", "so", "okay", "right",
  "well", "look", "here's the thing", "the thing is",
  "anyway", "moving on", "that said", "on the other hand",
  "speaking of", "talking about", "meanwhile",
]);

// NEVER-START patterns — advance past these if clip begins with them
const NEVER_START_PATTERNS = [
  "hey guys", "hey everyone", "welcome back", "so today", "what's up",
  "before we start", "hello everyone", "good morning", "good afternoon",
  "shout out", "before we get started", "thanks for watching",
  "as i was saying", "like i said earlier", "as we discussed",
  "so basically", "so um", "so yeah", "um yeah", "so like",
  "and um", "but um", "so anyway", "oh and",
];

// NEVER-END patterns — extend past these if clip ends with them
const NEVER_END_PATTERNS = [
  "anyway", "so yeah", "you know what i mean", "right?", "get it?",
  "does that make sense", "so basically", "i guess", "i don't know",
  "but yeah", "so there you go", "that's about it", "pretty much",
  "next question", "moving on", "let's talk about", "speaking of",
];

// UNRESOLVED ENDING patterns — cliffhangers, setups without payoff, open hooks
// These indicate the clip ends mid-story or mid-argument, not on a completed thought.
const UNRESOLVED_ENDING_PATTERNS = [
  "and that's when", "but then", "what happened was", "so what happened",
  "and i was like", "the thing is", "here's the thing",
  "and then", "after that", "the next day",
  "because", "but the problem is", "the issue is",
  "what do you think", "so basically", "i guess",
  "i don't know", "but yeah", "so there you go",
  "that's about it", "pretty much",
  "and so", "which means", "turns out",
  "and now", "the truth is", "and that's how",
  "let me explain", "the thing about", "so the way",
  "and the reason", "because here's", "but here's",
  "so you see", "the problem with", "what ends up happening",
];

const PAUSE_THRESHOLD = 0.3;
const STRONG_PAUSE_THRESHOLD = 0.6;

function flattenWords(segments) {
  const words = [];
  for (const seg of segments || []) {
    for (const w of seg.words || []) {
      words.push({
        word: w.word || "",
        start: Number(w.start) || 0,
        end: Number(w.end) || 0,
        segmentIndex: segments.indexOf(seg),
      });
    }
  }
  return words.sort((a, b) => a.start - b.start);
}

export { flattenWords };

function detectBoundarySignals(segments, words) {
  const signals = [];

  for (let i = 0; i < (segments || []).length; i++) {
    const seg = segments[i];
    const text = (seg.text || "").trim();

    if (SENTENCE_ENDERS.test(text)) {
      signals.push({
        time: Number(seg.end) || 0,
        type: "segment_end_punctuation",
        strength: 3,
        text: text.slice(-20),
      });
    }

    if (i < (segments || []).length - 1) {
      const nextSeg = segments[i + 1];
      const gap = (Number(nextSeg.start) || 0) - (Number(seg.end) || 0);
      if (gap >= STRONG_PAUSE_THRESHOLD) {
        signals.push({
          time: Number(nextSeg.start) || 0,
          type: "strong_pause",
          strength: 3,
          text: (nextSeg.text || "").slice(0, 30),
        });
      } else if (gap >= PAUSE_THRESHOLD) {
        signals.push({
          time: Number(nextSeg.start) || 0,
          type: "pause",
          strength: 2,
          text: (nextSeg.text || "").slice(0, 30),
        });
      }
    }

    if (i > 0) {
      signals.push({
        time: Number(seg.start) || 0,
        type: "segment_start",
        strength: 1,
        text: text.slice(0, 30),
      });
    }
  }

  const flatWords = words.length > 0 ? words : flattenWords(segments);
  for (let i = 1; i < flatWords.length; i++) {
    const prev = flatWords[i - 1];
    const curr = flatWords[i];
    const gap = (Number(curr.start) || 0) - (Number(prev.end) || 0);

    if (gap >= STRONG_PAUSE_THRESHOLD) {
      const alreadyHasSignal = signals.some(
        (s) => Math.abs(s.time - curr.start) < 0.2 && s.strength >= 3
      );
      if (!alreadyHasSignal) {
        signals.push({
          time: Number(curr.start) || 0,
          type: "word_pause",
          strength: 3,
          text: `${prev.word} → ${curr.word}`,
        });
      }
    } else if (gap >= PAUSE_THRESHOLD) {
      const alreadyHasSignal = signals.some(
        (s) => Math.abs(s.time - curr.start) < 0.2 && s.strength >= 2
      );
      if (!alreadyHasSignal) {
        signals.push({
          time: Number(curr.start) || 0,
          type: "word_gap",
          strength: 2,
          text: `${prev.word} → ${curr.word}`,
        });
      }
    }
  }

  signals.sort((a, b) => a.time - b.time);
  return signals;
}

function findNearestBoundary(targetTime, signals, tolerance, direction) {
  let best = null;
  let bestDist = Infinity;

  for (const sig of signals) {
    let dist;
    if (direction === "backward") {
      if (sig.time > targetTime + 0.1) continue;
      dist = targetTime - sig.time;
    } else if (direction === "forward") {
      if (sig.time < targetTime - 0.1) continue;
      dist = sig.time - targetTime;
    } else {
      dist = Math.abs(sig.time - targetTime);
    }

    if (dist > tolerance) continue;

    const score = dist * 10 - sig.strength * 2;
    if (score < bestDist) {
      bestDist = score;
      best = sig;
    }
  }

  return best;
}

function skipLeadingFillers(startTime, words) {
  let adjustedStart = startTime;

  for (const w of words) {
    if (w.start < adjustedStart - 0.1 || w.end < adjustedStart - 0.1) continue;
    if (w.start > adjustedStart + 1.0) break;

    const clean = w.word.toLowerCase().replace(/[^a-z\s]/g, "").trim();
    if (FILLER_WORDS.has(clean)) {
      adjustedStart = Number(w.end) || adjustedStart;
    } else {
      break;
    }
  }

  return adjustedStart;
}

function findSentenceStart(targetTime, segments, words, tolerance = 5) {
  const flatWords = words.length > 0 ? words : flattenWords(segments);
  const signals = detectBoundarySignals(segments, flatWords);

  const best = findNearestBoundary(targetTime, signals, tolerance, "backward");
  if (best) {
    return {
      time: best.time,
      type: best.type,
      text: best.text,
    };
  }

  return { time: targetTime, type: "original", text: "" };
}

function findSentenceEnd(targetTime, segments, words, tolerance = 3) {
  const flatWords = words.length > 0 ? words : flattenWords(segments);
  const signals = detectBoundarySignals(segments, flatWords);

  const best = findNearestBoundary(targetTime, signals, tolerance, "forward");
  if (best) {
    return {
      time: best.time,
      type: best.type,
      text: best.text,
    };
  }

  return { time: targetTime, type: "original", text: "" };
}

function validateClipStart(start, segments, words) {
  const flatWords = words.length > 0 ? words : flattenWords(segments);

  const firstWord = flatWords.find((w) => w.start >= start - 0.3);
  if (!firstWord) {
    return { valid: true, reason: "no_words_found", adjustedStart: start };
  }

  const clean = firstWord.word.toLowerCase().replace(/[^a-z\s]/g, "").trim();
  if (FILLER_WORDS.has(clean)) {
    const adjusted = skipLeadingFillers(start, flatWords);
    if (adjusted > start) {
      return {
        valid: false,
        reason: `starts_with_filler: "${firstWord.word}"`,
        adjustedStart: adjusted,
      };
    }
  }

  const segmentForStart = (segments || []).find(
    (s) => start >= Number(s.start) - 0.5 && start <= Number(s.end) + 0.5
  );
  if (segmentForStart) {
    const segStart = Number(segmentForStart.start) || 0;
    if (start - segStart > 1.0) {
      const wordsInSeg = flatWords.filter(
        (w) => w.start >= segStart - 0.1 && w.start <= start + 0.1
      );
      const midWordIndex = Math.floor(wordsInSeg.length / 2);
      if (wordsInSeg.length > 2 && midWordIndex > 0) {
        const midWord = wordsInSeg[midWordIndex];
        if (Math.abs(midWord.start - start) < 1.0) {
          return {
            valid: false,
            reason: `mid_sentence_start: ${wordsInSeg.length} words before`,
            adjustedStart: segStart,
          };
        }
      }
    }
  }

  return { valid: true, reason: "ok", adjustedStart: start };
}

function removeOverlap(clips, minGap = 2) {
  const sorted = [...clips].sort((a, b) => a.startTime - b.startTime);
  const result = [];

  for (const clip of sorted) {
    if (result.length === 0) {
      result.push(clip);
      continue;
    }

    const prev = result[result.length - 1];
    if (clip.startTime < prev.endTime + minGap) {
      const adjustedStart = prev.endTime + minGap;
      const duration = clip.endTime - clip.startTime;
      const updated = { ...clip, startTime: adjustedStart, endTime: adjustedStart + duration };
      result.push(updated);
    } else {
      result.push(clip);
    }
  }

  return result;
}

function getWordsInRange(flatWords, startTime, endTime, maxWords = 10) {
  const result = [];
  for (const w of flatWords) {
    if (w.start >= endTime + 0.5) break;
    if (w.start >= startTime - 0.2 && w.end <= endTime + 0.5) {
      result.push(w);
      if (result.length >= maxWords) break;
    }
  }
  return result;
}

function checkNeverStartPattern(words) {
  const text = words.map((w) => w.word).join(" ").toLowerCase().replace(/[^a-z\s]/g, "").trim();
  for (const pattern of NEVER_START_PATTERNS) {
    if (text.startsWith(pattern) || text.includes(pattern)) {
      return { matched: true, pattern, text };
    }
  }
  return { matched: false };
}

function checkNeverEndPattern(words) {
  const text = words.map((w) => w.word).join(" ").toLowerCase().replace(/[^a-z\s]/g, "").trim();
  for (const pattern of NEVER_END_PATTERNS) {
    if (text.endsWith(pattern) || text.includes(pattern)) {
      return { matched: true, pattern, text };
    }
  }
  return { matched: false };
}

function validateHookAndPayoff(start, end, segments, flatWords) {
  const openingWords = getWordsInRange(flatWords, start, start + 4, 8);
  const closingWords = getWordsInRange(flatWords, end - 4, end, 8);

  const openText = openingWords.map((w) => w.word).join(" ");
  const closeText = closingWords.map((w) => w.word).join(" ");

  const issues = [];
  let adjustedStart = start;
  let adjustedEnd = end;

  // Check NEVER-START patterns — advance start past the pattern
  const neverStart = checkNeverStartPattern(openingWords);
  if (neverStart.matched) {
    issues.push(`never-start: "${neverStart.pattern}"`);
    // Try to find the next sentence boundary after the pattern
    const patternEndWord = openingWords.find((w) => {
      const clean = w.word.toLowerCase().replace(/[^a-z\s]/g, "").trim();
      return NEVER_START_PATTERNS.some((p) => p.includes(clean) || clean.includes(p.split(" ").pop()));
    });
    if (patternEndWord) {
      // Advance to end of the pattern word + find next sentence start
      const afterPattern = flatWords.find((w) => w.start > patternEndWord.end + 0.1);
      if (afterPattern) {
        adjustedStart = afterPattern.start;
        issues.push(`adjusted start to ${adjustedStart.toFixed(2)}s past never-start pattern`);
      }
    }
  }

  // Check NEVER-END patterns — extend end past the pattern
  const neverEnd = checkNeverEndPattern(closingWords);
  if (neverEnd.matched) {
    issues.push(`never-end: "${neverEnd.pattern}"`);
    // Try to find the sentence boundary before the trailing pattern
    const patternStartWord = [...closingWords].reverse().find((w) => {
      const clean = w.word.toLowerCase().replace(/[^a-z\s]/g, "").trim();
      return NEVER_END_PATTERNS.some((p) => p.includes(clean) || clean.includes(p.split(" ").pop()));
    });
    if (patternStartWord) {
      // Find the word just before this pattern
      const beforePattern = flatWords.filter((w) => w.start < patternStartWord.start - 0.1).pop();
      if (beforePattern && beforePattern.end > adjustedStart + 5) {
        adjustedEnd = beforePattern.end;
        issues.push(`adjusted end to ${adjustedEnd.toFixed(2)}s before never-end pattern`);
      }
    }
  }

  // Classify hook type (simplified check)
  const openLower = openText.toLowerCase();
  let hookType = null;
  if (/^\d/.test(openLower) || /million|billion|lost \$|saved \$|earned \$/i.test(openLower)) {
    hookType = "numberStake";
  } else if (/^(why|how|what|have you|do you|ever wonder)/.test(openLower)) {
    hookType = "question";
  } else if (/nobody|knew|already over|realized|everything changed|turns out/i.test(openLower)) {
    hookType = "midAction";
  } else if (/honest with you|never told|broke me|terrified|cried|angry/i.test(openLower)) {
    hookType = "emotion";
  } else if (/most people|nobody tells|here's why|secret|stop doing|biggest mistake/i.test(openLower)) {
    hookType = "boldClaim";
  }

  // Classify payoff type (simplified check)
  const closeLower = closeText.toLowerCase();
  let payoffType = null;
  if (/that's the only|that's what|the lesson|the key|the point|and that's why/i.test(closeLower)) {
    payoffType = "conclusion";
  } else if (/turns out|that's your|actually|the opposite|optimizing for the wrong/i.test(closeLower)) {
    payoffType = "reframe";
  } else if (/we did it|it worked|biggest product|called back|proven wrong|that's the story/i.test(closeLower)) {
    payoffType = "micDrop";
  } else if (/that's when i|everything was worth|changed my life|proudest moment/i.test(closeLower)) {
    payoffType = "emotion";
  }

  return {
    adjustedStart,
    adjustedEnd,
    hookType,
    payoffType,
    openingText: openText,
    closingText: closeText,
    issues,
  };
}

/**
 * Reusable: Validate whether a clip's ending resolves on a completed thought.
 * Can be used for end validation now, and adapted for start validation later.
 *
 * @param {Array} flatWords - flattened word list with start/end times
 * @param {number} end - clip end time in seconds
 * @param {object} [options]
 * @param {number} [options.windowSec=8] - how many seconds before `end` to examine
 * @param {number} [options.maxWords=15] - max words to pull from the closing
 * @returns {{ resolved: boolean, reason: string, closingText: string }}
 */
export function validateEndingResolution(flatWords, end, options = {}) {
  const { windowSec = 8, maxWords = 15 } = options;
  const closingWords = getWordsInRange(flatWords, end - windowSec, end, maxWords);
  const closeText = closingWords.map((w) => w.word).join(" ");
  // Normalize: lowercase, strip non-alpha except ?!. and spaces, collapse apostrophes
  const closeLower = closeText.toLowerCase().replace(/['']/g, "").replace(/[^a-z\s?!.]/g, "").trim();

  // 1. Check NEVER-END patterns (existing)
  const neverEnd = checkNeverEndPattern(closingWords);
  if (neverEnd.matched) {
    return { resolved: false, reason: `never_end: "${neverEnd.pattern}"`, closingText: closeText };
  }

  // 2. Check UNRESOLVED ENDING patterns (cliffhangers, setups, open hooks)
  for (const pattern of UNRESOLVED_ENDING_PATTERNS) {
    const normalizedPattern = pattern.replace(/['']/g, "");
    if (closeLower.includes(normalizedPattern)) {
      return { resolved: false, reason: `unresolved_hook: "${pattern}"`, closingText: closeText };
    }
  }

  // 3. Ends with a question mark — likely unresolved (rhetorical questions are caught by the LLM)
  if (/\?\s*$/.test(closeLower)) {
    return { resolved: false, reason: "ends_with_question", closingText: closeText };
  }

  // 4. Trailing off (ellipsis, incomplete sentence)
  if (/(\.{2,}|…)\s*$/.test(closeLower)) {
    return { resolved: false, reason: "trailing_off", closingText: closeText };
  }

  // 5. No sentence ender at all — incomplete thought
  if (closeLower.length > 0 && !/[.!?]\s*$/.test(closeLower)) {
    return { resolved: false, reason: "no_sentence_ender", closingText: closeText };
  }

  return { resolved: true, reason: "ok", closingText: closeText };
}

/**
 * Reusable: Try to find a resolving end point after the current end.
 * Looks for the next natural sentence boundary that ends on a completed thought.
 *
 * @param {number} start - clip start time
 * @param {number} currentEnd - current unresolved end time
 * @param {Array} segments - transcript segments
 * @param {Array} flatWords - flattened word list
 * @param {number} totalDuration - total video duration
 * @param {number} [maxExtension=25] - max seconds to search forward
 * @returns {{ newEnd: number, resolved: boolean, reason: string }|null}
 */
export function findResolvingEndPoint(start, currentEnd, segments, flatWords, totalDuration, maxExtension = 25) {
  const searchEnd = Math.min(currentEnd + maxExtension, totalDuration || Infinity);
  const signals = detectBoundarySignals(segments, flatWords);

  // Collect candidate end points forward from current end, up to searchEnd
  const candidates = signals
    .filter((s) => s.time > currentEnd + 0.5 && s.time <= searchEnd)
    .sort((a, b) => a.time - b.time);

  for (const sig of candidates) {
    const candidateEnd = sig.time;
    const candidateDuration = candidateEnd - start;

    // Must stay within 30-120s for AI-optimized mode
    if (candidateDuration < 30 || candidateDuration > 120) continue;

    // Check if this candidate resolves
    const check = validateEndingResolution(flatWords, candidateEnd);
    if (check.resolved) {
      return {
        newEnd: candidateEnd,
        resolved: true,
        reason: `adjusted to ${candidateEnd.toFixed(1)}s (${check.reason})`,
      };
    }
  }

  return null;
}

export function refineClipBoundaries(candidateStart, candidateEnd, transcript, totalDuration, options = {}) {
  const {
    maxSnapBack = 5,
    maxSnapForward = 3,
    minClipDuration = 10,
    maxClipDuration = 90,
    leadInMs = 200,
  } = options;

  const segments = transcript?.segments || [];
  const flatWords = flattenWords(segments);

  const targetDuration = candidateEnd - candidateStart;
  let start = Math.max(0, candidateStart);
  let end = Math.min(totalDuration || candidateEnd, candidateEnd);

  const startBoundary = findSentenceStart(start, segments, flatWords, maxSnapBack);
  if (startBoundary.time < start && (start - startBoundary.time) <= maxSnapBack) {
    start = startBoundary.time;
  }

  const afterFiller = skipLeadingFillers(start, flatWords);
  if (afterFiller > start && (afterFiller - start) < 2.0) {
    start = afterFiller;
  }

  if (leadInMs > 0 && flatWords.length > 0) {
    const firstWordAfterStart = flatWords.find((w) => w.start >= start - 0.2);
    if (firstWordAfterStart) {
      const leadIn = Math.max(0, firstWordAfterStart.start - (leadInMs / 1000));
      if (start - leadIn < 0.3) {
        start = Math.max(0, leadIn);
      }
    }
  }

  let targetEnd = start + targetDuration;
  const endBoundary = findSentenceEnd(targetEnd, segments, flatWords, maxSnapForward);
  if (endBoundary.time > targetEnd && (endBoundary.time - targetEnd) <= maxSnapForward) {
    end = endBoundary.time;
  } else {
    end = targetEnd;
  }

  start = Math.max(0, start);
  end = Math.min(totalDuration || Infinity, end);

  if (end - start < minClipDuration) {
    end = Math.min(start + minClipDuration, totalDuration || Infinity);
  }

  if (end - start > maxClipDuration) {
    end = start + maxClipDuration;
  }

  const validation = validateClipStart(start, segments, flatWords);
  if (!validation.valid) {
    start = validation.adjustedStart;
  }

  start = Math.max(0, Math.round(start * 100) / 100);
  end = Math.min(totalDuration || Infinity, Math.round(end * 100) / 100);

  if (end - start < minClipDuration) {
    end = Math.min(start + minClipDuration, totalDuration || Infinity);
  }

  // Validate hook quality and payoff completeness
  const hookValidation = validateHookAndPayoff(start, end, segments, flatWords);
  if (hookValidation.issues.length > 0) {
    console.log(`[ClipBoundary] Hook/payoff issues at ${start.toFixed(1)}-${end.toFixed(1)}s: ${hookValidation.issues.join("; ")}`);
  }
  if (hookValidation.adjustedStart > start) {
    start = hookValidation.adjustedStart;
  }
  if (hookValidation.adjustedEnd < end && hookValidation.adjustedEnd > start + minClipDuration) {
    end = hookValidation.adjustedEnd;
  }

  // Re-enforce duration limits after hook adjustment
  if (end - start < minClipDuration) {
    end = Math.min(start + minClipDuration, totalDuration || Infinity);
  }

  // Post-processing: validate ending resolution as safety net
  const resolutionCheck = validateEndingResolution(flatWords, end);
  if (!resolutionCheck.resolved) {
    console.log(`[Resolution] Clip ${start.toFixed(1)}-${end.toFixed(1)}s: unresolved ending — ${resolutionCheck.reason} ("${resolutionCheck.closingText.slice(0, 80)}")`);
  }

  return {
    start,
    end,
    duration: end - start,
    startType: startBoundary?.type || "original",
    endType: endBoundary?.type || "original",
    hookType: hookValidation.hookType,
    payoffType: hookValidation.payoffType,
    snappedBack: candidateStart - start,
    snappedForward: end - candidateEnd,
    hookIssues: hookValidation.issues,
    resolution: resolutionCheck,
  };
}

export function refineAllClipBoundaries(clips, transcript, totalDuration, options = {}) {
  const refined = clips.map((clip) => {
    const result = refineClipBoundaries(
      clip.startTime,
      clip.endTime,
      transcript,
      totalDuration,
      options
    );
    return {
      ...clip,
      startTime: result.start,
      endTime: result.end,
      duration: result.duration,
      _boundary: {
        startType: result.startType,
        endType: result.endType,
        hookType: result.hookType,
        payoffType: result.payoffType,
        snappedBack: result.snappedBack,
        snappedForward: result.snappedForward,
        hookIssues: result.hookIssues,
        resolution: result.resolution,
      },
    };
  });

  return removeOverlap(refined, 2);
}

export function formatTranscriptWithTimestamps(text, segments) {
  if (!segments || segments.length === 0) return text;

  const lines = [];
  for (const seg of segments) {
    const startSec = Number(seg.start) || 0;
    const min = Math.floor(startSec / 60);
    const sec = Math.floor(startSec % 60);
    const ts = `[${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}]`;
    lines.push(`${ts} ${(seg.text || "").trim()}`);
  }

  return lines.join("\n");
}
