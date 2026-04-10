# Smart Bookmark App

A production-grade bookmark manager with AI-powered categorization, real-time sync across tabs, and Google OAuth authentication.

**Live Demo:** [https://smart-bookmark-app-drab-three.vercel.app/](https://your-app.vercel.app)  
**Repo:** [https://github.com/prshntrajput/smart-bookmark-app](https://github.com/your-username/smart-bookmark)

---

##  Features

- **Google OAuth** — one-click sign-in via Supabase Auth
- **Feature A — Smart URL Metadata** — auto-fetches Open Graph title/description as you type a URL (debounced, SSRF-protected)
- **Feature B — AI Enrichment (Bonus)** — Inngest background job calls Gemini 2.0 Flash to auto-categorize and summarize every saved bookmark
- **Real-time sync** — changes appear instantly across all open tabs (no polling)
- **Optimistic deletes** — bookmark vanishes immediately; rolls back on failure
- **Search** — filters by title, URL, and AI category

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS |
| Auth & DB | Supabase (PostgreSQL + Auth + Realtime) |
| Background Jobs | Inngest |
| AI | Gemini 2.0 Flash via Vercel AI SDK (`@ai-sdk/google`) |
| Deployment | Vercel |

---

##  Architecture & Design Principles

The codebase follows **SOLID**, **DRY**, and clean architecture patterns:

- **SRP** — `bookmarkService` only handles DB operations; `useUrlMetadata` only fetches metadata; `useRealtimeSync` only manages the WebSocket
- **Repository Pattern** — all Supabase queries are in `src/services/bookmark.service.ts`, never in components
- **DRY** — `validateBookmark()` in `src/lib/utils/validators.ts` is used by both the form and future API routes
- **Dependency Inversion** — React hooks depend on service abstractions, not concrete Supabase calls
- **Feature-based folder structure** — modules are grouped by domain (`auth/`, `bookmarks/`) not by type

---
---

##  Local Development

### 1. Clone and install

```bash
git clone https://github.com/prshntrajput/smart-bookmark-app
cd smart-bookmark
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Authentication → Providers → Google** and enable it
3. Add `http://localhost:3000/auth/callback` to **Redirect URLs**
4. Run all migrations in the Supabase SQL editor (files in `supabase/migrations/`)

### 3. Environment variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_key

INNGEST_EVENT_KEY=local
INNGEST_SIGNING_KEY=signkey-local
INNGEST_DEV=1
```

### 4. Run both servers

```bash
# Terminal 1 — Next.js
npm run dev

# Terminal 2 — Inngest Dev Server
npx inngest-cli@latest dev
```

Open [http://localhost:3000](http://localhost:3000) and [http://localhost:8288](http://localhost:8288) (Inngest Dev UI).

---

##  Supabase Auth & Row Level Security

### How Auth Works

Authentication uses **Supabase Auth with Google OAuth**. The flow:

1. User clicks "Sign in with Google" → redirected to Google
2. Google redirects to `/auth/callback?code=...`
3. The callback route exchanges the code for a Supabase session
4. Session is stored in a secure `HttpOnly` cookie via `@supabase/ssr`
5. All subsequent requests read the session from the cookie (works in both RSC and client components)

Server components use `createClient()` from `@/lib/supabase/server` which reads cookies. Client components use `createClient()` from `@/lib/supabase/client` which hydrates from the server-set cookie.

### Row Level Security Policies

RLS is **enabled** on the `bookmarks` table. Every query from the browser is automatically scoped to the authenticated user — there is no way for a user to read or modify another user's bookmarks, even if they send a crafted request directly to the Supabase API.

**Policy: SELECT (read)**
```sql
CREATE POLICY "Users can only view their own bookmarks"
  ON public.bookmarks FOR SELECT
  USING (auth.uid() = user_id);
```
`auth.uid()` is the JWT claim injected by Supabase — it can never be spoofed by the client.

**Policy: INSERT**
```sql
CREATE POLICY "Users can only insert their own bookmarks"
  ON public.bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```
The `WITH CHECK` clause on INSERT prevents a user from creating a bookmark with a `user_id` other than their own — even if they manually craft the request payload.

**Policy: DELETE**
```sql
CREATE POLICY "Users can only delete their own bookmarks"
  ON public.bookmarks FOR DELETE
  USING (auth.uid() = user_id);
```

**Why these policies are correct:**  
The combination of `USING` (applied to SELECT/DELETE — filters which rows are visible) and `WITH CHECK` (applied to INSERT/UPDATE — validates the new row) ensures complete data isolation. The `SUPABASE_SERVICE_ROLE_KEY` used by the Inngest function bypasses RLS intentionally — it runs as a trusted backend process, never from the browser, and the key has no `NEXT_PUBLIC_` prefix so it cannot be bundled client-side.

---

##  Real-time Sync

### What Was Used

Real-time sync uses **two Supabase Realtime features on a single channel**:

1. **`postgres_changes`** — listens to `DELETE` and `UPDATE` events on the `bookmarks` table. This is a server-side diff stream: Supabase watches the WAL (Write-Ahead Log) and pushes changes to subscribed clients. `REPLICA IDENTITY FULL` is set on the table so `payload.old` contains the full deleted row (needed to remove the correct bookmark from state by ID).

2. **Broadcast** — used for `INSERT` notifications between tabs. When a user adds a bookmark, the client sends a broadcast event (`bookmark_added`) on the channel. Other tabs receive it and call `refreshBookmarks()`. This avoids duplicates that would occur from `postgres_changes INSERT` events (the inserting tab already has the row in state from the optimistic update).

### The Channel Setup

```
supabase.channel(`bookmarks-${userId}`)
  .on("broadcast",        { event: "bookmark_added" }, () => refreshBookmarks())
  .on("postgres_changes", { event: "DELETE", ... },    (p) => removeFromState(p.old.id))
  .on("postgres_changes", { event: "UPDATE", ... },    (p) => updateInState(p.new))
  .subscribe()
```

### Subscription Cleanup

The channel is cleaned up in the `useEffect` return function:

```ts
return () => {
  supabase.removeChannel(channel);
};
```

This prevents memory leaks and stale subscriptions when the component unmounts (e.g., user signs out) or when the `retryCount` changes to trigger a reconnect.

### Handling Disconnections

The `CHANNEL_ERROR` status fires when the WebSocket closes — most commonly due to JWT expiry (~1 hour) or the browser tab going to background. The hook handles this with:

- **JWT refresh** — calls `supabase.realtime.setAuth(freshToken)` before reconnecting so the server doesn't reject the new connection
- **Exponential backoff** — retries after 2s, 4s, 8s, 16s, 30s
- **Max retries** — gives up after 5 attempts to avoid infinite loops
- **Visibility change** — reconnects when a backgrounded tab comes back to the foreground

---

##  Bonus Feature: AI Enrichment with Inngest + Gemini

### What It Does

Every bookmark is automatically enriched in the background:
- **Category** — classified into one of 10 categories: Development, Design, News, Video, Learning, Tools, Entertainment, Social, Reference, Other
- **Summary** — a single-sentence description of what the bookmark is about

The `BookmarkCard` shows an "AI analyzing…" spinner badge immediately after saving, then transitions to a colored category chip + summary when enrichment completes — all without a page refresh.

### Why Inngest

A background job was the right choice because Gemini API calls can take 2-5 seconds — blocking the user's add-bookmark action would feel slow and degrade the UX. Inngest decouples the enrichment from the user action:

- **Reliability** — each step (`ai-categorize`, `save-to-db`) retries independently up to 3 times
- **Observability** — the Inngest Dev UI shows every run, step log, input/output, and retry reason
- **Concurrency control** — max 5 enrichments per user simultaneously, preventing API rate limits
- **Zero infrastructure** — no Redis, no BullMQ, no separate worker process needed

### How It Works End-to-End

```
1. User adds bookmark
2. BookmarkManager → POST /api/trigger-enrichment
3. Server route → inngest.send("bookmark/added", { bookmarkId, url, title })
4. Inngest picks up event

5. [Step 1] Gemini 2.0 Flash:
   prompt: URL + domain + title
   output: { category: "Development", summary: "AI SDK by Vercel..." }

6. [Step 2] supabaseAdmin.update({ category, summary, enriched: true })
   (uses service role to bypass RLS — trusted server context)

7. Supabase broadcasts UPDATE event via Realtime
8. useRealtimeSync UPDATE handler → updateBookmarkInState(updatedBookmark)
9. BookmarkCard re-renders:
   "AI analyzing…" → " Development" chip + summary
```

### Why Gemini 2.0 Flash

Gemini 2.0 Flash has a generous free tier, sub-second latency for structured output tasks, and native support via the Vercel AI SDK's `generateObject()` which enforces a Zod schema — guaranteeing a valid `category` enum value and bounded summary string every time.

---

##  Problems Encountered & How They Were Solved

### 1. `url.trim is not a function`

**Problem:** `validateBookmark({ url, title })` was called with an object but the function signature expected two separate string parameters `(url, title)`. So `url.trim()` was called on `{ url, title }` — an object, not a string.

**Fix:** Changed `validateBookmark` to accept a single `{ url, title }` object and updated the return type to `{ valid, urlError, titleError }` for field-specific error display.

### 2. `[Realtime] Channel error: "unknown"`

**Problem:** Supabase closes WebSocket connections when the JWT expires (~1 hour). This fires `CHANNEL_ERROR` for all channels with `err = undefined` — which we logged as `"unknown"`.

**Fix:** Changed from `console.error` to `console.warn`, added JWT refresh via `supabase.realtime.setAuth(freshToken)` before reconnecting, added exponential backoff (2s → 30s), max 5 retries, and a `visibilitychange` listener to reconnect when tabs return to the foreground.


---

##  Deployment Guide (Vercel)

### 1. Push to GitHub

```bash
git add .
git commit -m "feat: complete smart bookmark manager"
git push origin main
```

Make the repository **public** (required for the submission).

### 2. Set up Supabase for production

In your Supabase project:
1. **Authentication → URL Configuration** — add your Vercel URL: `https://your-app.vercel.app`
2. **Authentication → URL Configuration → Redirect URLs** — add `https://your-app.vercel.app/auth/callback`
3. Run all SQL migrations if not already done

### 3. Get Inngest production keys

1. Create an account at [app.inngest.com](https://app.inngest.com)
2. Create a new app → copy the **Event Key** and **Signing Key**

### 4. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project** → import your GitHub repo
2. Add all environment variables (do **not** add `INNGEST_DEV` in production):

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
INNGEST_EVENT_KEY=           # production key from Inngest dashboard
INNGEST_SIGNING_KEY=         # production key from Inngest dashboard
# DO NOT add INNGEST_DEV=1 in production
```

3. Click **Deploy**

### 5. Sync Inngest with your production URL

After Vercel deploys:
1. Go to [Inngest Dashboard](https://app.inngest.com) → **Apps → Sync new app**
2. Enter: `https://your-app.vercel.app/api/inngest`
3. Click **Sync** — Inngest will discover and register `enrich-bookmark`

Your app is now live. ✅

---

##  One Thing I'd Improve

**Bulk import from browser bookmarks.** Currently users add bookmarks one at a time. The highest-value improvement would be a drag-and-drop importer that accepts a browser bookmark HTML export file, parses all URLs, batch-inserts them, and enqueues Inngest enrichment jobs for each one. Inngest's `concurrency` control already handles rate limiting for bulk workloads — the infrastructure is ready, just the import UI and batch-insert service method are missing.

---


