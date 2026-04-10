"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { UrlMetadata } from "@/types";

interface UseUrlMetadataReturn {
  metadata:      UrlMetadata | null;
  loading:       boolean;
  error:         string | null;
  /** Manually trigger a fetch (e.g. on button click) */
  fetchNow:      (url: string) => Promise<void>;
  clearMetadata: () => void;
}

/**
 * useUrlMetadata — fetches Open Graph metadata for a URL.
 *
 * Behaviour:
 *   - Auto-fetches with a 700ms debounce when `url` changes.
 *   - Only fetches when the URL is a valid http/https URL.
 *   - If the component unmounts mid-fetch, the result is discarded.
 *   - `fetchNow` allows the AddBookmarkForm "Fetch title" button to
 *     trigger an immediate fetch without waiting for the debounce.
 *
 * SRP: this hook only fetches and returns metadata.
 * The form decides what to do with it (auto-fill, show description, etc.)
 */
export function useUrlMetadata(url: string): UseUrlMetadataReturn {
  const [metadata, setMetadata] = useState<UrlMetadata | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  // Tracks the URL of the last successful fetch.
  // Used to avoid re-fetching when the user edits the title field
  // (which re-renders the form but url hasn't changed).
  const lastFetchedUrl = useRef<string>("");

  const isValidHttpUrl = useCallback((raw: string): boolean => {
    try {
      const u = new URL(raw);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, []);

  const fetchMetadata = useCallback(
    async (targetUrl: string): Promise<void> => {
      if (!isValidHttpUrl(targetUrl)) return;

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/fetch-metadata?url=${encodeURIComponent(targetUrl)}`
        );

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }

        const data: UrlMetadata = await res.json();
        setMetadata(data);
        lastFetchedUrl.current = targetUrl;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not fetch page info."
        );
        setMetadata(null);
      } finally {
        setLoading(false);
      }
    },
    [isValidHttpUrl]
  );

  // ── Debounced auto-fetch ────────────────────────────────────────────────
  useEffect(() => {
    // Clear previous metadata when URL is cleared or becomes invalid
    if (!url || !isValidHttpUrl(url)) {
      setMetadata(null);
      setError(null);
      lastFetchedUrl.current = "";
      return;
    }

    // Skip fetch if we already have metadata for this exact URL
    if (url === lastFetchedUrl.current) return;

    const timer = setTimeout(() => {
      fetchMetadata(url);
    }, 700);

    return () => clearTimeout(timer);
  }, [url, fetchMetadata, isValidHttpUrl]);

  const clearMetadata = useCallback(() => {
    setMetadata(null);
    setError(null);
    lastFetchedUrl.current = "";
  }, []);

  return {
    metadata,
    loading,
    error,
    fetchNow: fetchMetadata,
    clearMetadata,
  };
}