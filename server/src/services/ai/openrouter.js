export const openrouterProvider = {
  name: "openrouter",

  isConfigured() {
    return Boolean(process.env.OPENROUTER_API_KEY);
  },

  async generateText() {
    throw new Error("OpenRouter provider not yet implemented");
  },

  async generateJSON() {
    throw new Error("OpenRouter provider not yet implemented");
  },

  async analyzeFrames() {
    throw new Error("OpenRouter provider not yet implemented");
  },
};
