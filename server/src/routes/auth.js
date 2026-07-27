import { Router } from "express";
import { supabaseAdmin, isConfigured } from "../config/supabase.js";
import { createClerkClient } from "@clerk/clerk-sdk-node";
import { deleteUserFiles } from "../services/storage.js";
import config from "../config/env.js";
import crypto from "crypto";

const router = Router();

let clerkClient = null;
const secretKey = process.env.CLERK_SECRET_KEY;
if (secretKey && !secretKey.includes("your_")) {
  clerkClient = createClerkClient({ secretKey });
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const computed = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(hash, "hex");
  if (computed.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(computed, storedBuf);
}

router.get("/profile", async (req, res) => {
  try {
    const userId = req.auth.userId;

    if (!config.isConfigured("supabase")) {
      return res.json({
        id: userId,
        email: "dev@velora.ai",
        credits: 450,
        plan: "creator",
      });
    }

    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("id, email, credits_balance, plan, full_name, avatar_url")
      .eq("id", userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.put("/email", async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { email, currentPassword } = req.body;

    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Valid email is required" });
    }

    if (!config.isConfigured("supabase")) {
      return res.json({ success: true, email });
    }

    const { data: user, error: fetchError } = await supabaseAdmin
      .from("users")
      .select("id, password_hash")
      .eq("id", userId)
      .single();

    if (fetchError || !user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.password_hash) {
      if (!currentPassword) {
        return res.status(400).json({ error: "Current password is required to change email" });
      }
      if (!verifyPassword(currentPassword, user.password_hash)) {
        return res.status(403).json({ error: "Current password is incorrect" });
      }
    }

    const { error } = await supabaseAdmin
      .from("users")
      .update({ email })
      .eq("id", userId);

    if (error) {
      return res.status(500).json({ error: "Failed to update email" });
    }

    res.json({ success: true, email });
  } catch {
    res.status(500).json({ error: "Failed to update email" });
  }
});

router.put("/password", async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters" });
    }

    if (!config.isConfigured("supabase")) {
      return res.json({ success: true });
    }

    const { data: user, error: fetchError } = await supabaseAdmin
      .from("users")
      .select("id, password_hash")
      .eq("id", userId)
      .single();

    if (fetchError || !user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.password_hash) {
      if (!currentPassword) {
        return res.status(400).json({ error: "Current password is required to change password" });
      }
      if (!verifyPassword(currentPassword, user.password_hash)) {
        return res.status(403).json({ error: "Current password is incorrect" });
      }
    }

    const password_hash = hashPassword(newPassword);

    const { error } = await supabaseAdmin
      .from("users")
      .update({ password_hash })
      .eq("id", userId);

    if (error) {
      return res.status(500).json({ error: "Failed to update password" });
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to update password" });
  }
});

router.delete("/profile", async (req, res) => {
  try {
    const userId = req.auth.userId;
    const clerkId = req.auth.clerkId;

    if (!config.isConfigured("supabase")) {
      return res.json({ success: true });
    }

    try {
      await deleteUserFiles(userId);
    } catch {
      // Best-effort file cleanup
    }

    const { error } = await supabaseAdmin
      .from("users")
      .delete()
      .eq("id", userId);

    if (error) {
      return res.status(500).json({ error: "Failed to delete account" });
    }

    if (clerkClient && clerkId) {
      try {
        await clerkClient.users.delete(clerkId);
      } catch {
        // Best-effort Clerk cleanup
      }
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete account" });
  }
});

export default router;
