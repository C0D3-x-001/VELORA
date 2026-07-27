-- Performance indexes for common query patterns
-- Run via: node src/database/migrate.js < this file

-- Projects: list by user + status + created_at (dashboard query)
CREATE INDEX IF NOT EXISTS idx_projects_user_status_created ON projects (user_id, status, created_at DESC);

-- Projects: recovery query (status != completed)
CREATE INDEX IF NOT EXISTS idx_projects_status_ne_completed ON projects (status) WHERE status NOT IN ('completed', 'failed');

-- Clips: fetch by project
CREATE INDEX IF NOT EXISTS idx_clips_project_id ON clips (project_id);

-- Clips: status polling
CREATE INDEX IF NOT EXISTS idx_clips_project_status ON clips (project_id, status);

-- Clip metadata: lookup by clip_id
CREATE INDEX IF NOT EXISTS idx_clip_metadata_clip_id ON clip_metadata (clip_id);

-- Transcripts: lookup by project
CREATE INDEX IF NOT EXISTS idx_transcripts_project_id ON transcripts (project_id);

-- Credit transactions: history by user + created_at
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_created ON credit_transactions (user_id, created_at DESC);

-- Jobs: recovery query (stuck projects)
CREATE INDEX IF NOT EXISTS idx_jobs_project_status ON jobs (project_id, status);
