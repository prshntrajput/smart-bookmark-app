/**
 * Shared TypeScript interfaces for the entire application.
 *
 * DRY principle: define shapes once, import everywhere.
 * These mirror the database schema in database.types.ts
 * but are decoupled from Supabase internals.
 */

export interface Bookmark {
  id: string;
  user_id: string;
  url: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AppUser {
  id: string;
  email: string | undefined;
  full_name: string | undefined;
  avatar_url: string | undefined;
}

/** Used when creating a new bookmark — id and timestamps are DB-generated */
export type BookmarkInsert = Pick<Bookmark, "url" | "title">;

/** Used when updating an existing bookmark */
export type BookmarkUpdate = Partial<BookmarkInsert>;

/** Realtime event payload from Supabase */
export type RealtimeBookmarkPayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Bookmark | null;
  old: { id: string } | null;
};
