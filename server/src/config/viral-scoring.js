export const VIRAL_SCORING = {
  dimensions: [
    { key: "hookStrength",     label: "Hook Strength",     weight: 1.5, description: "First 1-3 seconds: curiosity, shock, contradiction, bold claim" },
    { key: "curiosity",        label: "Curiosity",         weight: 1.3, description: "Does the clip create an information gap that demands resolution?" },
    { key: "educationalValue", label: "Educational Value",  weight: 1.0, description: "Does the viewer learn one clear lesson?" },
    { key: "storyStructure",   label: "Story Structure",   weight: 1.2, description: "Hook → Problem → Tension → Solution → Takeaway" },
    { key: "emotion",          label: "Emotion",           weight: 1.2, description: "Excitement, anger, disbelief, passion, humor, urgency" },
    { key: "shareability",     label: "Shareability",      weight: 1.1, description: "Would someone send this to a friend? Business, money, AI, psychology" },
    { key: "pacing",           label: "Pacing",            weight: 0.8, description: "Fast pace, clear speech, few pauses, natural energy" },
    { key: "retention",        label: "Retention",         weight: 1.3, description: "Curiosity early, tension builds, delayed payoff, satisfying end" },
    { key: "captionReadability", label: "Caption Readability", weight: 0.7, description: "Concise impactful sentences, not too dense for center captions" },
    { key: "faceVisibility",   label: "Face Visibility",   weight: 0.9, description: "Face visible, centered, expressions strong, gestures clear" },
  ],

  minimumViralScore: parseInt(process.env.VIRAL_MIN_SCORE || "60", 10),
  minimumDimensionScore: parseInt(process.env.VIRAL_MIN_DIMENSION || "4", 10),
  maxMoments: parseInt(process.env.VIRAL_MAX_MOMENTS || "15", 10),

  hookPatterns: {
    // Type A: Drop into the middle of something (already in motion)
    midAction: [
      "nobody knew", "and that's when", "everything changed", "it was already over",
      "i realized", "that's when i", "what happened next", "the truth is",
      "turns out", "looking back", "in that moment", "and nobody",
      "but here's the thing", "what i didn't know", "the moment everything",
    ],
    // Type B: Bold or counterintuitive claim
    boldClaim: [
      "most people fail", "nobody tells you", "here's why", "the truth about",
      "changes everything", "you're doing it wrong", "stop doing", "the problem with",
      "everyone is wrong", "secret", "biggest mistake", "wake up",
      "impossible", "guarantee", "insane", "never works", "always fails",
      "the best", "the worst", "the only", "everyone lies",
    ],
    // Type C: Number or stake (concrete specifics)
    numberStake: [
      "million", "billion", "lost", "zero to", "in 11 days", "in one year",
      "without spending", "without funding", "from nothing", "made $", "earned $",
      "lost $", "saved $", "spent $", "grew to", "scaled to", "hit $",
      "days without", "hours in", "years of", "first 30 days",
    ],
    // Type D: Question the viewer wants answered
    question: [
      "why do", "why does", "why would", "what separates", "what happens",
      "how do", "how does", "how is it possible", "what if", "have you ever",
      "do you know", "ever wonder", "the real question", "nobody asks",
      "what's the difference", "why do smart people", "why do most",
    ],
    // Type E: Genuine emotion
    emotion: [
      "honest with you", "never told anyone", "this almost broke me",
      "i've never", "i'm going to be", "i was terrified", "brought me to tears",
      "i cried", "i was angry", "i was furious", "broke me", "changed me forever",
      "i'll never forget", "hardest thing", "most painful", "real frustration",
      "real vulnerability", "not performed", "genuine", "raw",
    ],
    // Legacy combined strong patterns
    strong: [
      "lost", "million", "billion", "never", "nobody", "secret", "truth",
      "changes everything", "here's why", "stop", "most people fail",
      "if you're doing", "this is why", "biggest mistake", "insane",
      "guarantee", "impossible", "you're doing it wrong", "wake up",
      "the problem with", "everyone is lying", "wake up call",
    ],
    weak: [
      "hey everyone", "so today", "welcome back", "what's up",
      "before we start", "hey guys", "hello everyone", "good morning",
      "shout out", "before we get started", "thanks for watching",
    ],
    // NEVER start a clip with these
    neverStart: [
      "hey guys", "hey everyone", "welcome back", "so today", "what's up",
      "before we start", "hello everyone", "good morning", "good afternoon",
      "shout out", "before we get started", "thanks for watching",
      "as i was saying", "like i said earlier", "as we discussed",
      "so basically", "so um", "so yeah", "um yeah", "so like",
      "and um", "but um", "so anyway", "oh and",
      "nod", "laughs", "clears throat", "takes a sip",
    ],
    // NEVER end a clip with these
    neverEnd: [
      "anyway", "so yeah", "you know what i mean", "right?", "get it?",
      "does that make sense", "so basically", "i guess", "i don't know",
      "but yeah", "so there you go", "that's about it", "pretty much",
      "next question", "moving on", "let's talk about", "speaking of",
      "and then", "after that", "the next day", "so what happened",
    ],
    // Payoff endings (Type A-D)
    payoff: {
      // Type A: Clear conclusion or lesson
      conclusion: [
        "and that's the", "that's the only", "that's what", "the lesson is",
        "the takeaway is", "what matters is", "the key is", "the point is",
        "and that's why", "that's exactly", "the thing that", "the only thing",
      ],
      // Type B: Reframe (flips the assumption)
      reframe: [
        "so the thing you", "that's your edge", "that's your advantage",
        "turns out that", "what you think is", "the thing you think",
        "actually", "in reality", "the opposite is true",
        "most people are optimizing for the wrong",
      ],
      // Type C: Mic drop (short punchy finality)
      micDrop: [
        "we shipped it anyway", "he said no", "six months later",
        "they said it was impossible", "we did it", "it worked",
        "biggest product", "called back", "proven wrong",
        "and that's how", "that's the story",
      ],
      // Type D: Earned emotion (peak emotional moment)
      emotion: [
        "i can't believe", "that's when i knew", "everything was worth it",
        "and i cried", "best moment", "proudest moment", "never been happier",
        "changed my life", "forever grateful", "that's the moment",
      ],
    },
  },

  emotionalKeywords: [
    "love", "hate", "fear", "dream", "nightmare", "struggle", "succeed",
    "fail", "win", "fight", "quit", "believe", "doubt", "angry",
    "excited", "passionate", "inspired", "frustrated", "obsessed",
    "genius", "crazy", "insane", "unbelievable", "shocking",
  ],

  shareabilityTopics: [
    "money", "business", "ai", "productivity", "psychology",
    "relationships", "marketing", "success", "growth", "health",
    "investing", "startup", "mindset", "discipline", "wealth",
  ],

  rejectionPatterns: [
    "hey everyone", "welcome back", "what's up guys", "so today we",
    "before we start", "thanks for watching", "don't forget to like",
    "subscribe", "shout out to", "sponsor", "this video is sponsored",
  ],
};

export function computeWeightedViralScore(dimensionScores) {
  if (!dimensionScores || typeof dimensionScores !== "object") return 0;
  let totalWeight = 0;
  let weightedSum = 0;

  for (const dim of VIRAL_SCORING.dimensions) {
    const raw = Number(dimensionScores[dim.key]) || 0;
    const clamped = Math.max(0, Math.min(10, raw));
    weightedSum += clamped * dim.weight;
    totalWeight += 10 * dim.weight;
  }

  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0;
}

export function rejectByQualityRules(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return VIRAL_SCORING.rejectionPatterns.some((p) => lower.startsWith(p) || lower.includes(p));
}

export function scoreOpening(text) {
  if (!text) return { score: 0, type: null, issues: ["empty opening"] };
  const lower = text.toLowerCase().trim();
  const issues = [];
  let score = 0;
  let matchedType = null;

  // Check NEVER START patterns — only if they appear as leading phrases
  for (const pattern of VIRAL_SCORING.hookPatterns.neverStart) {
    // Match as leading phrase: the text starts with the pattern, or the pattern is the first meaningful chunk
    if (lower.startsWith(pattern) || lower.slice(0, pattern.length + 5) === pattern) {
      issues.push(`never-start pattern: "${pattern}"`);
      return { score: 0, type: "never-start", issues };
    }
  }

  // Check each hook type (A-E) — any match boosts score
  const typeChecks = [
    { type: "midAction", patterns: VIRAL_SCORING.hookPatterns.midAction, points: 9 },
    { type: "boldClaim", patterns: VIRAL_SCORING.hookPatterns.boldClaim, points: 8 },
    { type: "numberStake", patterns: VIRAL_SCORING.hookPatterns.numberStake, points: 9 },
    { type: "question", patterns: VIRAL_SCORING.hookPatterns.question, points: 8 },
    { type: "emotion", patterns: VIRAL_SCORING.hookPatterns.emotion, points: 7 },
  ];

  let bestMatch = null;
  for (const check of typeChecks) {
    for (const pattern of check.patterns) {
      if (lower.includes(pattern)) {
        if (!bestMatch || check.points > bestMatch.points) {
          bestMatch = { type: check.type, points: check.points, pattern };
        }
      }
    }
  }

  if (bestMatch) {
    score = bestMatch.points;
    matchedType = bestMatch.type;
  }

  // Bonus: starts with a number (Type C)
  if (/^\d/.test(lower)) {
    score = Math.max(score, 9);
    matchedType = matchedType || "numberStake";
  }

  // Bonus: starts with a question word (Type D)
  if (/^(why|how|what|have you|do you|ever wonder)/.test(lower)) {
    score = Math.max(score, 8);
    matchedType = matchedType || "question";
  }

  // Bonus: short punchy opening (< 8 words is ideal)
  const wordCount = lower.split(/\s+/).length;
  if (wordCount <= 8) {
    score = Math.min(10, score + 1);
  } else if (wordCount > 15) {
    issues.push("opening is long (" + wordCount + " words) — may lose hook impact");
    score = Math.max(1, score - 1);
  }

  return { score: Math.min(10, score), type: matchedType, issues };
}

export function scoreClosing(text) {
  if (!text) return { score: 0, type: null, issues: ["empty closing"] };
  const lower = text.toLowerCase().trim();
  const issues = [];
  let score = 0;
  let matchedType = null;

  // Check NEVER END patterns — only if they appear as trailing phrases (not mid-sentence)
  for (const pattern of VIRAL_SCORING.hookPatterns.neverEnd) {
    // Match as trailing phrase: the text ends with the pattern, or the pattern is the last meaningful chunk
    const trimmedLower = lower.replace(/[.!?;,]+$/, "").trim();
    if (trimmedLower.endsWith(pattern) || trimmedLower === pattern) {
      issues.push(`never-end pattern: "${pattern}"`);
      return { score: 0, type: "never-end", issues };
    }
  }

  // Check each payoff type (A-D)
  const payoffChecks = [
    { type: "conclusion", patterns: VIRAL_SCORING.hookPatterns.payoff.conclusion, points: 9 },
    { type: "reframe", patterns: VIRAL_SCORING.hookPatterns.payoff.reframe, points: 9 },
    { type: "micDrop", patterns: VIRAL_SCORING.hookPatterns.payoff.micDrop, points: 10 },
    { type: "emotion", patterns: VIRAL_SCORING.hookPatterns.payoff.emotion, points: 8 },
  ];

  let bestMatch = null;
  for (const check of payoffChecks) {
    for (const pattern of check.patterns) {
      if (lower.includes(pattern)) {
        if (!bestMatch || check.points > bestMatch.points) {
          bestMatch = { type: check.type, points: check.points, pattern };
        }
      }
    }
  }

  if (bestMatch) {
    score = bestMatch.points;
    matchedType = bestMatch.type;
  }

  // Short punchy closing gets bonus (mic drop style)
  const wordCount = lower.split(/\s+/).length;
  if (wordCount <= 6) {
    score = Math.min(10, score + 1);
  } else if (wordCount > 20) {
    issues.push("closing is long (" + wordCount + " words) — may trail off");
    score = Math.max(1, score - 1);
  }

  // Ends with period or exclamation — signs of a complete thought
  if (/[.!?]\s*$/.test(text.trim())) {
    score = Math.min(10, score + 1);
  }

  return { score: Math.min(10, score), type: matchedType, issues };
}
