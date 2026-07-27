-- Migration: Add video enhancement features + fix plan constraints
-- Run this in Supabase SQL Editor

-- 1. Fix users.plan CHECK to include all 5 plans (free, starter, creator, pro, business)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plan_check;
ALTER TABLE users ADD CONSTRAINT users_plan_check
CHECK (plan IN ('free', 'starter', 'creator', 'pro', 'business'));

-- 2. Fix projects.status CHECK to include 'enhancing'
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check
CHECK (status IN ('created', 'uploading', 'downloading', 'transcribing', 'analyzing', 'processing', 'enhancing', 'completed', 'failed'));

-- 3. Upsert all 5 plans with video enhancement features in the plans table
INSERT INTO plans (id, name, monthly_credits, price_monthly, price_yearly, stripe_price_id_monthly, stripe_price_id_yearly, features, credits_expire, rollover_credits, max_rollover_months, active, sort_order) VALUES
('free', 'Free', 100, 0.00, 0.00, NULL, NULL,
 '{"watermark": false, "exportQuality": "720p", "aiClipping": "Basic", "premiumCaptions": false, "animatedCaptions": false, "popUpCaptions": false, "customClipDuration": false, "customClipCount": false, "brandKit": false, "savedTemplates": false, "activeProjects": 1, "storage": "—", "batchProcessing": false, "teamMembers": 0, "apiAccess": false, "processingPriority": "Standard", "supportLevel": "Community", "videoStabilization": "Basic", "aiFaceTracking": "Basic", "smartAutoReframe": false}',
 TRUE, FALSE, 0, TRUE, 0),
('starter', 'Starter', 1000, 5.00, 50.00, 'price_starter_monthly', 'price_starter_yearly',
 '{"watermark": true, "exportQuality": "1080p", "aiClipping": "Standard", "premiumCaptions": false, "animatedCaptions": false, "popUpCaptions": false, "customClipDuration": false, "customClipCount": false, "brandKit": false, "savedTemplates": false, "activeProjects": 3, "storage": "1 GB", "batchProcessing": false, "teamMembers": 0, "apiAccess": false, "processingPriority": "Standard", "supportLevel": "Email", "videoStabilization": "Improved", "aiFaceTracking": "Basic", "smartAutoReframe": false}',
 FALSE, FALSE, 0, TRUE, 1),
('creator', 'Creator', 5000, 12.00, 120.00, 'price_creator_monthly', 'price_creator_yearly',
 '{"watermark": true, "exportQuality": "1080p", "aiClipping": "Advanced", "premiumCaptions": true, "animatedCaptions": false, "popUpCaptions": false, "customClipDuration": true, "customClipCount": true, "brandKit": true, "savedTemplates": true, "activeProjects": 10, "storage": "10 GB", "batchProcessing": false, "teamMembers": 0, "apiAccess": false, "processingPriority": "Fast", "supportLevel": "Priority", "videoStabilization": "Advanced", "aiFaceTracking": "Advanced", "smartAutoReframe": "Basic"}',
 FALSE, TRUE, 3, TRUE, 2),
('pro', 'Pro', 15000, 29.00, 290.00, 'price_pro_monthly', 'price_pro_yearly',
 '{"watermark": true, "exportQuality": "4K", "aiClipping": "Advanced", "premiumCaptions": true, "animatedCaptions": true, "popUpCaptions": true, "customClipDuration": true, "customClipCount": true, "brandKit": true, "savedTemplates": true, "activeProjects": 50, "storage": "50 GB", "batchProcessing": true, "teamMembers": 3, "apiAccess": false, "processingPriority": "Fast", "supportLevel": "Priority", "videoStabilization": "Premium", "aiFaceTracking": "Premium", "smartAutoReframe": "Advanced"}',
 FALSE, TRUE, 6, TRUE, 3),
('business', 'Business', 50000, 79.00, 790.00, 'price_business_monthly', 'price_business_yearly',
 '{"watermark": true, "exportQuality": "4K", "aiClipping": "Advanced", "premiumCaptions": true, "animatedCaptions": true, "popUpCaptions": true, "customClipDuration": true, "customClipCount": true, "brandKit": true, "savedTemplates": true, "activeProjects": -1, "storage": "500 GB", "batchProcessing": true, "teamMembers": 10, "apiAccess": true, "processingPriority": "Fastest", "supportLevel": "Dedicated", "videoStabilization": "Premium", "aiFaceTracking": "Premium", "smartAutoReframe": "Premium"}'
)
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

-- 4. Update credit_packages to match current packs
INSERT INTO credit_packages (name, credits, price, stripe_price_id) VALUES
('Starter Pack', 1000, 5.00, 'price_pack_starter'),
('Creator Pack', 5000, 20.00, 'price_pack_creator'),
('Pro Pack', 15000, 50.00, 'price_pack_pro'),
('Business Pack', 50000, 150.00, 'price_pack_business')
ON CONFLICT DO NOTHING;

-- 5. Add default enhancement settings to user_settings
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS default_stabilization BOOLEAN DEFAULT TRUE;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS default_face_tracking BOOLEAN DEFAULT TRUE;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS default_auto_reframe BOOLEAN DEFAULT TRUE;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS default_close_up_framing BOOLEAN DEFAULT FALSE;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS default_close_up_mode TEXT DEFAULT 'closeup';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS default_auto_punch_in BOOLEAN DEFAULT FALSE;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS default_auto_speaker_switch BOOLEAN DEFAULT TRUE;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS default_caption_preset TEXT DEFAULT 'popup';

-- 6. Add caption_preset to clips table
ALTER TABLE clips ADD COLUMN IF NOT EXISTS caption_preset TEXT DEFAULT 'popup';
