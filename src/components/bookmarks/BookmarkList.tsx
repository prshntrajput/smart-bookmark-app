"use client";

import { BookmarkCard }   from "./BookmarkCard";
import { EmptyState }     from "./EmptyState";
import { Skeleton }       from "@/components/ui/skeleton";
import { Button }         from "@/components/ui/button";
import { AlertCircle }    from "lucide-react";
import type { Bookmark }  from "@/types";

interface BookmarkListProps {
  bookmarks: Bookmark[];
  loading: boolean;
  error: string | null;
  /** Updated: receives full bookmark object for the confirmation modal */
  onDeleteRequest: (bookmark: Bookmark) => void;
  searchQuery?: string;
}

export function BookmarkList({
  bookmarks,
  loading,
  error,
  onDeleteRequest,
  searchQuery = "",
}: BookmarkListProps) {

  // ── 1. Loading ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-2" aria-label="Loading bookmarks" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <BookmarkCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // ── 2. Error ──────────────────────────────────────────────────────────
  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 py-10 text-center"
      >
        <AlertCircle className="h-8 w-8 text-destructive/70" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-destructive">
            Failed to load bookmarks
          </p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </div>
    );
  }

  // ── 3. Empty ──────────────────────────────────────────────────────────
  if (bookmarks.length === 0) {
    if (searchQuery.trim()) {
      return (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="text-sm font-medium">
            No results for &ldquo;{searchQuery}&rdquo;
          </p>
          <p className="text-xs text-muted-foreground">
            Try a different search term.
          </p>
        </div>
      );
    }
    return <EmptyState />;
  }

  // ── 4. Populated list ─────────────────────────────────────────────────
  return (
    <section aria-label="Your bookmarks">
      {searchQuery.trim() && (
        <p className="mb-3 text-xs text-muted-foreground">
          {bookmarks.length} result{bookmarks.length !== 1 ? "s" : ""} for&nbsp;
          &ldquo;{searchQuery}&rdquo;
        </p>
      )}

      <ul className="space-y-2">
        {bookmarks.map((bookmark) => (
          <li key={bookmark.id}>
            <BookmarkCard
              bookmark={bookmark}
              onDeleteRequest={onDeleteRequest}
            />
          </li>
        ))}
      </ul>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        {bookmarks.length} bookmark{bookmarks.length !== 1 ? "s" : ""}
      </p>
    </section>
  );
}

// ─── BookmarkCardSkeleton ─────────────────────────────────────────────────────
function BookmarkCardSkeleton() {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-4 shadow-sm">
      <Skeleton className="mt-0.5 h-8 w-8 shrink-0 rounded-md" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-3 w-2/5" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
    </div>
  );
}