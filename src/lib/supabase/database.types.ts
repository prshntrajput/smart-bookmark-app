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
        Row: {
          id:         string;
          user_id:    string;
          url:        string;
          title:      string;
          created_at: string;
          updated_at: string;
          category:   string | null;  // ← ADD (migration 004)
          summary:    string | null;  // ← ADD (migration 004)
          enriched:   boolean;        // ← ADD (migration 004)
        };
        Insert: {
          id?:        string;
          user_id?:   string;
          url:        string;
          title:      string;
          created_at?: string;
          updated_at?: string;
          category?:  string | null;  // ← ADD
          summary?:   string | null;  // ← ADD
          enriched?:  boolean;        // ← ADD
        };
        Update: {
          id?:        string;
          user_id?:   string;
          url?:       string;
          title?:     string;
          created_at?: string;
          updated_at?: string;
          category?:  string | null;  // ← ADD
          summary?:   string | null;  // ← ADD
          enriched?:  boolean;        // ← ADD
        };
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
    Views:          { [_ in never]: never };
    Functions:      { [_ in never]: never };
    Enums:          { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

export type BookmarkRow    = Database["public"]["Tables"]["bookmarks"]["Row"];
export type BookmarkInsert = Database["public"]["Tables"]["bookmarks"]["Insert"];
export type BookmarkUpdate = Database["public"]["Tables"]["bookmarks"]["Update"];