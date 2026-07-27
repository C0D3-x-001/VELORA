-- Add caption_config and caption_position columns to clips table
-- These store per-clip caption configuration (font, colors, animation settings, etc.)
-- and position overrides. Without these, per-clip style saves silently fail.

ALTER TABLE clips ADD COLUMN IF NOT EXISTS caption_config JSONB;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS caption_position TEXT;
