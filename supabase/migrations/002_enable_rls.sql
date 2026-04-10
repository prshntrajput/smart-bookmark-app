-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 002: Enable Row Level Security on bookmarks
--
-- Run order: 2nd (after 001)
-- Description: Lock down bookmarks so users can only access their own rows.
--
-- USING  → filters rows on SELECT / DELETE (which rows are visible/deletable)
-- WITH CHECK → validates rows on INSERT / UPDATE (what values are allowed)
--
-- auth.uid() returns the UUID from the Supabase JWT — it cannot be
-- spoofed by the client because Supabase signs the JWT server-side.
--
-- The SUPABASE_SERVICE_ROLE_KEY (used by Inngest) bypasses all RLS policies
-- intentionally — it runs as a trusted server process, not as an end user.
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Enable RLS on the table
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- Step 2: SELECT — users can only read their own bookmarks
CREATE POLICY "Users can only view their own bookmarks"
  ON public.bookmarks
  FOR SELECT
  USING (auth.uid() = user_id);

-- Step 3: INSERT — user_id on new rows must match the logged-in user
CREATE POLICY "Users can only insert their own bookmarks"
  ON public.bookmarks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Step 4: UPDATE — users can only update their own bookmarks
--   USING     → which rows they can target
--   WITH CHECK → the updated row must still belong to them (prevents reassignment)
CREATE POLICY "Users can only update their own bookmarks"
  ON public.bookmarks
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Step 5: DELETE — users can only delete their own bookmarks
CREATE POLICY "Users can only delete their own bookmarks"
  ON public.bookmarks
  FOR DELETE
  USING (auth.uid() = user_id);