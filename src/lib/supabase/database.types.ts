

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      bookmarks: {
        /**
         * The shape of a row returned from SELECT queries.
         * All fields are non-nullable — they all have DB-level defaults or constraints.
         */
        Row: {
          id: string;          // UUID — gen_random_uuid() primary key
          user_id: string;     // UUID — references auth.users(id) ON DELETE CASCADE
          url: string;         // TEXT — max 2048 chars, enforced by CHECK constraint
          title: string;       // TEXT — max 255 chars, enforced by CHECK constraint
          created_at: string;  // TIMESTAMPTZ — auto-set on INSERT
          updated_at: string;  // TIMESTAMPTZ — auto-updated via trigger on UPDATE
        };
        /**
         * Shape for INSERT operations.
         * id, user_id, created_at, updated_at have DB defaults — all optional here.
         * RLS INSERT policy enforces that user_id === auth.uid().
         */
        Insert: {
          id?: string;
          user_id?: string;
          url: string;
          title: string;
          created_at?: string;
          updated_at?: string;
        };
        /**
         * Shape for UPDATE operations.
         * Only url and title are meaningful to update from the app.
         */
        Update: {
          id?: string;
          user_id?: string;
          url?: string;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
        /**
         * Relationships — used by Supabase for type-safe joins.
         */
        Relationships: [
          {
            foreignKeyName: "bookmarks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

// ─── Convenience type aliases ───────────────────────────────────────────────
// Use these throughout the app instead of the verbose nested path.

export type BookmarkRow = Database["public"]["Tables"]["bookmarks"]["Row"];
export type BookmarkInsert = Database["public"]["Tables"]["bookmarks"]["Insert"];
export type BookmarkUpdate = Database["public"]["Tables"]["bookmarks"]["Update"];
