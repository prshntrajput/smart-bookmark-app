"use client";

import { useState, useEffect, useCallback } from "react";
import { bookmarkService }                  from "@/services/bookmark.service";
import type { Bookmark }                    from "@/types";

interface UseBookmarksReturn {
  bookmarks:             Bookmark[];
  loading:               boolean;
  error:                 string | null;
  addBookmark:           (url: string, title: string) => Promise<Bookmark>; // now returns Bookmark
  deleteBookmark:        (id: string)       => Promise<void>;
  refreshBookmarks:      ()                 => Promise<void>;
  removeBookmarkFromState: (id: string)     => void;
  updateBookmarkInState:   (bookmark: Bookmark) => void; // NEW for Feature B
}

export function useBookmarks(): UseBookmarksReturn {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  // ── Initial fetch ─────────────────────────────────────────────────────────
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

  // ── Refresh ───────────────────────────────────────────────────────────────
  const refreshBookmarks = useCallback(async () => {
    try {
      const data = await bookmarkService.getAll();
      setBookmarks(data);
    } catch (err) {
      console.error("[useBookmarks] refresh failed:", err);
    }
  }, []);

  // ── State mutations ───────────────────────────────────────────────────────
  const removeBookmarkFromState = useCallback((id: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  /**
   * updateBookmarkInState — called by useRealtimeSync when Supabase
   * broadcasts an UPDATE event (i.e. after Inngest enriches the bookmark).
   * Merges the updated fields into the existing bookmark in state.
   */
  const updateBookmarkInState = useCallback((updated: Bookmark) => {
    setBookmarks((prev) =>
      prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b))
    );
  }, []);

  // ── Add ───────────────────────────────────────────────────────────────────
  // Changed: now returns the created Bookmark so BookmarkManager
  // can pass its id to the Inngest trigger.
  const addBookmark = useCallback(
    async (url: string, title: string): Promise<Bookmark> => {
      const newBookmark = await bookmarkService.create({ url, title });
      setBookmarks((prev) => {
        if (prev.some((b) => b.id === newBookmark.id)) return prev;
        return [newBookmark, ...prev];
      });
      return newBookmark;
    },
    []
  );

  // ── Delete ────────────────────────────────────────────────────────────────
  const deleteBookmark = useCallback(
    async (id: string): Promise<void> => {
      const snapshot = bookmarks;
      removeBookmarkFromState(id);
      try {
        await bookmarkService.delete(id);
      } catch (err) {
        setBookmarks(snapshot);
        throw err;
      }
    },
    [bookmarks, removeBookmarkFromState]
  );

  return {
    bookmarks,
    loading,
    error,
    addBookmark,
    deleteBookmark,
    refreshBookmarks,
    removeBookmarkFromState,
    updateBookmarkInState,
  };
}