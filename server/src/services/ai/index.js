import { geminiProvider } from "./gemini.js";

const providers = {
  gemini: geminiProvider,
};

let activeProvider = null;

export function getAIProvider() {
  if (activeProvider) return activeProvider;

  const name = process.env.AI_PROVIDER || "gemini";
  const provider = providers[name];

  if (!provider) {
    throw new Error(`Unknown AI provider: "${name}". Available: ${Object.keys(providers).join(", ")}`);
  }

  if (!provider.isConfigured()) {
    throw new Error(`AI provider "${name}" is not configured. Check your API key environment variables.`);
  }

  activeProvider = provider;
  return activeProvider;
}

export function resetProvider() {
  activeProvider = null;
}
