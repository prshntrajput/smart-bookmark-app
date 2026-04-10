-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 004: AI Enrichment columns (Feature B)
--
-- Run order: 4th (after 003)
-- Description: Adds category, summary, enriched columns for Inngest + Gemini.
--
-- All columns are nullable so existing bookmarks work without a data backfill.
-- enriched = false (default) → BookmarkCard shows "AI analyzing…" badge
-- enriched = true            → Inngest completed, category + summary available
--
-- Inngest uses the service role key to UPDATE these columns, bypassing RLS.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.bookmarks
  ADD COLUMN IF NOT EXISTS category TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS summary  TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS enriched BOOLEAN DEFAULT FALSE;

-- Index: filter un-enriched bookmarks for potential re-processing jobs
CREATE INDEX IF NOT EXISTS bookmarks_enriched_idx
  ON public.bookmarks (enriched)
  WHERE enriched = FALSE;

-- Explicit UPDATE grant for service_role (Inngest admin client)
GRANT UPDATE (category, summary, enriched)
  ON public.bookmarks
  TO service_role;