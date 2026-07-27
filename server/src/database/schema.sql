-- VELORA DATABASE SCHEMA
-- Run this in Supabase SQL Editor

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_id TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT,
    full_name TEXT,
    avatar_url TEXT,
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'creator', 'pro', 'business')),
    credits_balance INTEGER DEFAULT 50,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    source_type TEXT CHECK (source_type IN ('youtube', 'upload')) NOT NULL,
    source_url TEXT,
    original_video_url TEXT,
    thumbnail_url TEXT,
    duration_seconds INTEGER,
    status TEXT DEFAULT 'created' CHECK (status IN ('created', 'uploading', 'downloading', 'transcribing', 'analyzing', 'processing', 'enhancing', 'completed', 'failed')),
    settings JSONB DEFAULT '{}',
    clips_count INTEGER DEFAULT 0,
    avg_viral_score INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CLIPS TABLE
CREATE TABLE IF NOT EXISTS clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    duration_seconds INTEGER NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL,
    viral_score INTEGER DEFAULT 0,
    caption_style TEXT DEFAULT 'modern',
    caption_preset TEXT DEFAULT 'popup',
    subtitles_url TEXT,
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CLIP METADATA TABLE
CREATE TABLE IF NOT EXISTS clip_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clip_id UUID REFERENCES clips(id) ON DELETE CASCADE,
    title TEXT,
    caption TEXT,
    hashtags JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TRANSCRIPTS TABLE
CREATE TABLE IF NOT EXISTS transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    segments JSONB DEFAULT '[]',
    language TEXT DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. CREDIT TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    type TEXT CHECK (type IN ('earned', 'spent', 'refund', 'purchase')) NOT NULL,
    reason TEXT,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. PROCESSING JOBS TABLE
CREATE TABLE IF NOT EXISTS processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    job_type TEXT CHECK (job_type IN ('analysis', 'transcription', 'generation', 'rendering', 'export')) NOT NULL,
    status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    progress INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT UNIQUE,
    plan TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
    renewal_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. CREDIT PACKAGES TABLE
CREATE TABLE IF NOT EXISTS credit_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    credits INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    stripe_price_id TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    payment_type TEXT CHECK (payment_type IN ('subscription', 'credits')) NOT NULL,
    stripe_payment_id TEXT,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. USER SETTINGS TABLE
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    default_caption_style TEXT DEFAULT 'modern',
    default_caption_preset TEXT DEFAULT 'popup',
    default_platform TEXT DEFAULT 'youtube',
    default_stabilization BOOLEAN DEFAULT TRUE,
    default_face_tracking BOOLEAN DEFAULT TRUE,
    default_auto_reframe BOOLEAN DEFAULT TRUE,
    default_close_up_framing BOOLEAN DEFAULT FALSE,
    default_close_up_mode TEXT DEFAULT 'closeup',
    default_auto_punch_in BOOLEAN DEFAULT FALSE,
    default_auto_speaker_switch BOOLEAN DEFAULT TRUE,
    email_notifications BOOLEAN DEFAULT TRUE,
    processing_notifications BOOLEAN DEFAULT TRUE,
    marketing_emails BOOLEAN DEFAULT FALSE,
    theme TEXT DEFAULT 'dark',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_clips_project_id ON clips(project_id);
CREATE INDEX IF NOT EXISTS idx_clips_viral_score ON clips(viral_score DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_project_id ON processing_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);

-- RLS POLICIES
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE clip_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid()::text = clerk_id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid()::text = clerk_id);

-- Projects belong to user
CREATE POLICY "Users can CRUD own projects" ON projects FOR ALL USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text));

-- Clips belong to user's projects
CREATE POLICY "Users can access own clips" ON clips FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text)));

-- Similar for other tables
CREATE POLICY "Users can access own clip metadata" ON clip_metadata FOR ALL USING (clip_id IN (SELECT id FROM clips WHERE project_id IN (SELECT id FROM projects WHERE user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text))));
CREATE POLICY "Users can access own transcripts" ON transcripts FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text)));
CREATE POLICY "Users can view own credit transactions" ON credit_transactions FOR ALL USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text));
CREATE POLICY "Users can view own processing jobs" ON processing_jobs FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text)));
CREATE POLICY "Users can view own subscriptions" ON subscriptions FOR ALL USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text));
CREATE POLICY "Users can view own payments" ON payments FOR ALL USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text));
CREATE POLICY "Users can manage own settings" ON user_settings FOR ALL USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text));

-- TRIGGERS FOR UPDATED_AT
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- SEED CREDIT PACKAGES
INSERT INTO credit_packages (name, credits, price, stripe_price_id) VALUES
('Starter Pack', 1000, 5.00, 'price_pack_starter'),
('Creator Pack', 5000, 20.00, 'price_pack_creator'),
('Pro Pack', 15000, 50.00, 'price_pack_pro'),
('Business Pack', 50000, 150.00, 'price_pack_business')
ON CONFLICT DO NOTHING;

-- STORAGE BUCKET (run in Supabase Dashboard)
-- CREATE BUCKET "velora-storage" WITH PUBLIC = FALSE;
-- FOLDER STRUCTURE: users/{user_id}/projects/{project_id}/