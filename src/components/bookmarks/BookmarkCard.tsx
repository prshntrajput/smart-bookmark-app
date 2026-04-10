"use client";

import { ExternalLink, Trash2, Globe } from "lucide-react";
import { Button }   from "@/components/ui/button";
import { cn }       from "@/lib/utils/cn";
import type { Bookmark } from "@/types";

interface BookmarkCardProps {
  bookmark: Bookmark;

  onDeleteRequest: (bookmark: Bookmark) => void;
}

export function BookmarkCard({ bookmark, onDeleteRequest }: BookmarkCardProps) {
  const domain        = getDomain(bookmark.url);
  const formattedDate = formatDate(bookmark.created_at);

  return (
    <article className="group flex items-start gap-3 rounded-lg border bg-card p-4 shadow-sm transition-all duration-150 hover:shadow-md hover:border-border/80">

      {/* ── Favicon ─────────────────────────────────────────────────── */}
      <FaviconImage domain={domain} />

      {/* ── Main content ────────────────────────────────────────────── */}
      <div className="min-w-0 flex-1">
        <a
          href={bookmark.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group/link flex items-center gap-1.5"
        >
          <span className="line-clamp-1 text-sm font-medium group-hover/link:underline">
            {bookmark.title}
          </span>
          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/link:opacity-100" />
        </a>

        <div className="mt-1 flex items-center gap-2">
          <span className="truncate text-xs text-muted-foreground">
            {domain}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground/60">·</span>
          <time
            dateTime={bookmark.created_at}
            className="shrink-0 text-xs text-muted-foreground/60"
          >
            {formattedDate}
          </time>
        </div>
      </div>

      {/* ── Delete trigger ───────────────────────────────────────────── */}
      {/* Calls onDeleteRequest(bookmark) — opens the confirmation modal.
          Does NOT delete directly. Step 7 requirement: confirmation step. */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-8 w-8 shrink-0 text-muted-foreground",
          "transition-opacity duration-150",
          "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
          "hover:text-destructive hover:bg-destructive/10"
        )}
        onClick={() => onDeleteRequest(bookmark)}
        aria-label={`Delete bookmark: ${bookmark.title}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </article>
  );
}

// ─── FaviconImage ─────────────────────────────────────────────────────────────
function FaviconImage({ domain }: { domain: string }) {
  const src = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  return (
    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-muted">
      <img
        src={src}
        alt=""
        width={16}
        height={16}
        loading="lazy"
        className="h-4 w-4"
        onError={(e) => {
          const parent = (e.target as HTMLImageElement).parentElement;
          if (parent) {
            (e.target as HTMLImageElement).style.display = "none";
            const globe = parent.querySelector("[data-favicon-fallback]");
            if (globe) (globe as HTMLElement).style.display = "block";
          }
        }}
      />
      <Globe
        data-favicon-fallback
        className="h-4 w-4 text-muted-foreground"
        style={{ display: "none" }}
      />
    </div>
  );
}

// ─── Pure utilities ───────────────────────────────────────────────────────────
function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now   = new Date();
  const days  = Math.floor((now.getTime() - date.getTime()) / 86_400_000);

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7)  return `${days}d ago`;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day:   "numeric",
    year:  date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  }).format(date);
}