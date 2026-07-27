import dotenv from "dotenv";
import ffmpegPath from "ffmpeg-static";
dotenv.config();

function get(key, defaultValue) {
  const val = process.env[key];
  if (!val || val.startsWith("your_") || val.includes("placeholder")) return defaultValue;
  return val;
}

const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "5000", 10),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",

  clerk: {
    secretKey: get("CLERK_SECRET_KEY"),
    publishableKey: get("VITE_CLERK_PUBLISHABLE_KEY"),
    webhookSecret: get("CLERK_WEBHOOK_SECRET"),
  },

  supabase: {
    url: get("SUPABASE_URL"),
    anonKey: get("SUPABASE_ANON_KEY"),
    serviceRoleKey: get("SUPABASE_SERVICE_ROLE_KEY"),
  },

  stripe: {
    secretKey: get("STRIPE_SECRET_KEY"),
    webhookSecret: get("STRIPE_WEBHOOK_SECRET"),
    creatorPriceId: get("STRIPE_PRICE_CREATOR_MONTHLY"),
    creditPackPrices: {
      starter: get("STRIPE_STARTER_PRICE_ID"),
      creator: get("STRIPE_CREATOR_PACK_PRICE_ID"),
      pro: get("STRIPE_PRO_PRICE_ID"),
    },
  },

  redis: {
    url: get("REDIS_URL"),
  },

  ai: {
    provider: "nvidia",
    baseUrl: get("AI_API_BASE_URL", "https://integrate.api.nvidia.com/v1"),
    apiKey: get("AI_API_KEY"),
    analysisModel: "meta/llama-3.3-70b-instruct",
    metadataModel: "meta/llama-3.3-70b-instruct",
    gemini: {
      apiKey: get("GEMINI_API_KEY"),
    },
    editing: {
      enabled: get("AI_EDITING_ENABLED", "true") !== "false",
      creditCost: parseInt(get("AI_EDITING_CREDIT_COST", "15"), 10),
      whisperModel: get("WHISPER_MODEL", "base.en"),
    },
  },

  video: {
    ffmpegPath: get("FFMPEG_PATH") || ffmpegPath,
    ytdlpPath: get("YTDLP_PATH", "yt-dlp"),
    maxDurationSeconds: 10800,
    maxFileSizeBytes: 10 * 1024 * 1024 * 1024,
    outputWidth: 1080,
    outputHeight: 1920,
  },

  credits: {
    clip30s: 10,
    clip60s: 15,
    clip90s: 25,
    welcomeBonus: 50,
  },

  isConfigured: (service) => {
    const checks = {
      clerk: () => Boolean(config.clerk.secretKey),
      supabase: () => Boolean(config.supabase.url && config.supabase.serviceRoleKey),
      stripe: () => Boolean(config.stripe.secretKey),
      redis: () => Boolean(config.redis.url),
      ai: () => Boolean(config.ai.apiKey),
      gemini: () => Boolean(config.ai.gemini.apiKey),
    };
    return checks[service]?.() ?? false;
  },
};

export default config;

const required = [
  ["SUPABASE_URL", config.supabase.url],
  ["SUPABASE_SERVICE_ROLE_KEY", config.supabase.serviceRoleKey],
  ["CLERK_SECRET_KEY", config.clerk.secretKey],
];

const missing = required.filter(([, v]) => !v).map(([k]) => k);
if (missing.length > 0 && config.nodeEnv === "production") {
  console.error(`[FATAL] Missing required env vars in production: ${missing.join(", ")}`);
  process.exit(1);
}