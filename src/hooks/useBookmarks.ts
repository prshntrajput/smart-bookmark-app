"use client";

import { useState, useEffect, useCallback } from "react";
import { bookmarkService } from "@/services/bookmark.service";
import type { Bookmark, BookmarkInsert } from "@/types";

interface UseBookmarksReturn {
  bookmarks: Bookmark[];
  loading: boolean;
  error: string | null;
  addBookmark: (url: string, title: string) => Promise<void>;
  deleteBookmark: (id: string) => Promise<void>;
  refreshBookmarks: () => Promise<void>; // ← NEW: used by useRealtimeSync on INSERT ping
  removeBookmarkFromState: (id: string) => void;
}

export function useBookmarks(): UseBookmarksReturn {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // ── Initial fetch ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await bookmarkService.getAll();
        if (!cancelled) setBookmarks(data);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load bookmarks.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Re-fetch from DB ─────────────────────────────────────────────────────
  // Called by useRealtimeSync when an INSERT event is received.
  // We don't trust payload.new — we fetch fresh data instead.
  // This guarantees the other tab always gets the correct, up-to-date list.
  const refreshBookmarks = useCallback(async () => {
    try {
      const data = await bookmarkService.getAll();
      setBookmarks(data);
    } catch (err) {
      // Silent fail on refresh — the existing list stays visible.
      // Don't overwrite the error state here since this isn't the initial load.
      console.error("[useBookmarks] refreshBookmarks failed:", err);
    }
  }, []);

  // ── Direct state mutation (used for optimistic delete + Realtime DELETE) ─
  const removeBookmarkFromState = useCallback((id: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  // ── Add ──────────────────────────────────────────────────────────────────
  // Inserts into DB, then adds to local state immediately.
  // The Realtime INSERT event will cause OTHER tabs to call refreshBookmarks.
  // This tab doesn't need refreshBookmarks — it already has the bookmark.
  const addBookmark = useCallback(async (url: string, title: string): Promise<void> => {
    const newBookmark = await bookmarkService.create({ url, title });
    setBookmarks((prev) => {
      if (prev.some((b) => b.id === newBookmark.id)) return prev;
      return [newBookmark, ...prev];
    });
  }, []);

  // ── Delete ───────────────────────────────────────────────────────────────
  // Optimistic removal: updates UI immediately, rolls back on failure.
  const deleteBookmark = useCallback(async (id: string): Promise<void> => {
    const snapshot = bookmarks;
    removeBookmarkFromState(id);
    try {
      await bookmarkService.delete(id);
    } catch (err) {
      setBookmarks(snapshot);
      throw err;
    }
  }, [bookmarks, removeBookmarkFromState]);

  return {
    bookmarks,
    loading,
    error,
    addBookmark,
    deleteBookmark,
    refreshBookmarks,
    removeBookmarkFromState,
  };
}