import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { BookmarkManager } from "@/components/bookmarks/BookmarkManager";
import { ROUTES } from "@/constants";

export const metadata: Metadata = {
  title: "Dashboard — Smart Bookmark",
};


export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(ROUTES.LOGIN);

  const firstName =
    (user.user_metadata?.full_name as string | undefined)
      ?.split(" ")[0] ?? null;

  return (
    <PageWrapper>

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          {firstName ? `${firstName}'s Bookmarks` : "My Bookmarks"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Private to you &mdash; synced in real time across all open tabs
        </p>
      </div>

      <BookmarkManager userId={user.id} />

    </PageWrapper>
  );
}