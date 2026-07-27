import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
let stripe = null;
let configured = false;

if (key && !key.includes("your_")) {
  stripe = new Stripe(key, { apiVersion: "2024-04-10" });
  configured = true;
}

function mockStripe() {
  return {
    checkout: {
      sessions: {
        create: async () => ({ id: "cs_mock", url: "https://checkout.stripe.com/mock" }),
      },
    },
    billingPortal: {
      sessions: { create: async () => ({ url: "https://billing.stripe.com/mock" }) },
    },
    webhooks: {
      constructEvent: () => ({ type: "mock", data: {} }),
    },
  };
}

export const stripeClient = stripe || mockStripe();
export const isStripeConfigured = configured;