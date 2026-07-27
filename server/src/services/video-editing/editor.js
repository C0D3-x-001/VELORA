import { getAIProvider } from "../ai/index.js";
import { buildEditingPrompt } from "../../prompts/editingDirector.js";

export async function getEditingInstructions(analysis, settings = {}) {
  const provider = getAIProvider();
  const prompt = buildEditingPrompt(analysis, settings);

  const result = await provider.generateJSON(prompt, {
    model: "gemini-2.5-flash",
    maxRetries: 2,
  });

  const parsed = typeof result === "string" ? JSON.parse(result) : result;

  return validateInstructions(parsed, analysis.duration);
}

function validateInstructions(instructions, duration) {
  const validated = {
    qualityScore: clamp(Number(instructions.qualityScore) || 50, 0, 100),
    hookTimestamp: clamp(Number(instructions.hookTimestamp) || 0, 0, duration),
    viralSuggestions: Array.isArray(instructions.viralSuggestions) ? instructions.viralSuggestions.slice(0, 5) : [],
    cuts: [],
    zooms: [],
    captions: [],
    effects: [],
    transitions: [],
    audio: [],
    color_correction: {
      brightness: clamp(Number(instructions.color_correction?.brightness) || 1.0, 0.8, 1.2),
      contrast: clamp(Number(instructions.color_correction?.contrast) || 1.0, 0.8, 1.3),
      saturation: clamp(Number(instructions.color_correction?.saturation) || 1.0, 0.8, 1.3),
    },
  };

  if (Array.isArray(instructions.cuts)) {
    validated.cuts = instructions.cuts
      .filter((c) => c.start >= 0 && c.end <= duration && c.end > c.start)
      .map((c) => ({
        start: round(c.start),
        end: round(c.end),
        reason: String(c.reason || "edit"),
      }));
  }

  if (Array.isArray(instructions.zooms)) {
    validated.zooms = instructions.zooms
      .filter((z) => z.time >= 0 && z.time <= duration)
      .map((z) => ({
        time: round(z.time),
        scale: clamp(Number(z.scale) || 1.1, 1.0, 1.3),
        duration: clamp(Number(z.duration) || 0.5, 0.1, 3.0),
        reason: String(z.reason || "emphasis"),
      }));
  }

  if (Array.isArray(instructions.captions)) {
    validated.captions = instructions.captions
      .filter((c) => c.start >= 0 && c.end <= duration && c.end > c.start && c.text?.trim())
      .map((c) => ({
        text: String(c.text).trim(),
        start: round(c.start),
        end: round(c.end),
        emphasis: clamp(Number(c.emphasis) || 0, 0, 3),
        color: ["white", "yellow", "cyan", "pink", "none"].includes(c.color) ? c.color : "white",
      }));
  }

  if (Array.isArray(instructions.effects)) {
    validated.effects = instructions.effects
      .filter((e) => e.type && e.time >= 0 && e.time <= duration)
      .map((e) => ({
        type: String(e.type),
        time: round(e.time),
        duration: round(Number(e.duration) || 0.5),
        params: e.params || {},
      }));
  }

  if (Array.isArray(instructions.transitions)) {
    validated.transitions = instructions.transitions
      .filter((t) => t.time >= 0 && t.time <= duration)
      .map((t) => ({
        type: ["crossfade", "none"].includes(t.type) ? t.type : "none",
        time: round(t.time),
        duration: clamp(Number(t.duration) || 0.3, 0.1, 1.0),
      }));
  }

  if (Array.isArray(instructions.audio)) {
    validated.audio = instructions.audio
      .filter((a) => a.type)
      .map((a) => ({
        type: String(a.type),
        params: a.params || {},
      }));
  }

  return validated;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function round(val) {
  return Math.round(val * 1000) / 1000;
}
