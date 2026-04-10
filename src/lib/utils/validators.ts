/**
 * validators.ts — SRP: all validation logic lives here.
 * DRY: called by AddBookmarkForm and any future API route validation.
 */

export interface BookmarkValidationResult {
  valid:      boolean;
  urlError:   string | null;
  titleError: string | null;
}

/**
 * Validates bookmark url + title together.
 * Returns field-specific errors so the form can display them
 * next to the correct input.
 *
 * Accepts an object { url, title } — not two separate params.
 * This is the fixed signature that AddBookmarkForm expects.
 */
export function validateBookmark({
  url,
  title,
}: {
  url:   string;
  title: string;
}): BookmarkValidationResult {
  let urlError:   string | null = null;
  let titleError: string | null = null;

  // ── URL validation ──────────────────────────────────────────────────────
  if (!url.trim()) {
    urlError = "URL is required.";
  } else if (!isValidUrl(url.trim())) {
    urlError = "Enter a valid URL starting with http:// or https://";
  } else if (url.trim().length > 2048) {
    urlError = "URL must be under 2048 characters.";
  }

  // ── Title validation ────────────────────────────────────────────────────
  if (!title.trim()) {
    titleError = "Title is required.";
  } else if (title.trim().length > 255) {
    titleError = "Title must be under 255 characters.";
  }

  return {
    valid: urlError === null && titleError === null,
    urlError,
    titleError,
  };
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}