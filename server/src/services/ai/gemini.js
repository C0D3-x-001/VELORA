import { GoogleGenAI } from "@google/genai";
import config from "../../config/env.js";

let client = null;

function getClient() {
  if (client) return client;
  const apiKey = process.env.GEMINI_API_KEY || config.ai.gemini?.apiKey;
  if (!apiKey) throw new Error("Gemini API key not configured");
  client = new GoogleGenAI({ apiKey });
  return client;
}

export const geminiProvider = {
  name: "gemini",

  isConfigured() {
    return Boolean(process.env.GEMINI_API_KEY || config.ai.gemini?.apiKey);
  },

  async generateText(prompt, { model = "gemini-2.5-flash", maxRetries = 2 } = {}) {
    const ai = getClient();
    let lastErr;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
        });
        return response.text;
      } catch (err) {
        lastErr = err;
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }
    throw lastErr;
  },

  async generateJSON(prompt, { model = "gemini-2.5-flash", schema = null, maxRetries = 2 } = {}) {
    const ai = getClient();
    let lastErr;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const body = {
          model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          },
        };

        if (schema) {
          body.config.responseSchema = schema;
        }

        const response = await ai.models.generateContent(body);
        const text = response.text;

        if (schema) return text;

        try {
          return JSON.parse(text);
        } catch {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) return JSON.parse(jsonMatch[0]);
          throw new Error("No JSON in AI response");
        }
      } catch (err) {
        lastErr = err;
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }
    throw lastErr;
  },

  async analyzeFrames(frames, prompt, { model = "gemini-2.5-flash", maxRetries = 2 } = {}) {
    const ai = getClient();
    let lastErr;

    const parts = [
      { text: prompt },
      ...frames.map((f) => ({
        inlineData: {
          mimeType: "image/jpeg",
          data: f.base64,
        },
      })),
    ];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts }],
          config: {
            responseMimeType: "application/json",
          },
        });
        const text = response.text;
        try {
          return JSON.parse(text);
        } catch {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) return JSON.parse(jsonMatch[0]);
          throw new Error("No JSON in vision response");
        }
      } catch (err) {
        lastErr = err;
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }
    throw lastErr;
  },
};
