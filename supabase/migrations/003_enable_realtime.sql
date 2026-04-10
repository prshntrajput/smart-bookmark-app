-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 003: Enable Supabase Realtime on bookmarks
--
-- Run order: 3rd (after 002)
-- Description: Configure the bookmarks table for Realtime subscriptions.
--
-- REPLICA IDENTITY FULL → Supabase sends the complete old row in DELETE events.
--   Without this, payload.old only contains the primary key.
--   We need the full row so useRealtimeSync can extract user_id for ownership
--   verification before removing from client state.
--
-- supabase_realtime publication → registers the table with Supabase's
--   internal Realtime publication so postgres_changes events are broadcast.
-- ─────────────────────────────────────────────────────────────────────────────

-- Required for payload.old to contain the full deleted row (not just PK)
ALTER TABLE public.bookmarks
  REPLICA IDENTITY FULL;

-- Add bookmarks to the Supabase Realtime publication
ALTER PUBLICATION supabase_realtime
  ADD TABLE public.bookmarks;