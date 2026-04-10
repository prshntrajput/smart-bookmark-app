"use client";

import { useState } from "react";
import { Plus, Link2, Type, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils/cn";
import { validateBookmark } from "@/lib/utils/validators";

interface AddBookmarkFormProps {
  onAdd: (url: string, title: string) => Promise<void>;
}

/**
 * AddBookmarkForm — Client Component
 *
 * SRP: only manages the add-bookmark form state.
 * It does not know about the bookmark list or deletion.
 *
 * Validation strategy:
 *   1. Client-side (validateBookmark) — immediate, field-level feedback
 *   2. Service throws on DB error — caught here and shown as a form error
 *
 */
export function AddBookmarkForm({ onAdd }: AddBookmarkFormProps) {
  const [url, setUrl]             = useState("");
  const [title, setTitle]         = useState("");
  const [urlError, setUrlError]   = useState("");
  const [titleError, setTitleError] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess]   = useState(false);

  const clearErrors = () => {
    setUrlError("");
    setTitleError("");
    setFormError("");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearErrors();
    setShowSuccess(false);

    // Client-side validation
    const result = validateBookmark(url, title);
    if (!result.valid && result.error) {
      const msg = result.error.toLowerCase();
      if (msg.includes("url")) setUrlError(result.error);
      else setTitleError(result.error);
      return;
    }

    try {
      setIsSubmitting(true);
      await onAdd(url.trim(), title.trim());

      // Success: clear form + show brief confirmation
      setUrl("");
      setTitle("");
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to add bookmark. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label="Add a bookmark"
      className="rounded-xl border bg-card p-5 shadow-sm"
    >
      <h2 className="mb-4 text-sm font-semibold">Add a bookmark</h2>

      <div className="grid gap-3 sm:grid-cols-2">

        {/* ── URL field ─────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="bookmark-url">URL</Label>
          <div className="relative">
            <Link2 className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              id="bookmark-url"
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (urlError) setUrlError("");
              }}
              className={cn(
                "pl-9",
                urlError && "border-destructive focus-visible:ring-destructive"
              )}
              disabled={isSubmitting}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          {urlError && (
            <p role="alert" className="text-xs text-destructive">
              {urlError}
            </p>
          )}
        </div>

        {/* ── Title field ───────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="bookmark-title">Title</Label>
          <div className="relative">
            <Type className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              id="bookmark-title"
              type="text"
              placeholder="My favourite article"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleError) setTitleError("");
              }}
              className={cn(
                "pl-9",
                titleError && "border-destructive focus-visible:ring-destructive"
              )}
              disabled={isSubmitting}
              autoComplete="off"
            />
          </div>
          {titleError && (
            <p role="alert" className="text-xs text-destructive">
              {titleError}
            </p>
          )}
        </div>
      </div>

      {/* ── Form-level error (DB errors) ──────────────────────────── */}
      {formError && (
        <p role="alert" className="mt-3 text-xs text-destructive">
          {formError}
        </p>
      )}

      {/* ── Footer: success feedback + submit button ──────────────── */}
      <div className="mt-4 flex items-center justify-between gap-3">
        {/* Success message fades in after add */}
        <div
          className={cn(
            "flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400 transition-opacity duration-300",
            showSuccess ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          aria-live="polite"
        >
          <Check className="h-3.5 w-3.5" />
          <span>Bookmark added!</span>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting || !url.trim() || !title.trim()}
          className="ml-auto gap-2"
        >
          {isSubmitting ? <Spinner size="sm" /> : <Plus className="h-4 w-4" />}
          {isSubmitting ? "Adding…" : "Add Bookmark"}
        </Button>
      </div>
    </form>
  );
}