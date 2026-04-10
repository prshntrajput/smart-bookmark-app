"use client";

import { useState, useMemo, useCallback } from "react";
import { useBookmarks }      from "@/hooks/useBookmarks";
import { useRealtimeSync, type RealtimeStatus } from "@/hooks/useRealtimeSync";
import { AddBookmarkForm }   from "./AddBookmarkForm";
import { BookmarkList }      from "./BookmarkList";
import { SearchBar }         from "./SearchBar";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { cn }                from "@/lib/utils/cn";
import type { Bookmark }     from "@/types";

interface BookmarkManagerProps {
  userId: string;
}

export function BookmarkManager({ userId }: BookmarkManagerProps) {
  const {
    bookmarks,
    loading,
    error,
    addBookmark,
    deleteBookmark,
    refreshBookmarks,
    removeBookmarkFromState,
    updateBookmarkInState,
  } = useBookmarks();

  const { status: realtimeStatus, sendInsertNotification } = useRealtimeSync({
    userId,
    onInsertPing: refreshBookmarks,
    onDelete:     removeBookmarkFromState,
    onUpdate:     updateBookmarkInState,   // ← Feature B: AI enrichment arrives here
  });

  // ── Feature B: track which bookmarks are pending AI enrichment ────────────
  // Lives in memory — shows "AI analyzing…" badge until the UPDATE arrives.
  const [pendingAIIds, setPendingAIIds] = useState<Set<string>>(new Set());

  // ── Add bookmark ──────────────────────────────────────────────────────────
  const handleAddBookmark = useCallback(
    async (url: string, title: string): Promise<void> => {
      // 1. Insert into DB → get back the created bookmark (with its id)
      const newBookmark = await addBookmark(url, title);

      // 2. Broadcast to other tabs via Supabase Broadcast
      sendInsertNotification();

      // 3. Mark as pending AI enrichment → shows "AI analyzing…" badge
      setPendingAIIds((prev) => new Set([...prev, newBookmark.id]));

      // 4. Send event to Inngest (fire-and-forget, don't await)
      // Non-blocking: if this fails the bookmark is still saved.
      triggerEnrichment(newBookmark).catch((err) => {
        console.warn("[Inngest] Enrichment trigger failed:", err);
        // Remove from pending — AI badge disappears gracefully
        setPendingAIIds((prev) => {
          const next = new Set(prev);
          next.delete(newBookmark.id);
          return next;
        });
      });
    },
    [addBookmark, sendInsertNotification]
  );

  // When the UPDATE realtime event arrives (enriched = true),
  // remove the bookmark from the pending set so the badge switches
  // from "AI analyzing…" to the category chip.
  // We wrap updateBookmarkInState to also clear the pending ID.
  const handleUpdate = useCallback(
    (bookmark: Bookmark) => {
      updateBookmarkInState(bookmark);
      if (bookmark.enriched) {
        setPendingAIIds((prev) => {
          const next = new Set(prev);
          next.delete(bookmark.id);
          return next;
        });
      }
    },
    [updateBookmarkInState]
  );

  // ── Delete modal state ────────────────────────────────────────────────────
  const [bookmarkToDelete, setBookmarkToDelete] = useState<Bookmark | null>(null);
  const [isDeleting,       setIsDeleting]       = useState(false);
  const [deleteError,      setDeleteError]      = useState<string | null>(null);

  const handleDeleteRequest = useCallback((bookmark: Bookmark) => {
    setBookmarkToDelete(bookmark);
    setDeleteError(null);
  }, []);

  const handleCancelDelete = useCallback(() => {
    if (isDeleting) return;
    setBookmarkToDelete(null);
    setDeleteError(null);
  }, [isDeleting]);

  const handleConfirmDelete = useCallback(async () => {
    if (!bookmarkToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteBookmark(bookmarkToDelete.id);
      setBookmarkToDelete(null);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete. Try again."
      );
    } finally {
      setIsDeleting(false);
    }
  }, [bookmarkToDelete, deleteBookmark]);

  // ── Search ────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");

  const filteredBookmarks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return bookmarks;
    return bookmarks.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.url.toLowerCase().includes(q)   ||
        (b.category?.toLowerCase().includes(q) ?? false) // also search by AI category
    );
  }, [bookmarks, searchQuery]);

  return (
    <>
      <div className="space-y-6">
        <AddBookmarkForm onAdd={handleAddBookmark} />

        <div className="space-y-4">
          {!loading && !error && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {bookmarks.length > 0
                  ? `${bookmarks.length} bookmark${bookmarks.length !== 1 ? "s" : ""}`
                  : "No bookmarks yet"}
              </p>
              <RealtimeIndicator status={realtimeStatus} />
            </div>
          )}

          {(bookmarks.length > 0 || loading) && (
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              resultCount={filteredBookmarks.length}
              totalCount={bookmarks.length}
            />
          )}

          <BookmarkList
            bookmarks={filteredBookmarks}
            loading={loading}
            error={error}
            onDeleteRequest={handleDeleteRequest}
            pendingAIIds={pendingAIIds}
            searchQuery={searchQuery}
          />
        </div>
      </div>

      <DeleteConfirmModal
        bookmark={bookmarkToDelete}
        isDeleting={isDeleting}
        deleteError={deleteError}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </>
  );
}

// ── triggerEnrichment (module-level util) ────────────────────────────────────
async function triggerEnrichment(bookmark: Bookmark): Promise<void> {
  const res = await fetch("/api/trigger-enrichment", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      bookmarkId: bookmark.id,
      url:        bookmark.url,
      title:      bookmark.title,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Trigger failed (${res.status})`);
  }
}

// ── RealtimeIndicator (unchanged) ────────────────────────────────────────────
const STATUS_CONFIG: Record<RealtimeStatus, { dot: string; label: string; text: string }> = {
  connecting:   { dot: "bg-amber-400 animate-pulse", label: "Connecting…", text: "text-amber-600 dark:text-amber-400" },
  connected:    { dot: "bg-emerald-500",             label: "Live",        text: "text-emerald-600 dark:text-emerald-400" },
  disconnected: { dot: "bg-red-400",                 label: "Offline",     text: "text-red-500 dark:text-red-400" },
};

function RealtimeIndicator({ status }: { status: RealtimeStatus }) {
  const { dot, label, text } = STATUS_CONFIG[status];
  return (
    <span className={cn("flex items-center gap-1.5 text-xs font-medium", text)} role="status">
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} aria-hidden="true" />
      {label}
    </span>
  );
}