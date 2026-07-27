import express, { Router } from "express";
import { paymentService } from "../services/payment.js";

const router = Router();

router.post("/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const payload = req.body;

  try {
    const result = await paymentService.handleWebhook(payload, sig);
    res.json(result);
  } catch {
    res.status(400).json({ error: "Invalid webhook signature" });
  }
});

export default router;
