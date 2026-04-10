export interface Bookmark {
  id:         string;
  user_id:    string;
  url:        string;
  title:      string;
  created_at: string;
  updated_at: string;
  category:   string | null;   // ← remove ?, DB always returns this (nullable, not missing)
  summary:    string | null;   // ← remove ?, DB always returns this (nullable, not missing)
  enriched:   boolean;         // ← remove ?, DB always returns this (defaults to false)
}

export interface AppUser {
  id:         string;
  email:      string | undefined;
  full_name:  string | undefined;
  avatar_url: string | undefined;
}

/** Used when creating a new bookmark — id, user_id and timestamps are DB-generated */
export type BookmarkInsert = Pick<Bookmark, "url" | "title">;

// ── Feature A: URL Metadata ──────────────────────────────────────────────────
export interface UrlMetadata {
  title:       string | null;
  description: string | null;
  image:       string | null;
}

/** Used when updating an existing bookmark */
export type BookmarkUpdate = Partial<BookmarkInsert>;

/** Realtime event payload from Supabase */
export type RealtimeBookmarkPayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new:       Bookmark | null;
  old:       { id: string } | null;
};
