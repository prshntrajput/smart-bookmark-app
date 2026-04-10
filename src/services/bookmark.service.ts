/**
 * Bookmark Service — SRP
 *
 * The ONLY module that touches Supabase for bookmark operations.
 * Hooks and components call this — never Supabase directly.
 *
 * Full implementation: getAll, create, delete
 */

import { createClient } from "@/lib/supabase/client";
import { SUPABASE_TABLES } from "@/constants";
import type { Bookmark, BookmarkInsert } from "@/types";

export const bookmarkService = {
  /**
   * Fetch all bookmarks for the current user.
   *
   * We do NOT filter by user_id here — that's handled automatically
   * by the RLS SELECT policy at the DB level.
   * Ordered newest-first.
   */
  async getAll(): Promise<Bookmark[]> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from(SUPABASE_TABLES.BOOKMARKS)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  },

  /**
   * Insert a new bookmark for the current user.
   *
   * We must explicitly include user_id because our RLS INSERT policy
   * enforces: WITH CHECK ((SELECT auth.uid()) = user_id).
   * If user_id is missing or doesn't match auth.uid(), the DB rejects it.
   *
   * getSession() is safe in the browser — it reads from the local
   * cookie with no extra network request.
   */
  async create(data: BookmarkInsert): Promise<Bookmark> {
    const supabase = createClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      throw new Error("You must be signed in to add bookmarks.");
    }

    const { data: bookmark, error } = await supabase
      .from(SUPABASE_TABLES.BOOKMARKS)
      .insert({ ...data, user_id: session.user.id })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return bookmark;
  },

  /**
   * Delete a bookmark by ID.
   *
   * RLS DELETE policy ensures users can only delete their own rows.
   * A user cannot delete another user's bookmark even if they know the ID.
   *
   * UX note: Step 7 adds a confirmation modal BEFORE this is called.
   * This method just does the raw delete — it does not confirm anything.
   */
  async delete(id: string): Promise<void> {
    const supabase = createClient();

    const { error } = await supabase
      .from(SUPABASE_TABLES.BOOKMARKS)
      .delete()
      .eq("id", id);

    if (error) throw new Error(error.message);
  },
};