"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus, Link2, Type, Check,
  Sparkles, RefreshCw, AlertCircle,
} from "lucide-react";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import { Spinner }  from "@/components/ui/spinner";
import { cn }       from "@/lib/utils/cn";
import { validateBookmark } from "@/lib/utils/validators";
import { useUrlMetadata }   from "@/hooks/useUrlMetadata";

interface AddBookmarkFormProps {
  onAdd: (url: string, title: string) => Promise<void>;
}

/**
 * AddBookmarkForm — Feature A update.
 *
 * New behaviour:
 *   1. As the user types a valid URL, useUrlMetadata auto-fetches
 *      the page's Open Graph metadata after a 700ms debounce.
 *   2. If the title field is empty (or was auto-filled by us),
 *      the og:title is applied automatically.
 *   3. A "✨ Auto-filled" badge shows when the title came from metadata.
 *   4. A "Refresh" button lets the user re-fetch if needed.
 *   5. Description (og:description) shows as a helpful hint below the title.
 *   6. If user manually types in the title field, we stop overriding it.
 */
export function AddBookmarkForm({ onAdd }: AddBookmarkFormProps) {
  const [url,     setUrl]     = useState("");
  const [title,   setTitle]   = useState("");
  const [urlErr,  setUrlErr]  = useState<string | null>(null);
  const [titleErr,setTitleErr]= useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);

  // Track whether the current title was auto-filled (not manually typed)
  const [titleAutoFilled, setTitleAutoFilled] = useState(false);

  // Ref to detect user-initiated title edits vs programmatic ones
  const titleManuallyEdited = useRef(false);

  const {
    metadata,
    loading:  metaLoading,
    error:    metaError,
    fetchNow,
    clearMetadata,
  } = useUrlMetadata(url);

  // ── Auto-fill title when metadata arrives ────────────────────────────────
  useEffect(() => {
    if (!metadata?.title) return;

    // Only auto-fill if the user hasn't manually typed a title
    if (!titleManuallyEdited.current || titleAutoFilled) {
      setTitle(metadata.title);
      setTitleAutoFilled(true);
      setTitleErr(null);
    }
  }, [metadata?.title, titleAutoFilled]);

  // ── Clear auto-fill badge when URL is cleared ────────────────────────────
  useEffect(() => {
    if (!url) {
      setTitleAutoFilled(false);
      titleManuallyEdited.current = false;
    }
  }, [url]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleTitleChange(value: string) {
    setTitle(value);
    setTitleErr(null);
    setTitleAutoFilled(false);
    titleManuallyEdited.current = true;
  }

  function handleUrlChange(value: string) {
    setUrl(value);
    setUrlErr(null);
    // Reset title state when URL changes so new metadata can auto-fill
    if (titleAutoFilled) {
      setTitle("");
      setTitleAutoFilled(false);
      titleManuallyEdited.current = false;
    }
  }

 async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();

  // ── FIXED: pass object { url, title } not (url, title) separately ──────
  const validation = validateBookmark({ url: url.trim(), title: title.trim() });

  if (!validation.valid) {
    setUrlErr(validation.urlError);
    setTitleErr(validation.titleError);
    return;
  }

  setSubmitting(true);
  try {
    await onAdd(url.trim(), title.trim());
    // Success — reset form
    setUrl("");
    setTitle("");
    setTitleAutoFilled(false);
    titleManuallyEdited.current = false;
    clearMetadata();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2_000);
  } catch (err) {
    setUrlErr(
      err instanceof Error ? err.message : "Failed to add bookmark."
    );
  } finally {
    setSubmitting(false);
  }
}

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-xl border bg-card p-5 shadow-sm space-y-4"
    >
      <h2 className="text-sm font-semibold">Add Bookmark</h2>

      {/* ── URL field ──────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label htmlFor="bookmark-url" className="text-xs font-medium">
          URL
        </Label>
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="bookmark-url"
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              disabled={submitting}
              aria-invalid={!!urlErr}
              aria-describedby={urlErr ? "url-error" : undefined}
              className={cn(
                "pl-9",
                urlErr && "border-destructive focus-visible:ring-destructive"
              )}
            />
          </div>

          {/* Refresh / re-fetch button — only shown when there's a valid URL */}
          {url && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              disabled={metaLoading || submitting}
              onClick={() => {
                titleManuallyEdited.current = false;
                setTitleAutoFilled(false);
                clearMetadata();
                setTitle("");
                fetchNow(url);
              }}
              aria-label="Re-fetch page title"
              title="Re-fetch page title"
            >
              {metaLoading ? (
                <Spinner size="sm" />
              ) : (
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          )}
        </div>

        {urlErr && (
          <p id="url-error" role="alert" className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {urlErr}
          </p>
        )}

        {/* Metadata fetch status — subtle, below the URL input */}
        {metaLoading && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Spinner size="sm" />
            Fetching page info…
          </p>
        )}
        {metaError && !metaLoading && (
          <p className="text-xs text-muted-foreground">
            Could not auto-fetch title — enter it manually below.
          </p>
        )}
      </div>

      {/* ── Title field ────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="bookmark-title" className="text-xs font-medium">
            Title
          </Label>
          {/* Auto-filled badge */}
          {titleAutoFilled && (
            <span className="flex items-center gap-1 text-xs font-medium text-primary">
              <Sparkles className="h-3 w-3" />
              Auto-filled
            </span>
          )}
        </div>

        <div className="relative">
          <Type className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="bookmark-title"
            type="text"
            placeholder={
              metaLoading
                ? "Fetching title…"
                : "My favourite article"
            }
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            disabled={submitting}
            aria-invalid={!!titleErr}
            aria-describedby={
              titleErr
                ? "title-error"
                : metadata?.description
                ? "title-hint"
                : undefined
            }
            className={cn(
              "pl-9",
              titleErr && "border-destructive focus-visible:ring-destructive",
              titleAutoFilled && "border-primary/40 bg-primary/5"
            )}
          />
        </div>

        {titleErr && (
          <p id="title-error" role="alert" className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {titleErr}
          </p>
        )}

        {/* og:description hint — shown when metadata has a description */}
        {metadata?.description && !titleErr && (
          <p
            id="title-hint"
            className="line-clamp-2 text-xs text-muted-foreground"
          >
            {metadata.description}
          </p>
        )}
      </div>

      {/* ── Submit ─────────────────────────────────────────────────────── */}
      <Button
        type="submit"
        disabled={submitting || submitted}
        className="w-full gap-2"
      >
        {submitted ? (
          <>
            <Check className="h-4 w-4" />
            Saved!
          </>
        ) : submitting ? (
          <>
            <Spinner size="sm" />
            Saving…
          </>
        ) : (
          <>
            <Plus className="h-4 w-4" />
            Add Bookmark
          </>
        )}
      </Button>
    </form>
  );
}