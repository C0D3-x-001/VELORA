import { supabaseAdmin, isConfigured } from "../config/supabase.js";

export async function syncUser(clerkUser) {
  if (!isConfigured) return mockUser(clerkUser);

  const { data, error } = await supabaseAdmin
    .from("users")
    .upsert({
      clerk_id: clerkUser.id,
      email: clerkUser.emailAddresses[0]?.emailAddress,
      full_name: `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim(),
      avatar_url: clerkUser.imageUrl,
      updated_at: new Date().toISOString(),
    }, { onConflict: "clerk_id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getUserProfile(userId) {
  if (!isConfigured) return mockUser({ id: userId });

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, clerk_id, email, full_name, avatar_url, plan, credits_balance, created_at, updated_at")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}

function mockUser(clerkUser) {
  return {
    id: clerkUser.id || "dev_user_001",
    clerk_id: clerkUser.id || "dev_user_001",
    email: clerkUser.emailAddresses?.[0]?.emailAddress || "creator@velora.ai",
    full_name: "Creator",
    avatar_url: null,
    plan: "free",
    credits_balance: 50,
    created_at: new Date().toISOString(),
  };
}