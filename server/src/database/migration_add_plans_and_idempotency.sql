-- Migration: Add plans table, idempotency to credit_transactions, and admin features
-- Run this in Supabase SQL Editor

-- 1. Add plans table
CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    monthly_credits INTEGER NOT NULL,
    price_monthly DECIMAL(10,2) NOT NULL,
    price_yearly DECIMAL(10,2) NOT NULL,
    stripe_price_id_monthly TEXT,
    stripe_price_id_yearly TEXT,
    features JSONB NOT NULL DEFAULT '{}',
    credits_expire BOOLEAN NOT NULL DEFAULT TRUE,
    rollover_credits BOOLEAN NOT NULL DEFAULT FALSE,
    max_rollover_months INTEGER DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add idempotency_key to credit_transactions
ALTER TABLE credit_transactions 
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE INDEX IF NOT EXISTS idx_credit_transactions_idempotency ON credit_transactions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_created ON credit_transactions(user_id, created_at DESC);

-- 3. Update credit_transactions type CHECK constraint to include new types
-- First drop the old constraint
ALTER TABLE credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_type_check;
ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_type_check 
CHECK (type IN ('earned', 'spent', 'refund', 'purchase', 'adjustment', 'subscription_grant', 'welcome_bonus'));

-- 4. Add source column to credit_transactions for better tracking
ALTER TABLE credit_transactions 
ADD COLUMN IF NOT EXISTS source TEXT;

-- 5. Add admin_notes column for audit trail
ALTER TABLE credit_transactions 
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- 6. Create trigger for plans updated_at
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Seed plans table
INSERT INTO plans (id, name, monthly_credits, price_monthly, price_yearly, stripe_price_id_monthly, stripe_price_id_yearly, features, credits_expire, rollover_credits, max_rollover_months, active, sort_order) VALUES
('free', 'Free', 50, 0.00, 0.00, NULL, NULL, 
 '{"watermark": true, "maxClipsPerProject": 5, "priorityQueue": false, "premiumCaptions": false, "viralScore": true, "youtubeImport": true, "localUpload": true}', 
 TRUE, FALSE, 0, TRUE, 0),
('starter', 'Starter', 500, 5.00, 50.00, 'price_starter_monthly', 'price_starter_yearly',
 '{"watermark": true, "maxClipsPerProject": 10, "priorityQueue": false, "premiumCaptions": false, "viralScore": true, "youtubeImport": true, "localUpload": true}',
 TRUE, FALSE, 0, TRUE, 1),
('creator', 'Creator', 1200, 10.00, 100.00, 'price_creator_monthly', 'price_creator_yearly',
 '{"watermark": false, "maxClipsPerProject": 20, "priorityQueue": true, "premiumCaptions": true, "viralScore": true, "youtubeImport": true, "localUpload": true}',
 FALSE, TRUE, 3, TRUE, 2),
('pro', 'Pro', 3000, 20.00, 200.00, 'price_pro_monthly', 'price_pro_yearly',
 '{"watermark": false, "maxClipsPerProject": 50, "priorityQueue": true, "premiumCaptions": true, "viralScore": true, "youtubeImport": true, "localUpload": true, "apiAccess": true, "customBranding": true}',
 FALSE, TRUE, 6, TRUE, 3)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  monthly_credits = EXCLUDED.monthly_credits,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  stripe_price_id_monthly = EXCLUDED.stripe_price_id_monthly,
  stripe_price_id_yearly = EXCLUDED.stripe_price_id_yearly,
  features = EXCLUDED.features,
  credits_expire = EXCLUDED.credits_expire,
  rollover_credits = EXCLUDED.rollover_credits,
  max_rollover_months = EXCLUDED.max_rollover_months,
  active = EXCLUDED.active,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- 8. Update users.plan CHECK constraint to include new plans
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plan_check;
ALTER TABLE users ADD CONSTRAINT users_plan_check 
CHECK (plan IN ('free', 'starter', 'creator', 'pro'));

-- 9. Add credits_used_this_month to users for tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS credits_used_this_month INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS credits_rollover INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_credit_reset TIMESTAMPTZ DEFAULT NOW();

-- 10. Create admin_credits_audit table for admin adjustments
CREATE TABLE IF NOT EXISTS admin_credits_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    target_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('add', 'remove', 'reset')),
    amount INTEGER NOT NULL,
    reason TEXT,
    previous_balance INTEGER,
    new_balance INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_target_user ON admin_credits_audit(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin_user ON admin_credits_audit(admin_user_id);

-- 11. Enable RLS on new tables
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_credits_audit ENABLE ROW LEVEL SECURITY;

-- Plans are readable by all authenticated users
CREATE POLICY "Anyone can view active plans" ON plans FOR SELECT USING (active = true);

-- Admin audit is only readable by the admin who performed the action (or super admin logic later)
CREATE POLICY "Admin can view own audit entries" ON admin_credits_audit FOR SELECT USING (admin_user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text));

-- 12. Add unique constraint on idempotency_key for credit_transactions (partial index for non-null)
CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_transactions_idempotency 
ON credit_transactions(idempotency_key) 
WHERE idempotency_key IS NOT NULL;