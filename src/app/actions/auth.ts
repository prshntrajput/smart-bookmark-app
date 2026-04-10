"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ROUTES } from "@/constants";

/**
 * Server Action — Sign Out
 *
 * Why a Server Action instead of a client-side call?
 * - Runs on the server → clears the HttpOnly session cookie correctly
 * - revalidatePath clears the Next.js cache for all layouts/pages
 *   so no stale server-rendered content remains after logout
 * - Called from SignOutButton (Client Component) via form action
 */
export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(ROUTES.LOGIN);
}