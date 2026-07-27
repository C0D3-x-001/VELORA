import { createClerkClient } from "@clerk/clerk-sdk-node";
import { supabaseAdmin, isConfigured } from "../config/supabase.js";

const secretKey = process.env.CLERK_SECRET_KEY;
let clerkClient = null;
let clerkConfigured = false;

if (secretKey && !secretKey.includes("your_")) {
  clerkClient = createClerkClient({ secretKey });
  clerkConfigured = true;
}

const userIdCache = new Map();
const USER_CACHE_TTL = 5 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of userIdCache) {
    if (now - entry.ts > USER_CACHE_TTL) userIdCache.delete(key);
  }
}, 60_000).unref();

async function resolveUser(clerkId, email, name) {
  if (!isConfigured) return clerkId;

  const cached = userIdCache.get(clerkId);
  if (cached && Date.now() - cached.ts < USER_CACHE_TTL) return cached.id;

  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("clerk_id", clerkId)
    .single();

  if (existing) {
    userIdCache.set(clerkId, { id: existing.id, ts: Date.now() });
    return existing.id;
  }

  let newUser;
  const { data, error: insertError } = await supabaseAdmin
    .from("users")
    .insert({
      clerk_id: clerkId,
      email: email || "unknown@clerk.dev",
      full_name: name || null,
      plan: "free",
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: retry } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("clerk_id", clerkId)
        .single();
      if (retry) {
        userIdCache.set(clerkId, { id: retry.id, ts: Date.now() });
        return retry.id;
      }
    }
    throw insertError;
  }
  newUser = data;

  userIdCache.set(clerkId, { id: newUser.id, ts: Date.now() });

  const { error: creditError } = await supabaseAdmin
    .from("users")
    .update({ credits_balance: 50 })
    .eq("id", newUser.id);

  if (creditError) console.error("Failed to set welcome bonus balance:", creditError);

  const { error: txError } = await supabaseAdmin
    .from("credit_transactions")
    .insert({
      user_id: newUser.id,
      amount: 50,
      type: "earned",
      reason: "Welcome bonus",
    });

  if (txError) console.error("Failed to record welcome bonus transaction:", txError);

  return newUser.id;
}

export async function authMiddleware(req, res, next) {
  if (!req.path.startsWith("/api/")) {
    return next();
  }

  if (!clerkConfigured) {
    return res.status(401).json({ error: "Authentication not configured" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization header" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = await clerkClient.verifyToken(token, { clockTolerance: 3600 });
    const supabaseUserId = await resolveUser(payload.sub, payload.email, payload.name);
    req.auth = { userId: supabaseUserId, sessionId: payload.sid, clerkId: payload.sub };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return next();
  }
  authMiddleware(req, res, next);
}
