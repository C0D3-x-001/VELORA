import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabaseAdmin, isConfigured } from "../config/supabase.js";
import config from "../config/env.js";

import { VIRAL_SCORING, computeWeightedViralScore, scoreOpening, scoreClosing } from "../config/viral-scoring.js";

const nvidia = new OpenAI({
  apiKey: config.ai.apiKey,
  baseURL: config.ai.baseUrl,
});

const geminiAvailable = config.isConfigured("gemini");
let geminiChat = null;
let geminiAI = null;

if (geminiAvailable) {
  geminiChat = new OpenAI({
    apiKey: config.ai.gemini.apiKey,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  });
  geminiAI = new GoogleGenerativeAI(config.ai.gemini.apiKey);
}

class GeminiRateLimiter {
  constructor(maxPerMinute = 4) {
    this.maxPerMinute = maxPerMinute;
    this.timestamps = [];
  }
  async wait() {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < 60000);
    if (this.timestamps.length >= this.maxPerMinute) {
      const waitMs = 60000 - (now - this.timestamps[0]);
      console.log(`[AI] Gemini rate limit — waiting ${Math.round(waitMs / 1000)}s`);
      await new Promise(r => setTimeout(r, waitMs));
    }
    this.timestamps.push(Date.now());
  }
}
const geminiLimiter = new GeminiRateLimiter(4);

function parseJsonFromAI(content) {
  if (!content) throw new Error("No content from AI");
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return JSON.parse(fenceMatch[1].trim());
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in AI response");
  return JSON.parse(jsonMatch[0]);
}

function buildViralAnalysisPrompt(clipDuration, targetMoments, totalDuration) {
  const durationMode = clipDuration != null
    ? `Each moment should be approximately ${clipDuration} seconds (flexible by ±15s to respect natural sentence boundaries).`
    : `You determine the optimal length for EACH clip. Some clips need 20 seconds. Some need 90. Match length to the story. Minimum 15s, maximum 120s.`;

  const startEndMode = clipDuration != null
    ? `- "start": <number, seconds from video start — MUST align with the beginning of a sentence or complete thought>\n- The "end" field is implicit: start + clipDuration`
    : `- "start": <number, seconds from video start — MUST align with the beginning of a sentence or complete thought>\n- "end": <number, seconds — where the story naturally ends, the payoff is complete, and momentum stops>`;

  return `You are not an AI assistant.

You are one of the world's greatest short-form video editors.

Your edits have generated billions of views across TikTok, YouTube Shorts, Instagram Reels and Facebook Reels.

Your only goal is to maximize retention.

Nothing else matters.

You are ruthless.

You reject 99% of possible clips.

Every clip must make viewers stop scrolling and keep watching until the very last second.

Think like a Hollywood trailer editor, not a transcript analyzer.

────────────────────────────

STEP 1

Read the ENTIRE transcript.

Do not immediately begin selecting clips.

First understand:

• What is this conversation about?
• What stories are being told?
• What lessons exist?
• Where are emotional peaks?
• Where are surprising moments?
• Where does tension build?
• Where are viewers most likely to become curious?

Do NOT output anything yet.

────────────────────────────

STEP 2

Split the transcript into COMPLETE STORIES.

A story begins when an idea starts.

A story ends when that idea finishes.

Never split a story in half.

Never merge unrelated stories.

Every candidate clip should represent ONE complete idea.

────────────────────────────

STEP 3

Inside every story identify ALL possible hooks.

Examples include:

Curiosity
Contradiction
Shock
Controversy
Confession
Huge mistake
Unexpected statistic
Secret
Question
Fear
Success
Money
Failure
Authority
Transformation
Pain
Strong opinion
Warning
Prediction

The first spoken words MUST immediately create curiosity.

The first sentence MUST do ONE of the following:

A. Drop into the middle of something — The viewer feels they've caught something already in motion. Creates instant curiosity.
   "...and nobody in that room knew it was already over."
   "...that's when I realized everything I'd been taught was wrong."

B. Make a bold or counterintuitive claim — Directly challenges what the viewer believes or assumes.
   "Most people who work hard never get rich. Here's why."
   "The best founders I all have one thing in common — and it's not hustle."

C. Open with a number or a stake — Concrete specifics create instant credibility and curiosity.
   "I lost $4 million in 11 days."
   "We went from zero to 10 million users without spending a dollar on ads."

D. Ask or imply a question the viewer wants answered — The clip becomes a puzzle the brain needs to solve.
   "Why do smart people keep making the same dumb mistake?"
   "What separates the people who make it from everyone else?"

E. Start with genuine emotion — Real laughter, real frustration, real vulnerability — not performed.
   "I'm going to be honest with you, this almost broke me."
   "I've never told anyone this publicly but..."

NEVER start a clip with:

• Greetings or pleasantries ("Hey guys", "Welcome back", "So today...")
• Context-setting that requires prior knowledge ("As I was saying earlier...")
• Filler words or false starts ("Um, yeah, so like...")
• A nod, laugh, or transition before the actual point begins
• The speaker looking away from camera or mid-sip

If a hook does not match one of these 5 types, it is NOT a strong enough hook. Reject it.

────────────────────────────

STEP 3B

Now evaluate the ENDING of every candidate.

The last sentence MUST deliver a complete payoff. The viewer should feel the clip is finished — not cut off.

The ending must match ONE of the following:

A. The landing — A clear conclusion or lesson stated plainly.
   "And that's the only thing that actually matters."
   "That's what nobody tells you when you start."

B. The reframe — Ends by flipping the viewer's assumption.
   "So the thing you think is your weakness? That's your edge."
   "Most people are optimizing for the wrong thing entirely."

C. The mic drop — A short, punchy final sentence with finality.
   "We shipped it anyway. It became our biggest product."
   "He said no. Six months later he called back."

D. The earned emotion — A genuine emotional beat that lands. The clip ends right after the peak, not after the discussion of it.

NEVER end a clip with:

• "...anyway" / "...so yeah" / "...you know what I mean?"
• The host or interviewer starting their next question
• A transition to a new topic
• Trailing off mid-thought
• Applause or crowd noise that wasn't part of the moment
• More than 1 second of silence or nodding after the point lands

If the ending does not deliver a complete payoff, the clip MUST be rejected or the end must be moved.

CRITICAL: After evaluating the ending, set "endsOnResolution" to true ONLY if the clip ends on a complete payoff (one of the 4 types above). Set it to false if:
- The clip ends mid-story or mid-argument
- The last sentence is a question without an answer in the clip
- The last sentence is a setup ("and that's when...", "but then...") without a payoff
- The clip trails off or transitions to a new topic
- The final thought feels incomplete or hanging

Do NOT mark endsOnResolution as true just because the clip has a hook — it must have a RESOLUTION. An unanswered question or unfinished story = false.

────────────────────────────

STEP 4

For every hook expand outward.

Move backwards until the sentence naturally begins.

Move forwards until the payoff naturally ends.

Never end before the answer.

Never start halfway through a thought.

The viewer should never feel confused.

The viewer should never feel cheated.

Verify the opening matches one of the 5 hook types (A-E from STEP 3). If it does not, find a better start point.

Verify the closing matches one of the 4 payoff types (A-D from STEP 3B). If it does not, find a better end point.

────────────────────────────

STEP 5

For every candidate answer these questions.

Would I stop scrolling?

Would I keep watching?

Would I finish it?

Would I send it to a friend?

Would I comment?

Would I save it?

Would I replay it?

If NO to any important question, reject the clip.

────────────────────────────

STEP 6

Find the OPEN LOOP.

What unanswered question keeps viewers watching?

Where is curiosity created?

When is curiosity resolved?

Reject clips that answer everything immediately.

Reject clips that never answer.

The payoff must feel satisfying.

────────────────────────────

STEP 7

Rate every candidate.

Hook
Curiosity
Retention
Emotion
Story
Novelty
Authority
Shareability
Replay value
Comment potential
Educational value
Entertainment
Confidence
Transformation
Surprise
Payoff
Clarity
Energy
Originality
Overall Viral Potential

Score honestly.

Be extremely harsh.

Very few clips deserve 90+.

────────────────────────────

STEP 8

Compare candidates AGAINST EACH OTHER.

Do NOT score independently.

Ask:

"If these appeared back-to-back on TikTok, which one wins?"

Remove weaker duplicates.

Keep only the strongest version.

────────────────────────────

STEP 9

Optimize timing.

Move the start earlier if it improves context.

Move the end later if payoff needs completion.

Remove dead air.

Remove repeated ideas.

Remove unnecessary setup.

Keep momentum high.

────────────────────────────

STEP 10

Final Quality Gate.

Reject any clip if:

• hook is weak
• payoff is weak
• story feels incomplete
• begins mid sentence
• ends too early
• has dead air
• contains unnecessary filler
• requires previous context
• emotional intensity is low
• energy collapses
• no clear takeaway
• viewers are unlikely to share
• opening does NOT match one of the 5 strong hook types (mid-action, bold claim, number/stake, question, genuine emotion)
• opening matches any NEVER-START pattern (greetings, context-setting, filler, transitions)
• closing does NOT match one of the 4 payoff types (conclusion, reframe, mic drop, earned emotion)
• closing matches any NEVER-END pattern (anyway, so yeah, trailing off, next question, transition)

For each clip, explicitly state which hook type (A-E) the opening uses and which payoff type (A-D) the closing uses.

If you cannot classify the opening or closing into one of these types, the clip is not strong enough. Reject it.

Only output elite clips.

If fewer than the requested number meet this standard, return fewer clips.

Quality is ALWAYS more important than quantity.

────────────────────────────

OUTPUT

Return valid JSON only.

Do not explain reasoning outside JSON.

The transcript includes timestamps at segment boundaries. USE THEM to align starts and ends with natural sentence boundaries.

Return up to ${targetMoments} moments (fewer is fine if quality is lacking).

${durationMode}

Moments must NOT overlap — leave at least 3 seconds between them.

Sort moments by overallScore (highest first).

Each clip must include:

{
  "moments": [
    {
      ${startEndMode},
      "title": <string, catchy 5-8 word title for the clip>,
      "hookPhrase": <string, EXACT first 3-8 words that form the hook>,
      "hookType": <string, e.g. "curiosity" | "shock" | "contradiction" | "story" | "question" | "bold_claim" | "emotion" | "contrary_opinion" | "confession" | "money" | "fear" | "prediction">,
      "startType": <string, one of "midAction" | "boldClaim" | "numberStake" | "question" | "emotion">,
      "endType": <string, one of "conclusion" | "reframe" | "micDrop" | "emotion">,
      "endsOnResolution": <boolean, true ONLY if the clip ends on a completed thought with a clear payoff; false if it ends on a cliffhanger, rhetorical question, setup line, or open hook>,
      "reason": <string, 1-sentence why this goes viral>,
      "overallScore": <number 0-100, be harsh, very few deserve 90+>,
      "hookScore": <number 0-10, MUST be >= 8>,
      "retentionScore": <number 0-10>,
      "emotionScore": <number 0-10>,
      "storyScore": <number 0-10>,
      "shareabilityScore": <number 0-10>,
      "viralPrediction": <string, "extremely viral" | "very viral" | "viral" | "good" | "moderate">,
      "predictedRetention": <string, e.g. "85%+" | "70-85%" | "50-70%">,
      "predictedComments": <string, e.g. "high" | "medium" | "low">,
      "predictedShares": <string, e.g. "very high" | "high" | "medium">,
      "predictedSaves": <string, e.g. "very high" | "high" | "medium">,
      "predictedReplayRate": <string, e.g. "very high" | "high" | "medium">,
      "strengths": [<string>, ...],
      "weaknesses": [<string>, ...]
    }
  ],
  "summary": <string, one-sentence video summary>,
  "topics": [<string>, ...],
  "bestHookMoment": <number, index of the moment with the strongest hook>,
  "overallViralPotential": <string, "high" | "medium" | "low">
}`;
}

function validateMoments(moments, totalDuration, clipDuration) {
  if (!Array.isArray(moments)) return [];
  const durationSec = Number(totalDuration) || 60;

  const validated = moments
    .filter((m) => {
      let start = Number(m.start);
      if (!Number.isFinite(start)) return false;

      if (clipDuration != null) {
        const clipDur = Number(clipDuration) || 60;
        const maxStart = Math.max(0, durationSec - clipDur);
        start = Math.max(0, Math.min(start, maxStart));
        m.start = Math.round(start);
        m.end = Math.round(start + clipDur);
      } else {
        let end = Number(m.end);
        if (!Number.isFinite(end) || end <= start) {
          end = Math.min(start + 120, durationSec);
        }
        m.start = Math.round(Math.max(0, start));
        m.end = Math.round(Math.min(end, durationSec));
      }

      const clipLen = m.end - m.start;
      if (clipLen < 15 || clipLen > 120) return false;

      const hookScore = Number(m.hookScore) || 0;
      if (hookScore < 8) return false;

      const overallScore = Math.max(0, Math.min(100, Math.round(Number(m.overallScore) || 0)));
      m.overallScore = overallScore;
      if (overallScore < VIRAL_SCORING.minimumViralScore) return false;

      // Validate startType is one of the 5 valid hook types
      const validStartTypes = ["midAction", "boldClaim", "numberStake", "question", "emotion"];
      if (m.startType && !validStartTypes.includes(m.startType)) {
        console.warn(`[Viral] Rejecting clip "${m.title}" — invalid startType "${m.startType}"`);
        return false;
      }

      // Validate endType is one of the 4 valid payoff types
      const validEndTypes = ["conclusion", "reframe", "micDrop", "emotion"];
      if (m.endType && !validEndTypes.includes(m.endType)) {
        console.warn(`[Viral] Rejecting clip "${m.title}" — invalid endType "${m.endType}"`);
        return false;
      }

      // Log hook/payoff classification for debugging
      if (m.startType || m.endType) {
        console.log(`[Viral] Clip "${m.title}": open=${m.startType || "unclassified"} close=${m.endType || "unclassified"} hook="${m.hookPhrase || "?"}"`);
      }

      // Check endsOnResolution — discard in fixed mode, flag for AI-optimized mode
      if (m.endsOnResolution === false) {
        if (clipDuration != null) {
          // Fixed mode: discard — the clip duration is locked, can't chase a resolution
          console.warn(`[Resolution] Discarding "${m.title}" (${m.start}s) — ends on unresolved hook (fixed mode, dur=${clipDuration}s)`);
          return false;
        }
        // AI-optimized mode: keep but flag — project.js will try to find a resolving end point
        m._needsResolutionFix = true;
        console.log(`[Resolution] Flagging "${m.title}" (${m.start}-${m.end}s) — ends on unresolved hook (AI-optimized, will seek resolving endpoint)`);
      }

      return true;
    })
    .sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0));

  return validated.slice(0, VIRAL_SCORING.maxMoments);
}

export const aiService = {
  async analyze(transcript, totalDuration, clipDuration, segments = []) {
    if (!isConfigured || !config.isConfigured("ai")) {
      console.log("[AI] Analysis: using mock (AI not configured)");
      return { ...mockAnalysis(), provider: "mock" };
    }

    const durationSec = Number(totalDuration) || 60;
    const clipDur = clipDuration != null ? Number(clipDuration) : null;
    const targetMoments = durationSec < 120 ? 5 : durationSec < 600 ? 8 : 12;
    const systemPrompt = buildViralAnalysisPrompt(clipDur, targetMoments, durationSec);
    const timeoutMs = 120000;

    let enrichedTranscript = transcript;
    if (segments && segments.length > 0) {
      const { formatTranscriptWithTimestamps } = await import("./clip-boundary.js");
      enrichedTranscript = formatTranscriptWithTimestamps(transcript, segments);
    }

    const maxTranscriptChars = 25000;
    if (enrichedTranscript.length > maxTranscriptChars) {
      console.log(`[AI] Transcript truncated from ${enrichedTranscript.length} to ${maxTranscriptChars} chars for AI analysis`);
      enrichedTranscript = enrichedTranscript.slice(0, maxTranscriptChars) + "\n[...truncated — analysis based on first portion of transcript]";
    }
    console.log(`[AI] Analyzing transcript: ${enrichedTranscript.length} chars, duration=${Math.round(durationSec)}s, target=${targetMoments} moments`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const startTime = Date.now();
      const response = await nvidia.chat.completions.create({
        model: config.ai.analysisModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Full transcript (${Math.round(durationSec)}s) — timestamps shown as [MM:SS] at segment boundaries:\n${enrichedTranscript}` },
        ],
      }, { signal: controller.signal });
      clearTimeout(timeoutId);

      const content = response.choices?.[0]?.message?.content;
      const parsed = parseJsonFromAI(content);
      const allMoments = parsed.moments || [];
      parsed.moments = validateMoments(allMoments, durationSec, clipDur);

      if (parsed.moments.length === 0 && allMoments.length > 0) {
        console.warn("[AI] All moments rejected by viral scoring — relaxing threshold");
        parsed.moments = allMoments
          .filter((m) => {
            let start = Number(m.start);
            if (!Number.isFinite(start)) return false;
            const maxStart = Math.max(0, durationSec - (clipDur || 120));
            start = Math.max(0, Math.min(start, maxStart));
            m.start = Math.round(start);
            m.end = Math.round(clipDur ? start + clipDur : (Number(m.end) || start + 60));
            m.overallScore = Math.max(0, Math.min(100, Math.round(Number(m.overallScore) || Number(m.score) || 0)));
            return true;
          })
          .sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0))
          .slice(0, targetMoments);
      }

      const totalRejected = (parsed.moments?.length || 0);
      console.log(`[AI] Analysis done via NVIDIA in ${((Date.now() - startTime) / 1000).toFixed(1)}s — ${totalRejected} viral moments (sorted by score)`);
      return { ...parsed, provider: "nvidia" };
    } catch (err) {
      if (err?.name === "AbortError") {
        console.error(`[AI] NVIDIA analysis timed out after ${timeoutMs / 1000}s`);
      } else {
        console.error("[AI] NVIDIA analysis error:", err.message);
      }

      if (geminiAvailable) {
        for (let gemAttempt = 1; gemAttempt <= 2; gemAttempt++) {
          try {
            if (gemAttempt > 1) {
              const backoffMs = 15000 * gemAttempt;
              console.log(`[AI] Gemini retry ${gemAttempt}/2 after ${backoffMs / 1000}s backoff...`);
              await new Promise((r) => setTimeout(r, backoffMs));
            }
            await geminiLimiter.wait();
            const controller2 = new AbortController();
            const timeoutId2 = setTimeout(() => controller2.abort(), timeoutMs);
            const startTime2 = Date.now();
            try {
              const result = await this._analyzeGemini(enrichedTranscript, systemPrompt, controller2.signal, durationSec, clipDur);
              clearTimeout(timeoutId2);
              console.log(`[AI] Analysis done via Gemini in ${((Date.now() - startTime2) / 1000).toFixed(1)}s — ${result.moments.length} viral moments`);
              return { ...result, provider: "gemini" };
            } finally {
              clearTimeout(timeoutId2);
            }
          } catch (gemErr) {
            const is429 = gemErr?.status === 429 || gemErr?.message?.includes("429");
            console.error(`[AI] Gemini analysis error (attempt ${gemAttempt}/2):`, gemErr.message);
            if (!is429) break;
          }
        }
      }

      console.warn("[AI] Analysis: using mock (all providers failed)");
      return { ...mockAnalysis(), provider: "mock" };
    }
  },

  async _analyzeGemini(transcript, systemPrompt, signal, totalDuration, clipDuration) {
    const response = await geminiChat.chat.completions.create({
      model: "gemini-2.0-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Full transcript (${Math.round(totalDuration || 60)}s) — timestamps shown as [MM:SS] at segment boundaries:\n${transcript}` },
      ],
    }, signal ? { signal } : {});

    const content = response.choices?.[0]?.message?.content;
    const parsed = parseJsonFromAI(content);
    parsed.moments = validateMoments(parsed.moments || [], totalDuration || 60, clipDuration);
    return parsed;
  },

  async generateMetadata(clipTranscript, viralScore) {
    if (!isConfigured || !config.isConfigured("ai")) {
      return mockMetadata(viralScore);
    }

    const truncated = (clipTranscript || "").slice(0, 4000);
    const systemPrompt = "Generate title, caption, and hashtags for a short-form video clip. Return JSON with: { \"title\": string, \"caption\": string, \"hashtags\": [string] }";
    const userContent = `Transcript: ${truncated}\nViral Score: ${viralScore}`;
    const timeoutMs = 30000;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const startTime = Date.now();
      const response = await nvidia.chat.completions.create({
        model: config.ai.metadataModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }, { signal: controller.signal });
      clearTimeout(timeoutId);

      const content = response.choices?.[0]?.message?.content;
      if (!content) throw new Error("No response from AI");
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in response");
      console.log(`[AI] Metadata done in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
      return JSON.parse(jsonMatch[0]);
    } catch (err) {
      if (err?.name === "AbortError") {
        console.error(`[AI] NVIDIA metadata timed out after ${timeoutMs / 1000}s`);
      } else {
        console.error("[AI] NVIDIA metadata error:", err.message);
      }

      if (geminiAvailable) {
        try {
          await geminiLimiter.wait();
          return await this._metadataGemini(systemPrompt, userContent);
        } catch (gemErr) {
          console.error("[AI] Gemini metadata error:", gemErr.message);
        }
      }

      return mockMetadata(viralScore);
    }
  },

  async generateAllMetadata(clipsData) {
    if (!isConfigured || !config.isConfigured("ai") || clipsData.length === 0) {
      return clipsData.map((c) => mockMetadata(c.viralScore));
    }

    const clipsBlock = clipsData.map((c, i) =>
      `Clip ${i + 1} (score: ${c.viralScore}):\n${(c.transcript || "No transcript available.").slice(0, 2000)}`
    ).join("\n\n");

    const systemPrompt = `You are generating social media metadata for short-form video clips. Return a JSON array with exactly ${clipsData.length} objects, one per clip in order. Each object: { "title": string, "caption": string, "hashtags": string[] }. Make titles catchy and viral. Captions should be engaging one-liners. Hashtags should be 3-5 relevant tags with #.`;
    const userContent = clipsBlock;
    const timeoutMs = 60000;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const startTime = Date.now();
      const response = await nvidia.chat.completions.create({
        model: config.ai.metadataModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }, { signal: controller.signal });
      clearTimeout(timeoutId);

      const content = response.choices?.[0]?.message?.content;
      if (!content) throw new Error("No response from AI");
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("No JSON array in batch metadata response");
      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed) || parsed.length < clipsData.length) {
        throw new Error(`Expected ${clipsData.length} items, got ${parsed.length}`);
      }
      console.log(`[AI] Batch metadata done in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
      return parsed;
    } catch (err) {
      if (err?.name === "AbortError") {
        console.error(`[AI] NVIDIA batch metadata timed out after ${timeoutMs / 1000}s`);
      } else {
        console.error("[AI] NVIDIA batch metadata error:", err.message);
      }

      if (geminiAvailable) {
        for (let gemRetry = 0; gemRetry < 2; gemRetry++) {
          try {
            if (gemRetry > 0) {
              console.log(`[AI] Gemini batch metadata retry ${gemRetry}...`);
              await new Promise(r => setTimeout(r, 3000 * gemRetry));
            }
            await geminiLimiter.wait();
            const controller2 = new AbortController();
            const timeoutId2 = setTimeout(() => controller2.abort(), timeoutMs);
            try {
              const response = await geminiChat.chat.completions.create({
                model: "gemini-2.0-flash",
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: userContent },
                ],
              }, { signal: controller2.signal });
              clearTimeout(timeoutId2);
              const content = response.choices?.[0]?.message?.content;
              if (!content) throw new Error("No response from Gemini");
              const jsonMatch = content.match(/\[[\s\S]*\]/);
              if (!jsonMatch) throw new Error("No JSON array in Gemini batch metadata");
              const parsed = JSON.parse(jsonMatch[0]);
              if (Array.isArray(parsed) && parsed.length >= clipsData.length) {
                return parsed;
              }
            } finally {
              clearTimeout(timeoutId2);
            }
          } catch (gemErr) {
            if (gemErr?.name === "AbortError") {
              console.error(`[AI] Gemini batch metadata timed out after ${timeoutMs / 1000}s`);
            } else {
              console.error(`[AI] Gemini batch metadata error (attempt ${gemRetry + 1}): ${gemErr.message}`);
            }
          }
        }
      }

      return clipsData.map((c) => mockMetadata(c.viralScore));
    }
  },

  async _metadataGemini(systemPrompt, userContent) {
    const response = await geminiChat.chat.completions.create({
      model: "gemini-2.0-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    });

    const content = response.choices?.[0]?.message?.content;
    return parseJsonFromAI(content);
  },

  async analyzeTranscriptEmphasis(segments) {
    if (!isConfigured || !config.isConfigured("ai")) {
      return mockEmphasis(segments);
    }

    const truncatedSegments = segments.length > 200 ? segments.slice(0, 200) : segments;
    const textBlock = truncatedSegments.map((s, i) => `[${i}] ${s.text}`).join("\n");
    if (segments.length > 200) {
      console.log(`[AI] Emphasis analysis: truncated segments from ${segments.length} to 200`);
    }
    const systemPrompt = `You are a viral video caption analyst. For each transcript segment, identify the 1-3 most important words or short phrases that should receive visual emphasis in pop-up captions.

Return JSON: { "emphasis": { "<segmentIndex>": [{ "word": "string", "level": 1|2|3, "type": "hook|punchline|emotion|statement|question" }] } }

Level meanings:
- 1 = slightly emphasized (bold, larger)
- 2 = emphasized (bigger scale, color accent)
- 3 = MAXIMUM emphasis (biggest scale, animation burst)

Only include words that truly deserve emphasis. Not every segment needs emphasis. Prefer:
- Strong verbs and adjectives
- Numbers and statistics
- Emotional words
- Questions
- Hook phrases ("the truth is", "nobody tells you", etc.)

Be selective. Quality over quantity.`;

    const timeoutMs = 60000;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const startTime = Date.now();
      const response = await nvidia.chat.completions.create({
        model: config.ai.analysisModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: textBlock },
        ],
      }, { signal: controller.signal });
      clearTimeout(timeoutId);

      const content = response.choices?.[0]?.message?.content;
      if (!content) throw new Error("No response from AI");
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in emphasis response");
      const parsed = JSON.parse(jsonMatch[0]);
      console.log(`[AI] Emphasis analysis done in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
      return parsed.emphasis || {};
    } catch (err) {
      console.error("[AI] Emphasis analysis error:", err.message);
      return mockEmphasis(segments);
    }
  },
};

function mockEmphasis(segments) {
  const emphasisMap = {};
  const importantWords = [
    "mistake", "truth", "nobody", "never", "always", "secret", "million",
    "billion", "stop", "start", "impossible", "guarantee", "insane", "crazy",
    "huge", "massive", "tiny", "fast", "slow", "free", "expensive", "cheap",
    "love", "hate", "fear", "dream", "nightmare", "struggle", "succeed",
    "fail", "win", "lose", "fight", "quit", "believe", "doubt",
  ];

  segments.forEach((seg, i) => {
    const words = seg.text.split(/\s+/);
    const found = [];
    words.forEach((w) => {
      const clean = w.toLowerCase().replace(/[^a-z]/g, "");
      if (importantWords.includes(clean)) {
        found.push({ word: w, level: clean === "nobody" || clean === "impossible" ? 3 : 2, type: "statement" });
      }
    });
    if (found.length > 0) emphasisMap[i] = found.slice(0, 2);
  });

  return emphasisMap;
}

function mockAnalysis() {
  return {
    moments: [
      {
        start: 0, end: 60,
        title: "The AI Mistake Nobody Sees",
        hookPhrase: "The biggest mistake people make with AI",
        hookType: "contradiction",
        reason: "Strong hook about AI mistakes — immediately challenges common belief",
        overallScore: 92,
        hookScore: 9,
        retentionScore: 8,
        emotionScore: 7,
        storyScore: 7,
        shareabilityScore: 9,
        viralPrediction: "extremely viral",
        predictedRetention: "85%+",
        predictedComments: "high",
        predictedShares: "very high",
        predictedSaves: "high",
        predictedReplayRate: "high",
        strengths: ["Immediate hook", "Controversial take", "Practical value"],
        weaknesses: ["Could use tighter pacing"],
      },
      {
        start: 60, end: 120,
        title: "Customer Pain Points Truth",
        hookPhrase: "They think they need the latest model",
        hookType: "bold_claim",
        reason: "Actionable advice on customer focus — clear takeaway",
        overallScore: 85,
        hookScore: 8,
        retentionScore: 7,
        emotionScore: 6,
        storyScore: 8,
        shareabilityScore: 8,
        viralPrediction: "very viral",
        predictedRetention: "70-85%",
        predictedComments: "medium",
        predictedShares: "high",
        predictedSaves: "high",
        predictedReplayRate: "medium",
        strengths: ["Clear lesson", "Relatable problem", "Good story structure"],
        weaknesses: ["Slightly slower opening"],
      },
    ],
    summary: "Video discusses common AI mistakes and customer-centric approach",
    topics: ["AI", "Business", "Strategy"],
    bestHookMoment: 0,
    overallViralPotential: "high",
  };
}

function mockMetadata(_score) {
  return {
    title: "The $1M AI Mistake Nobody Talks About",
    caption: "Stop chasing the latest AI models. Focus on solving real problems instead.",
    hashtags: ["#AI", "#Business", "#Entrepreneurship", "#Shorts"],
  };
}
