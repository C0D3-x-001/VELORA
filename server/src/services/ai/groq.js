export const groqProvider = {
  name: "groq",

  isConfigured() {
    return Boolean(process.env.GROQ_API_KEY);
  },

  async generateText() {
    throw new Error("Groq provider not yet implemented");
  },

  async generateJSON() {
    throw new Error("Groq provider not yet implemented");
  },

  async analyzeFrames() {
    throw new Error("Groq provider not yet implemented");
  },
};
