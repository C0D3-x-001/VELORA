-- Migration: Add error_message column to projects table
-- Run this in Supabase SQL Editor

ALTER TABLE projects ADD COLUMN IF NOT EXISTS error_message TEXT;
