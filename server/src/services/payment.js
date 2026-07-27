import { supabaseAdmin, isConfigured } from "../config/supabase.js";
import { stripeClient, isStripeConfigured } from "../config/stripe.js";
import config from "../config/env.js";

export const paymentService = {
  resolvePlanFromPrice(priceId) {
    if (!priceId) return "creator";
    const planMap = {
      [config.stripe.creatorPriceId]: "creator",
      [config.stripe.creditPackPrices?.starter]: "starter",
      [config.stripe.creditPackPrices?.creator]: "creator",
      [config.stripe.creditPackPrices?.pro]: "pro",
    };
    return planMap[priceId] || "creator";
  },

  async createCheckoutSession(userId, priceId) {
    if (!isStripeConfigured) return { sessionId: "mock_session", url: "https://checkout.stripe.com/mock" };

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("stripe_customer_id, email")
      .eq("id", userId)
      .single();

    let customerId = user?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripeClient.customers.create({ email: user.email, metadata: { userId } });
      customerId = customer.id;
      await supabaseAdmin.from("users").update({ stripe_customer_id: customerId }).eq("id", userId);
    }

    const creditPacks = Object.values(config.stripe.creditPackPrices || {});
    const isPack = creditPacks.includes(priceId) || priceId.includes("pack");
    const mode = isPack ? "payment" : "subscription";

    const session = await stripeClient.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode,
      metadata: { userId, priceId, type: isPack ? "credits" : "subscription" },
      success_url: `${process.env.FRONTEND_URL}/billing?success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/billing?canceled=true`,
    });

    return { sessionId: session.id, url: session.url };
  },

  async createPortalSession(userId) {
    if (!isStripeConfigured) return { url: "https://billing.stripe.com/mock" };

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("stripe_customer_id")
      .eq("id", userId)
      .single();

    if (!user?.stripe_customer_id) throw new Error("No Stripe customer");

    const session = await stripeClient.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL}/billing`,
    });

    return { url: session.url };
  },

  async handleWebhook(payload, signature) {
    if (!isStripeConfigured) return { received: true, mock: true };

    const event = stripeClient.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    switch (event.type) {
      case "checkout.session.completed":
        if (event.data.object.metadata?.type === "credits") {
          await this.handleCreditsPurchased(event.data.object);
        } else {
          await this.handleSubscriptionCreated(event.data.object);
        }
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await this.handleSubscriptionUpdated(event.data.object);
        break;
      case "invoice.payment_succeeded":
        await this.handlePaymentSucceeded(event.data.object);
        break;
    }

    return { received: true };
  },

  async handleSubscriptionCreated(session) {
    const userId = session.metadata?.userId;
    if (!userId) return;

    const plan = this.resolvePlanFromPrice(session.metadata?.priceId);

    await supabaseAdmin
      .from("users")
      .update({ plan, stripe_customer_id: session.customer })
      .eq("id", userId);

    await supabaseAdmin.from("subscriptions").insert({
      user_id: userId,
      stripe_customer_id: session.customer,
      stripe_subscription_id: session.subscription,
      plan,
      status: "active",
    });
  },

  async handleSubscriptionUpdated(subscription) {
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("stripe_customer_id", subscription.customer)
      .single();

    if (user) {
      const status = subscription.status === "active" ? "active"
        : subscription.status === "canceled" ? "canceled"
        : subscription.status === "past_due" ? "past_due"
        : subscription.status;

      await supabaseAdmin
        .from("subscriptions")
        .update({ status, renewal_date: new Date(subscription.current_period_end * 1000).toISOString() })
        .eq("stripe_subscription_id", subscription.id);

      if (subscription.status === "active") {
        const subPriceId = subscription.items?.data?.[0]?.price?.id;
        const plan = this.resolvePlanFromPrice(subPriceId);
        await supabaseAdmin
          .from("users")
          .update({ plan })
          .eq("id", user.id);
      } else if (subscription.status === "canceled" || subscription.status === "past_due") {
        await supabaseAdmin
          .from("users")
          .update({ plan: "free" })
          .eq("id", user.id);
      }
    }
  },

  async handlePaymentSucceeded(invoice) {
    if (invoice.billing_reason === "subscription_create") return;

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("stripe_customer_id", invoice.customer)
      .single();

    if (user) {
      await supabaseAdmin.from("payments").insert({
        user_id: user.id,
        amount: invoice.amount_paid / 100,
        currency: invoice.currency,
        payment_type: "subscription",
        stripe_payment_id: invoice.payment_intent,
        status: "succeeded",
      });
    }
  },

  async handleCreditsPurchased(session) {
    const userId = session.metadata?.userId;
    const priceId = session.metadata?.priceId;
    if (!userId || !priceId) return;

    // Find credit package by Stripe price ID
    const { data: pack } = await supabaseAdmin
      .from("credit_packages")
      .select("credits, name, price")
      .eq("stripe_price_id", priceId)
      .single();

    if (!pack) {
      console.error(`[Stripe Webhook] Credit package not found for price ID: ${priceId}`);
      return;
    }

    // Update user balance
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("credits_balance")
      .eq("id", userId)
      .single();

    if (user) {
      const newBalance = (user.credits_balance || 0) + pack.credits;
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("users")
        .update({ credits_balance: newBalance })
        .eq("id", userId)
        .eq("credits_balance", user.credits_balance)
        .select("credits_balance")
        .single();

      if (updateError || !updated) {
        console.error(`[Stripe Webhook] Credits update failed for user ${userId} — optimistic lock conflict`);
        return;
      }

      // Record transaction
      await supabaseAdmin.from("credit_transactions").insert({
        user_id: userId,
        amount: pack.credits,
        type: "purchase",
        reason: `Purchased ${pack.name} Pack`,
      });

      // Record payment
      await supabaseAdmin.from("payments").insert({
        user_id: userId,
        amount: pack.price,
        currency: "USD",
        payment_type: "credits",
        stripe_payment_id: session.payment_intent,
        status: "completed",
      });
    }
  },
};