-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 001: Create bookmarks table
--
-- Run order: 1st
-- Description: Core bookmarks table with user ownership
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bookmarks (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url        TEXT        NOT NULL,
  title      TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index: fast lookup of all bookmarks for a given user (most common query)
CREATE INDEX IF NOT EXISTS bookmarks_user_id_idx
  ON public.bookmarks (user_id);

-- Index: sort by created_at DESC (default list order)
CREATE INDEX IF NOT EXISTS bookmarks_created_at_idx
  ON public.bookmarks (created_at DESC);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER bookmarks_updated_at
  BEFORE UPDATE ON public.bookmarks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();