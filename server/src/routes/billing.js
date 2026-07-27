import { Router } from "express";
import { paymentService } from "../services/payment.js";
import { supabaseAdmin, isConfigured } from "../config/supabase.js";

const ALLOWED_PRICE_IDS = new Set(
  Object.values(process.env)
    .filter((v) => typeof v === "string" && v.startsWith("price_"))
);

const router = Router();

router.get("/history", async (req, res) => {
  try {
    if (!isConfigured) return res.json(mockHistory());

    const { data, error } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("user_id", req.auth.userId)
      .order("created_at", { ascending: false });

    if (error) {
      return res.json([]);
    }
    res.json(data || []);
  } catch {
    res.json([]);
  }
});

router.post("/checkout", async (req, res) => {
  try {
    const { priceId } = req.body;
    if (!priceId || typeof priceId !== "string") {
      return res.status(400).json({ error: "Invalid price ID" });
    }
    if (ALLOWED_PRICE_IDS.size > 0 && !ALLOWED_PRICE_IDS.has(priceId)) {
      return res.status(400).json({ error: "Invalid price ID" });
    }
    const result = await paymentService.createCheckoutSession(req.auth.userId, priceId);
    res.json(result);
  } catch {
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

router.post("/portal", async (req, res) => {
  try {
    const result = await paymentService.createPortalSession(req.auth.userId);
    res.json(result);
  } catch {
    res.status(500).json({ error: "Failed to create portal session" });
  }
});

function mockHistory() {
  return [
    { amount: 10, currency: "usd", payment_type: "subscription", status: "succeeded", created_at: new Date().toISOString() },
    { amount: 5, currency: "usd", payment_type: "credits", status: "succeeded", created_at: new Date(Date.now() - 86400000).toISOString() },
  ];
}

export default router;
