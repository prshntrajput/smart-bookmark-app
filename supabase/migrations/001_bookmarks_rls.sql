-- =============================================================================
-- Smart Bookmark App — Initial Migration
-- File: supabase/migrations/001_bookmarks_rls.sql
--
-- HOW TO APPLY:
--   Option A (Recommended for assessment):
--     1. Open your Supabase project → SQL Editor
--     2. Paste this entire file and click "Run"
--
--   Option B (Supabase CLI):
--     supabase db push
--
-- WHAT THIS DOES:
--   1. Creates the `bookmarks` table
--   2. Adds a performance index on user_id
--   3. Creates the updated_at auto-trigger
--   4. Enables Row Level Security (RLS) — private bookmarks at DB level
--   5. Creates 4 RLS policies (SELECT, INSERT, UPDATE, DELETE)
--   6. Enables Supabase Realtime for live sync across tabs
-- =============================================================================


-- =============================================================================
-- STEP 1: CREATE TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.bookmarks (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url        TEXT        NOT NULL,
  title      TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Column constraints (enforced at DB level — not just frontend)
ALTER TABLE public.bookmarks
  ADD CONSTRAINT bookmarks_url_length   CHECK (char_length(url)   <= 2048),
  ADD CONSTRAINT bookmarks_title_length CHECK (char_length(title) <= 255),
  ADD CONSTRAINT bookmarks_url_not_empty CHECK (trim(url) <> ''),
  ADD CONSTRAINT bookmarks_title_not_empty CHECK (trim(title) <> '');


-- =============================================================================
-- STEP 2: PERFORMANCE INDEX
--
-- Every RLS policy does `WHERE user_id = auth.uid()`.
-- Without this index, Postgres does a full table scan on every query.
-- With it, queries for a user's bookmarks are O(log n).
-- =============================================================================

CREATE INDEX IF NOT EXISTS bookmarks_user_id_idx
  ON public.bookmarks (user_id);


-- =============================================================================
-- STEP 3: AUTO-UPDATE `updated_at` TRIGGER
--
-- Automatically sets updated_at = NOW() on every UPDATE.
-- Keeps the column accurate without requiring app-level code.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookmarks_updated_at ON public.bookmarks;

CREATE TRIGGER bookmarks_updated_at
  BEFORE UPDATE ON public.bookmarks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- =============================================================================
-- STEP 4: ENABLE ROW LEVEL SECURITY (RLS)
--
-- Once RLS is enabled, ALL requests return 0 rows by default.
-- Policies below grant access back selectively.
--
-- This is enforced at the PostgreSQL level — bypassing the frontend
-- or API will NOT give access to another user's data.
-- =============================================================================

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- STEP 5: RLS POLICIES
--
-- Best practice (Supabase docs): use `(select auth.uid())` instead of
-- `auth.uid()` directly. This evaluates the function ONCE per query
-- rather than once per row — a significant performance gain on large tables.
--
-- All policies are scoped to the `authenticated` Postgres role,
-- so anonymous (unauthenticated) users are completely blocked.
-- =============================================================================

-- ── SELECT: User can only read their own bookmarks ──────────────────────────
CREATE POLICY "Users can view their own bookmarks"
  ON public.bookmarks
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ── INSERT: User can only create bookmarks for themselves ───────────────────
CREATE POLICY "Users can insert their own bookmarks"
  ON public.bookmarks
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ── UPDATE: User can only update their own bookmarks ────────────────────────
-- USING  → checks the existing row before update
-- WITH CHECK → checks the new row after update (prevents re-assigning to another user)
CREATE POLICY "Users can update their own bookmarks"
  ON public.bookmarks
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ── DELETE: User can only delete their own bookmarks ────────────────────────
CREATE POLICY "Users can delete their own bookmarks"
  ON public.bookmarks
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);


-- =============================================================================
-- STEP 6: ENABLE SUPABASE REALTIME
--
-- This adds the `bookmarks` table to the `supabase_realtime` publication.
-- Supabase Realtime listens to Postgres WAL (Write-Ahead Log) changes
-- and broadcasts INSERT / UPDATE / DELETE events to subscribed clients.
--
-- Required for the real-time sync feature (Step 6 of the build).
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.bookmarks;


-- =============================================================================
-- VERIFICATION QUERIES
-- Run these after applying the migration to confirm everything is set up.
-- =============================================================================

-- Check table exists with correct columns:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'bookmarks'
-- ORDER BY ordinal_position;

-- Check RLS is enabled:
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public' AND tablename = 'bookmarks';

-- Check policies:
-- SELECT policyname, cmd, roles, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'bookmarks';

-- Check index:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'bookmarks';

-- Check realtime publication:
-- SELECT pubname, tablename
-- FROM pg_publication_tables
-- WHERE pubname = 'supabase_realtime' AND tablename = 'bookmarks';
