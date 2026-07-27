import { supabaseAdmin, isConfigured } from "../config/supabase.js";
import { calculateCreditsForClips as calculateCreditsConfig } from "../config/credits.js";

export function calculateCredits(clipCount, clipDuration) {
  return calculateCreditsConfig({ clipCount, clipDuration });
}

export async function getBalance(userId) {
  if (!isConfigured) return { balance: 450, plan: "free" };

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("credits_balance, plan")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return { balance: data?.credits_balance ?? 0, plan: data?.plan || "free" };
}

export async function reserveCredits(userId, amount, reason, projectId) {
  if (!isConfigured) return { success: true, transactionId: "mock_reserve" };

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("credits_balance")
    .eq("id", userId)
    .single();

  if (!user || user.credits_balance < amount) {
    throw new Error("Insufficient credits");
  }

  const newBalance = user.credits_balance - amount;
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("users")
    .update({ credits_balance: newBalance })
    .eq("id", userId)
    .eq("credits_balance", user.credits_balance)
    .select("id")
    .single();

  if (updateError || !updated) {
    throw new Error("Insufficient credits (concurrent modification)");
  }

  try {
    await supabaseAdmin.from("credit_transactions").insert({
      user_id: userId,
      amount: -amount,
      type: "spent",
      reason,
      project_id: projectId,
    });
  } catch (err) {
    console.error(`[Credit] Failed to record spend transaction for user ${userId}:`, err.message);
  }

  return { success: true };
}

export async function deductCredits(userId, amount, reason, projectId, _idempotencyKey = null) {
  return reserveCredits(userId, amount, reason, projectId);
}

export async function addCredits(userId, amount, reason, projectId = null, type = "earned", _idempotencyKey = null) {
  if (!isConfigured) return { success: true };

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("credits_balance")
    .eq("id", userId)
    .single();

  if (!user) {
    console.error(`addCredits: user ${userId} not found`);
    return { success: false, error: "User not found" };
  }

  let finalBalance = user.credits_balance + amount;
  let updateSucceeded = false;

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("users")
    .update({ credits_balance: finalBalance })
    .eq("id", userId)
    .eq("credits_balance", user.credits_balance)
    .select("credits_balance")
    .single();

  if (!updateError && updated) {
    updateSucceeded = true;
    finalBalance = updated.credits_balance;
  } else {
    console.error(`addCredits: optimistic lock conflict for user ${userId}, retrying once`);
    const { data: retryUser } = await supabaseAdmin
      .from("users")
      .select("credits_balance")
      .eq("id", userId)
      .single();
    if (retryUser) {
      const retryBalance = retryUser.credits_balance + amount;
      const { data: retryUpdated, error: retryError } = await supabaseAdmin
        .from("users")
        .update({ credits_balance: retryBalance })
        .eq("id", userId)
        .eq("credits_balance", retryUser.credits_balance)
        .select("credits_balance")
        .single();
      if (!retryError && retryUpdated) {
        updateSucceeded = true;
        finalBalance = retryUpdated.credits_balance;
      } else {
        console.error(`addCredits: retry also failed for user ${userId}`);
        return { success: false, error: "Balance update failed after retry" };
      }
    }
  }

  if (updateSucceeded) {
    try {
      await supabaseAdmin.from("credit_transactions").insert({
        user_id: userId,
        amount,
        type,
        reason,
        project_id: projectId,
      });
    } catch (err) {
      console.error(`[Credit] Failed to record ${type} transaction for user ${userId}:`, err.message);
    }
  }

  return { success: updateSucceeded, newBalance: finalBalance };
}

export async function refundCredits(userId, amount, reason, projectId) {
  if (!isConfigured) return { success: true };

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("credits_balance")
    .eq("id", userId)
    .single();

  if (!user) {
    console.error(`refundCredits: user ${userId} not found`);
    return { success: false };
  }

  const newBalance = user.credits_balance + amount;
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("users")
    .update({ credits_balance: newBalance })
    .eq("id", userId)
    .eq("credits_balance", user.credits_balance)
    .select("id")
    .single();

  if (updateError || !updated) {
    console.error(`refundCredits: optimistic lock conflict for user ${userId}, retrying once`);
    const { data: retryUser } = await supabaseAdmin
      .from("users")
      .select("credits_balance")
      .eq("id", userId)
      .single();
    if (retryUser) {
      const { error: retryError } = await supabaseAdmin
        .from("users")
        .update({ credits_balance: retryUser.credits_balance + amount })
        .eq("id", userId)
        .eq("credits_balance", retryUser.credits_balance);
      if (retryError) {
        console.error(`refundCredits: retry also failed for user ${userId}`);
        return { success: false, error: "Refund failed after retry" };
      }
    } else {
      return { success: false, error: "User not found for refund" };
    }
  }

  try {
    await supabaseAdmin.from("credit_transactions").insert({
      user_id: userId,
      amount,
      type: "refund",
      reason,
      project_id: projectId,
    });
  } catch (err) {
    console.error(`[Credit] Failed to record refund transaction for user ${userId}:`, err.message);
  }

  return { success: true };
}

export async function logTransaction(userId, { amount, type, reason, projectId, _source }) {
  if (!isConfigured) return { success: true };

  try {
    await supabaseAdmin.from("credit_transactions").insert({
      user_id: userId,
      amount,
      type,
      reason,
      project_id: projectId,
    });
    return { success: true };
  } catch (err) {
    console.error(`[Credit] Failed to log transaction for user ${userId}:`, err.message);
    return { success: false, error: err.message };
  }
}

export async function getTransactions(userId, options = {}) {
  if (!isConfigured) return mockTransactions();

  const { limit = 50, offset = 0, type } = options;

  let query = supabaseAdmin
    .from("credit_transactions")
    .select("amount, type, reason, created_at, project_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (type) {
    query = query.eq("type", type);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function getTransactionStats(userId) {
  if (!isConfigured) return { spent: 0, earned: 0, refunded: 0, purchased: 0 };

  const { data, error } = await supabaseAdmin
    .from("credit_transactions")
    .select("type, amount")
    .eq("user_id", userId);

  if (error) throw error;

  return (data || []).reduce((acc, tx) => {
    const absAmount = Math.abs(tx.amount);
    if (tx.type === "spent") acc.spent += absAmount;
    else if (tx.type === "earned" || tx.type === "subscription_grant" || tx.type === "welcome_bonus") acc.earned += absAmount;
    else if (tx.type === "refund") acc.refunded += absAmount;
    else if (tx.type === "purchase") acc.purchased += absAmount;
    return acc;
  }, { spent: 0, earned: 0, refunded: 0, purchased: 0 });
}

export async function clearTransactions(userId) {
  if (!isConfigured) return { success: true, deleted: 0 };

  const { error } = await supabaseAdmin
    .from("credit_transactions")
    .delete()
    .eq("user_id", userId);

  if (error) throw error;
  return { success: true };
}

function mockTransactions() {
  return [
    { amount: 50, type: "earned", reason: "Welcome bonus", created_at: new Date().toISOString() },
    { amount: -150, type: "spent", reason: "Generated 10 clips", created_at: new Date(Date.now() - 86400000).toISOString() },
  ];
}
