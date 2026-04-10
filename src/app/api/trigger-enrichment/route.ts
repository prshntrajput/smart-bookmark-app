import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@/lib/supabase/server";
import { inngest }                   from "@/inngest/client";

/**
 * POST /api/trigger-enrichment
 * Body: { bookmarkId, url, title }
 *
 * Called by BookmarkManager immediately after a successful bookmark insert.
 * Authenticates the user then sends the "bookmark/added" event to Inngest.
 *
 * Why a separate route instead of calling inngest.send() client-side?
 *   The Inngest client is a server-side SDK. Sending events from the
 *   browser would expose INNGEST_EVENT_KEY to the client bundle.
 *   A server route keeps the key server-side and lets us verify auth first.
 */
export async function POST(request: NextRequest) {
  // ── Auth check ────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────
  let bookmarkId: string;
  let url:        string;
  let title:      string;

  try {
    const body = await request.json();
    bookmarkId = body.bookmarkId;
    url        = body.url;
    title      = body.title;

    if (!bookmarkId || !url || !title) {
      throw new Error("Missing required fields.");
    }
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  // ── Send Inngest event ────────────────────────────────────────────────
  await inngest.send({
    name: "bookmark/added",
    data: {
      bookmarkId,
      url,
      title,
      userId: user.id,
    },
  });

  return NextResponse.json({ success: true }, { status: 202 });
}