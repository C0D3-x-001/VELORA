export function buildEditingPrompt(analysis, settings = {}) {
  const { duration, platform = "tiktok" } = settings;

  const transcriptText = analysis.transcript?.segments
    ?.map((s) => `[${s.start.toFixed(1)}s-${s.end.toFixed(1)}s] ${s.text}`)
    .join("\n") || "No transcript available.";

  const sceneText = analysis.scenes
    ?.map((s, i) => `Scene ${i + 1}: ${s.start.toFixed(1)}s-${s.end.toFixed(1)}s (${s.duration.toFixed(1)}s)`)
    .join("\n") || "No scene data.";

  const motionText = analysis.motion
    ? `Average motion: ${analysis.motion.avg_motion?.toFixed(2) || "N/A"}, Stability: ${analysis.motion.stability?.toFixed(1) || "N/A"}%`
    : "No motion data.";

  const facesText = analysis.faces
    ?.map((f) => `${f.timestamp.toFixed(1)}s: ${f.faces?.length || 0} face(s), framing score ${f.framing_score || "N/A"}`)
    .join("\n") || "No face data.";

  const wordTimestampsText = analysis.transcript?.segments
    ?.flatMap((s) =>
      (s.words || []).map((w) => `  "${w.word}" @ ${w.start.toFixed(2)}s-${w.end.toFixed(2)}s`)
    )
    .join("\n") || "No word timestamps.";

  return `You are an expert video editing director specializing in viral short-form content for ${platform.toUpperCase()}.

Your job: analyze the video metadata below and return a precise JSON editing plan. Every edit must be actionable and time-accurate.

## INPUT DATA

### Transcript (${duration}s clip)
${transcriptText}

### Word-Level Timestamps
${wordTimestampsText}

### Scene Changes
${sceneText}

### Motion Analysis
${motionText}

### Face Detection
${facesText}

## EDITING RULES

1. **Hook**: The first 1-2 seconds must grab attention. If the video starts with silence or low-energy, recommend a punch-in zoom or cut to the first interesting moment.

2. **Dead Space**: Remove silences longer than 0.5s that aren't dramatic pauses. Flag them in "cuts" with the time ranges to remove.

3. **Zooms**: Add subtle zoom-ins (1.08x-1.2x) on emphasized words, questions, or emotional peaks. Zooms should last 0.3-1.0s. Never zoom on static/silent moments.

4. **Captions**: Generate word-grouped captions (3-4 words per group). Use these styles:
   - Normal words: white text, bold
   - Emphasized words (level 2-3): larger text, colored (yellow for hooks, cyan for punchlines, pink for emotions)
   - Questions: add "?" and use rising animation style

5. **Pacing**: Speed up boring parts (1.05x-1.15x), keep emotional moments at 1.0x. Never speed up above 1.2x.

6. **Color**: Boost saturation slightly (+10-15%) for visual appeal. Increase contrast on talking-head shots.

7. **Audio**: Normalize loudness. Remove background noise during speech pauses.

8. **Transitions**: Use cross-dissolve (0.3s) only between scene changes. No transitions within a scene.

## OUTPUT FORMAT

Return ONLY valid JSON matching this exact structure:

{
  "qualityScore": <number 0-100, overall engagement potential>,
  "hookTimestamp": <number, seconds, best hook point>,
  "viralSuggestions": ["<suggestion1>", "<suggestion2>"],
  "cuts": [
    { "start": <seconds>, "end": <seconds>, "reason": "<why>" }
  ],
  "zooms": [
    { "time": <seconds>, "scale": <1.0-1.3>, "duration": <seconds>, "reason": "<why>" }
  ],
  "captions": [
    {
      "text": "<3-4 words>",
      "start": <seconds>,
      "end": <seconds>,
      "emphasis": <0-3>,
      "color": "white|yellow|cyan|pink|none"
    }
  ],
  "effects": [
    { "type": "speed_change|color_correction|stabilization", "time": <seconds>, "duration": <seconds>, "params": {} }
  ],
  "transitions": [
    { "type": "crossfade|none", "time": <seconds>, "duration": <seconds> }
  ],
  "audio": [
    { "type": "normalize|silence_remove|volume_change", "params": {} }
  ],
  "color_correction": {
    "brightness": <0.8-1.2, default 1.0>,
    "contrast": <0.8-1.3, default 1.0>,
    "saturation": <0.8-1.3, default 1.0>
  }
}

## CRITICAL RULES

- All timestamps must be within 0 to ${duration} seconds.
- "cuts" are segments to REMOVE (dead space), not segments to keep.
- "zooms" are zoom-in effects applied at specific timestamps.
- "captions" must cover ALL spoken words — group them in 3-4 word chunks.
- "captions" start/end times must match the word timestamps from the transcript.
- "emphasis" levels: 0 = normal, 1 = slightly larger, 2 = larger + colored, 3 = biggest + colored + uppercase.
- Return ONLY the JSON object. No explanation text, no markdown, no code fences.`;
}

export function buildVisionAnalysisPrompt(clipDuration) {
  return `Analyze these video frames sampled at 1-second intervals from a ${clipDuration}s clip.

For each frame, determine:
1. How many faces are visible
2. Face position (left/center/right, top/center/bottom)
3. Framing quality (1-10): Is the subject well-positioned? Too much headroom? Cut off?
4. Suggested crop region to center the subject better

Return ONLY valid JSON:
{
  "frames": [
    {
      "timestamp": <seconds>,
      "faces": [
        {
          "position": "left|center|right",
          "vertical": "top|center|bottom",
          "size": "small|medium|large",
          "confidence": <0.0-1.0>
        }
      ],
      "framing_score": <1-10>,
      "suggested_crop": { "x": <0-1>, "y": <0-1>, "width": <0-1>, "height": <0-1> } or null
    }
  ],
  "overall_framing_score": <1-10>,
  "best_face_frame": <timestamp of best-framed face>
}`;
}
