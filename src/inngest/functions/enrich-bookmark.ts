import { z }                        from "zod";
import { generateObject }           from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { inngest }                  from "@/inngest/client";
import { supabaseAdmin }            from "@/lib/supabase/admin";

const CATEGORIES = [
  "Development",
  "Design",
  "News",
  "Video",
  "Learning",
  "Tools",
  "Entertainment",
  "Social",
  "Reference",
  "Other",
] as const;

export type BookmarkCategory = (typeof CATEGORIES)[number];

const enrichmentSchema = z.object({
  category: z.enum(CATEGORIES).describe(
    "The single most relevant category for this bookmark."
  ),
  summary: z
    .string()
    .max(150)
    .describe("A single sentence (max 150 chars) describing this bookmark."),
});

// Defined once here — used to type event.data since we removed
// the global Events generic from client.ts
type EnrichBookmarkEventData = {
  bookmarkId: string;
  url:        string;
  title:      string;
  userId:     string;
};

export const enrichBookmark = inngest.createFunction(
  {
    id:      "enrich-bookmark",
    name:    "Enrich Bookmark with AI",
    retries: 3,
    concurrency: {
      limit: 5,
      key:   "event.data.userId",
    },
    triggers: [{ event: "bookmark/added" as const }],
  },

  async ({ event, step }) => {
    // ↓ only change — cast event.data so TypeScript knows the shape
    const { bookmarkId, url, title } = event.data as EnrichBookmarkEventData;

    // ── Step 1: Gemini categorize + summarize ─────────────────────────────
    const enrichment = await step.run("ai-categorize-and-summarize", async () => {
      const google = createGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
      });

      const { object } = await generateObject({
        model:  google("gemini-2.5-flash-lite"),
        schema: enrichmentSchema,
        prompt: buildPrompt(url, title),
      });

      return object;
    });

    // ── Step 2: Persist to Supabase via service role ──────────────────────
    await step.run("save-enrichment-to-db", async () => {
      const { error } = await supabaseAdmin
        .from("bookmarks")
        .update({
          category: enrichment.category,
          summary:  enrichment.summary,
          enriched: true,
        })
        .eq("id", bookmarkId);

      if (error) throw new Error(`Supabase update failed: ${error.message}`);
    });

    return {
      bookmarkId,
      category: enrichment.category,
      summary:  enrichment.summary,
    };
  }
);

function buildPrompt(url: string, title: string): string {
  let domain = "";
  try { domain = new URL(url).hostname.replace(/^www\./, ""); }
  catch { domain = url; }

  return `
You are a smart bookmark assistant. Classify the following saved bookmark.

URL: ${url}
Domain: ${domain}
Title: ${title}

Choose the single best category from the available options and write a concise 1-sentence summary describing what this bookmark is about.

The summary must be under 150 characters and written in plain English.
`.trim();
}