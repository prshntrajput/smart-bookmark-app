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
  } = useBookmarks();

  const { status: realtimeStatus, sendInsertNotification } = useRealtimeSync({
    userId,
    onInsertPing: refreshBookmarks,
    onDelete: removeBookmarkFromState,
  });

  // ── Delete modal state ───────────────────────────────────────────────────
  const [bookmarkToDelete, setBookmarkToDelete] = useState<Bookmark | null>(null);
  const [isDeleting, setIsDeleting]             = useState(false);
  const [deleteError, setDeleteError]           = useState<string | null>(null);

  /** Step 1 of delete flow: user clicks 🗑 → open confirmation modal */
  const handleDeleteRequest = useCallback((bookmark: Bookmark) => {
    setBookmarkToDelete(bookmark);
    setDeleteError(null); // clear any previous error
  }, []);

  /** Step 2: user clicks "Cancel" → close modal, no action */
  const handleCancelDelete = useCallback(() => {
    if (isDeleting) return; // block cancel mid-flight
    setBookmarkToDelete(null);
    setDeleteError(null);
  }, [isDeleting]);

 
  const handleConfirmDelete = useCallback(async () => {
    if (!bookmarkToDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteBookmark(bookmarkToDelete.id);
      // Success: close the modal
      setBookmarkToDelete(null);
    } catch (err) {
      // Failure: show error inside modal, keep it open.
      // useBookmarks.deleteBookmark already rolled back the optimistic removal.
      setDeleteError(
        err instanceof Error
          ? err.message
          : "Failed to delete bookmark. Please try again."
      );
    } finally {
      setIsDeleting(false);
    }
  }, [bookmarkToDelete, deleteBookmark]);

  // ── Add bookmark ─────────────────────────────────────────────────────────
  const handleAddBookmark = useCallback(
    async (url: string, title: string): Promise<void> => {
      await addBookmark(url, title);
      sendInsertNotification();
    },
    [addBookmark, sendInsertNotification]
  );

  // ── Search ────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");

  const filteredBookmarks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return bookmarks;
    return bookmarks.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.url.toLowerCase().includes(q)
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
            searchQuery={searchQuery}
          />
        </div>
      </div>

      {/* ── Delete confirmation modal ───────────────────────────────────── */}
      {/* Rendered outside the list so it's never clipped by overflow styles */}
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

// ─── RealtimeIndicator ────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<RealtimeStatus, { dot: string; label: string; text: string }> = {
  connecting: {
    dot:   "bg-amber-400 animate-pulse",
    label: "Connecting…",
    text:  "text-amber-600 dark:text-amber-400",
  },
  connected: {
    dot:   "bg-emerald-500",
    label: "Live",
    text:  "text-emerald-600 dark:text-emerald-400",
  },
  disconnected: {
    dot:   "bg-red-400",
    label: "Offline",
    text:  "text-red-500 dark:text-red-400",
  },
};

function RealtimeIndicator({ status }: { status: RealtimeStatus }) {
  const { dot, label, text } = STATUS_CONFIG[status];
  return (
    <span
      className={cn("flex items-center gap-1.5 text-xs font-medium", text)}
      role="status"
      aria-label={`Real-time sync status: ${label}`}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} aria-hidden="true" />
      {label}
    </span>
  );
}