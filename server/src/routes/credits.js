import { Router } from "express";
import { getBalance, getTransactions, clearTransactions, calculateCredits } from "../services/credit.js";
import {
  CREDIT_COSTS,
  CREDIT_COSTS_LABELS,
  PLAN_DEFAULTS,
  CREDIT_PACKS,
  estimateMonthlyCredits,
  getRecommendedPlan,
  getPlanCredits,
} from "../config/credits.js";
import { PLANS, ENTERPRISE_PLAN, PLAN_ORDER, COMPARISON_ROWS, FAQS } from "../config/plans.js";

const router = Router();

router.get("/balance", async (req, res) => {
  try {
    const balance = await getBalance(req.auth.userId);
    res.json(balance);
  } catch {
    res.status(500).json({ error: "Failed to fetch balance" });
  }
});

router.get("/transactions", async (req, res) => {
  try {
    const { limit = 50, offset = 0, type } = req.query;
    const transactions = await getTransactions(req.auth.userId, {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      type,
    });
    res.json(transactions);
  } catch (err) {
    console.warn("[Credits] transactions query failed:", err.message);
    res.json([]);
  }
});

router.delete("/transactions", async (req, res) => {
  try {
    await clearTransactions(req.auth.userId);
    res.json({ success: true });
  } catch (err) {
    console.warn("[Credits] clear transactions failed:", err.message);
    res.status(500).json({ error: "Failed to clear transaction history" });
  }
});

router.post("/estimate", async (req, res) => {
  try {
    const clipCount = Math.max(0, Math.floor(Number(req.body.clipCount) || 0));
    const rawDuration = req.body.clipDuration != null ? Number(req.body.clipDuration) : null;
    const clipDuration = rawDuration != null ? Math.max(1, Math.floor(rawDuration)) : 120;
    if (clipCount <= 0) return res.json({ estimatedCredits: 0 });
    const credits = calculateCredits(clipCount, clipDuration);
    res.json({ estimatedCredits: Math.max(0, Math.floor(credits)) });
  } catch {
    res.status(500).json({ error: "Failed to estimate credits" });
  }
});

router.get("/pricing", async (req, res) => {
  try {
    res.json({
      costs: CREDIT_COSTS,
      costLabels: CREDIT_COSTS_LABELS,
      plans: PLAN_DEFAULTS,
      plansFull: PLANS,
      planOrder: PLAN_ORDER,
      enterprise: ENTERPRISE_PLAN,
      creditPacks: CREDIT_PACKS,
      comparisonRows: COMPARISON_ROWS,
      faqs: FAQS,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch pricing" });
  }
});

router.post("/estimate-monthly", async (req, res) => {
  try {
    const { usage } = req.body;
    const estimatedCredits = estimateMonthlyCredits(usage);
    const recommendedPlan = getRecommendedPlan(estimatedCredits);
    res.json({
      estimatedCredits,
      recommendedPlan,
      planCredits: getPlanCredits(recommendedPlan),
    });
  } catch {
    res.status(500).json({ error: "Failed to estimate monthly credits" });
  }
});

export default router;
