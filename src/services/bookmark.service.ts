import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";
import type { Bookmark, BookmarkInsert } from "@/types";

function getSupabase() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export const bookmarkService = {
  async getAll(): Promise<Bookmark[]> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("bookmarks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as Bookmark[];
  },

  async create(data: BookmarkInsert): Promise<Bookmark> {
    const supabase = getSupabase();

    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      throw new Error("You must be signed in to add bookmarks.");
    }

    const insertPayload: Database["public"]["Tables"]["bookmarks"]["Insert"] = {
      url:     data.url,
      title:   data.title,
      user_id: session.user.id,
    };

    const { data: bookmark, error } = await supabase
      .from("bookmarks")
      .insert(insertPayload as never)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return bookmark as Bookmark;
  },

  async delete(id: string): Promise<void> {
    const supabase = getSupabase();

    const { error } = await supabase
      .from("bookmarks")
      .delete()
      .eq("id", id);

    if (error) throw new Error(error.message);
  },
};
