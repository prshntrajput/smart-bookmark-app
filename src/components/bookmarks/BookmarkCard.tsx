"use client";

import Image from "next/image";
import { ExternalLink, Trash2, Globe, Sparkles, Loader2 } from "lucide-react";
import { Button }  from "@/components/ui/button";
import { cn }      from "@/lib/utils/cn";
import type { Bookmark }         from "@/types";
import type { BookmarkCategory } from "@/inngest/functions/enrich-bookmark";

interface BookmarkCardProps {
  bookmark:        Bookmark;
  onDeleteRequest: (bookmark: Bookmark) => void;
  isPendingAI?:    boolean;
}

const CATEGORY_STYLES: Record<BookmarkCategory | "Other", string> = {
  Development:   "bg-blue-100   text-blue-700   dark:bg-blue-900/30   dark:text-blue-400",
  Design:        "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  News:          "bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-400",
  Video:         "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  Learning:      "bg-green-100  text-green-700  dark:bg-green-900/30  dark:text-green-400",
  Tools:         "bg-teal-100   text-teal-700   dark:bg-teal-900/30   dark:text-teal-400",
  Entertainment: "bg-pink-100   text-pink-700   dark:bg-pink-900/30   dark:text-pink-400",
  Social:        "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  Reference:     "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  Other:         "bg-gray-100   text-gray-600   dark:bg-gray-800/50   dark:text-gray-400",
};

export function BookmarkCard({
  bookmark,
  onDeleteRequest,
  isPendingAI = false,
}: BookmarkCardProps) {
  const domain        = getDomain(bookmark.url);
  const formattedDate = formatDate(bookmark.created_at);
  const categoryStyle = bookmark.category
    ? (CATEGORY_STYLES[bookmark.category as BookmarkCategory] ?? CATEGORY_STYLES.Other)
    : null;

  return (
    <article className="group flex items-start gap-3 rounded-lg border bg-card p-4 shadow-sm transition-all duration-150 hover:shadow-md hover:border-border/80">

      {/* ── Favicon ─────────────────────────────────────────────────── */}
      <FaviconImage domain={domain} />

      {/* ── Main content ────────────────────────────────────────────── */}
      <div className="min-w-0 flex-1">

        {/* Title + external link */}
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

        {/* Domain · date · AI badge */}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="truncate text-xs text-muted-foreground">{domain}</span>
          <span className="text-xs text-muted-foreground/60">·</span>
          <time
            dateTime={bookmark.created_at}
            className="text-xs text-muted-foreground/60"
          >
            {formattedDate}
          </time>

          {/* AI Category badge — shown after enrichment completes */}
          {bookmark.enriched && bookmark.category && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                categoryStyle
              )}
            >
              <Sparkles className="h-2.5 w-2.5" />
              {bookmark.category}
            </span>
          )}

          {/* Pending AI badge — shown while Inngest is working */}
          {isPendingAI && !bookmark.enriched && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              AI analyzing…
            </span>
          )}
        </div>

        {/* AI Summary — shown after enrichment completes */}
        {bookmark.enriched && bookmark.summary && (
          <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
            {bookmark.summary}
          </p>
        )}
      </div>

      {/* ── Delete button ────────────────────────────────────────────── */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-8 w-8 shrink-0 text-muted-foreground",
          "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
          "hover:text-destructive hover:bg-destructive/10",
          "transition-opacity duration-150"
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
// Uses next/image with unoptimized=true because the src is an external
// Google CDN URL — Next.js image optimization doesn't apply to external URLs
// unless they're listed in next.config domains. unoptimized skips that check
// while still satisfying the no-img-element ESLint rule.
function FaviconImage({ domain }: { domain: string }) {
  return (
    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-muted">
      <Image
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
        alt=""
        width={16}
        height={16}
        unoptimized
        className="h-4 w-4"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
          const parent = (e.target as HTMLImageElement).parentElement;
          if (parent) {
            const fallback = parent.querySelector(
              "[data-fallback]"
            ) as HTMLElement | null;
            if (fallback) fallback.style.display = "block";
          }
        }}
      />
      <Globe
        data-fallback
        className="h-4 w-4 text-muted-foreground"
        style={{ display: "none" }}
      />
    </div>
  );
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now  = new Date();
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7)  return `${days}d ago`;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day:   "numeric",
    year:  date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  }).format(date);
}