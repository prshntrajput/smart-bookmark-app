# Smart Bookmark App

A production-grade bookmark manager with AI-powered categorization, real-time sync across tabs, and Google OAuth authentication.

**Live Demo:** https://smart-bookmark-app-drab-three.vercel.app  
**Repo:** https://github.com/prshntrajput/smart-bookmark-app

---

## Features

- Google OAuth — one-click sign-in via Supabase Auth
- Smart URL Metadata (Feature A) — auto-fetches Open Graph title as you type a URL, debounced and SSRF-protected
- AI Enrichment (Feature B) — Inngest background job calls Gemini 2.0 Flash to auto-categorize and summarize every saved bookmark
- Real-time sync — changes appear instantly across all open tabs without polling
- Optimistic deletes — bookmark vanishes immediately, rolls back on failure
- Search — filters by title, URL, and AI-assigned category

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS |
| Auth and Database | Supabase (PostgreSQL, Auth, Realtime) |
| Background Jobs | Inngest |
| AI | Gemini 2.0 Flash via Vercel AI SDK |
| Deployment | Vercel |

---

## Architecture

The codebase follows SOLID, DRY, and clean architecture principles.

- Single Responsibility — `bookmarkService` only handles DB operations, `useUrlMetadata` only fetches metadata, `useRealtimeSync` only manages the WebSocket
- Repository Pattern — all Supabase queries live in `src/services/bookmark.service.ts`, never in components or hooks
- DRY — `validateBookmark()` in `src/lib/utils/validators.ts` is the single source of validation truth, used by the form and API routes
- Feature-based folder structure — modules are grouped by domain (`auth/`, `bookmarks/`) not by technical type

---

## Local Development

### 1. Clone and install

```bash
git clone https://github.com/prshntrajput/smart-bookmark-app
cd smart-bookmark-app
npm install
```

### 2. Set up Supabase

1. Create a project at supabase.com
2. Go to Authentication > Providers > Google and enable it
3. Add `http://localhost:3000/auth/callback` to Redirect URLs
4. Run all migrations from `supabase/migrations/` in the SQL editor in order

### 3. Environment variables

Create `.env.local`:

```
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
# Terminal 1
npm run dev

# Terminal 2
npx inngest-cli@latest dev
```

Open http://localhost:3000 for the app and http://localhost:8288 for the Inngest Dev UI.

---

## Supabase Auth and Row Level Security

### How Auth Works

Authentication uses Supabase Auth with Google OAuth. The full flow:

1. User clicks "Sign in with Google" and is redirected to Google
2. Google redirects back to `/auth/callback?code=...`
3. The callback route calls `supabase.auth.exchangeCodeForSession(code)` to exchange the code for a session
4. The session is stored in a secure HttpOnly cookie via `@supabase/ssr`
5. All subsequent requests read the session from the cookie — this works in both Server Components and Client Components

Server components use `createClient()` from `@/lib/supabase/server` which reads from the Next.js cookie store. Client components use `createBrowserClient<Database>()` which hydrates from the cookie set by the server.

### Row Level Security

RLS is enabled on the `bookmarks` table. Every query from the browser is automatically scoped to the authenticated user. There is no way for a user to read, modify, or delete another user's bookmarks, even by sending a crafted request directly to the Supabase REST API.

**SELECT policy**

```sql
CREATE POLICY "Users can only view their own bookmarks"
  ON public.bookmarks FOR SELECT
  USING (auth.uid() = user_id);
```

`auth.uid()` is extracted from the signed JWT by Supabase. It cannot be spoofed by the client because Supabase controls the signing key.

**INSERT policy**

```sql
CREATE POLICY "Users can only insert their own bookmarks"
  ON public.bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

`WITH CHECK` validates the new row on INSERT. Even if a user crafts a request with a different `user_id` in the body, the database rejects it.

**UPDATE policy**

```sql
CREATE POLICY "Users can only update their own bookmarks"
  ON public.bookmarks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

Both clauses are required. `USING` controls which rows the user can target. `WITH CHECK` prevents reassigning a bookmark to a different user after update.

**DELETE policy**

```sql
CREATE POLICY "Users can only delete their own bookmarks"
  ON public.bookmarks FOR DELETE
  USING (auth.uid() = user_id);
```

The `SUPABASE_SERVICE_ROLE_KEY` used by the Inngest enrichment function intentionally bypasses RLS. It runs as a trusted server-side process, never from the browser, and the key has no `NEXT_PUBLIC_` prefix so it cannot be bundled into the client.

---

## Real-time Sync

### What Was Used

Real-time sync uses two Supabase Realtime features on a single channel per user:

**postgres_changes** — listens to `DELETE` and `UPDATE` events on the `bookmarks` table. Supabase watches the Postgres Write-Ahead Log and pushes row-level changes to subscribed clients. `REPLICA IDENTITY FULL` is set on the table so that `payload.old` on DELETE events contains the full deleted row, not just the primary key. This is required to remove the correct bookmark from client state by ID.

**Broadcast** — used for INSERT notifications between tabs. When a user adds a bookmark, the inserting tab sends a broadcast event (`bookmark_added`) on the channel. Other open tabs receive it and call `refreshBookmarks()`. Broadcast is used here instead of `postgres_changes INSERT` deliberately — the inserting tab already has the new row in state from the optimistic update, so receiving the INSERT event again would cause a duplicate entry.

### Channel Setup

```ts
supabase
  .channel(`bookmarks-${userId}`)
  .on("broadcast",        { event: "bookmark_added" }, () => refreshBookmarks())
  .on("postgres_changes", { event: "DELETE", schema: "public", table: "bookmarks" },
      (payload) => removeBookmarkFromState(payload.old.id))
  .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bookmarks" },
      (payload) => updateBookmarkInState(payload.new))
  .subscribe();
```

### Subscription Cleanup

The channel is cleaned up in the `useEffect` return function:

```ts
return () => {
  supabase.removeChannel(channel);
};
```

This prevents memory leaks and stale subscriptions when the component unmounts (on sign-out) or when a reconnect cycle increments the retry counter and triggers a fresh subscription.

### Handling Disconnections

`CHANNEL_ERROR` fires when the WebSocket closes — most commonly due to JWT expiry after one hour, or the browser tab going to the background. The hook handles this with:

- JWT refresh — calls `supabase.realtime.setAuth(freshToken)` before reconnecting so the server does not reject the new connection
- Exponential backoff — retries after 2s, 4s, 8s, 16s, 30s
- Maximum 5 retries to avoid an infinite loop on a persistent error
- A `visibilitychange` listener that triggers a reconnect when a backgrounded tab returns to focus

---

## Bonus Feature: AI Enrichment with Inngest and Gemini

### What It Does

Every saved bookmark is automatically enriched in the background with a category (one of Development, Design, News, Video, Learning, Tools, Entertainment, Social, Reference, Other) and a one-sentence summary. The `BookmarkCard` shows an "AI analyzing" spinner badge immediately after saving, then transitions to a colored category chip and summary text when the enrichment arrives — without any page refresh or manual polling.

### Why Inngest

Gemini API calls take 2 to 5 seconds. Blocking the user's add-bookmark action for that duration would make the app feel slow. Inngest decouples the enrichment from the user action entirely:

- Each step retries independently up to 3 times on failure
- The Inngest Dev UI shows every run, step log, input, output, and retry reason
- Concurrency is capped at 5 enrichments per user simultaneously to avoid API rate limits
- No Redis, no BullMQ, no separate worker process is required

### End-to-End Flow

```
1.  User adds a bookmark
2.  BookmarkManager calls POST /api/trigger-enrichment
3.  API route calls inngest.send("bookmark/added", { bookmarkId, url, title, userId })
4.  Inngest picks up the event

5.  Step 1 — Gemini 2.0 Flash:
    Input:  URL, domain, title
    Output: { category: "Development", summary: "The Vercel AI SDK for..." }

6.  Step 2 — supabaseAdmin.update({ category, summary, enriched: true })
    Uses service role key to bypass RLS — trusted server context

7.  Supabase emits a Realtime UPDATE event
8.  useRealtimeSync UPDATE handler calls updateBookmarkInState(payload.new)
9.  BookmarkCard re-renders: spinner badge becomes category chip + summary
```

### Why Gemini 2.0 Flash

It has a generous free tier, sub-second latency for structured output tasks, and native support in the Vercel AI SDK via `generateObject()` which enforces a Zod schema — guaranteeing a valid category enum value and a summary under 150 characters on every call.

---

## Problems We Ran Into and How We Solved Them

### 1. Real-time INSERT caused duplicate bookmarks in the UI

When a user added a bookmark, the app displayed it twice — once from the optimistic update in `useBookmarks` and again when the `postgres_changes INSERT` event fired from Supabase Realtime.

The fix was to stop listening to `postgres_changes` for INSERT events entirely. Instead, the inserting tab sends a Broadcast event (`bookmark_added`) to all other tabs. Other tabs call `refreshBookmarks()` on receiving it. The inserting tab already has the row in state, so it ignores the broadcast. DELETE and UPDATE still use `postgres_changes` because those originate from the server (Inngest enrichment or another tab), not from the current client.

### 2. Supabase `.insert()` TypeScript error — type resolves to `never`

The `.insert()` call in `bookmarkService` showed a type error saying the argument was not assignable to `never`. This cascaded from three separate issues that had to all be fixed together:

- `database.types.ts` was using `interface Database` instead of `type Database`. Supabase's internal generic resolution uses conditional types that do not distribute correctly over interfaces — changing to `type` fixed the resolution.
- The AI enrichment columns (`category`, `summary`, `enriched`) added in migration 004 were missing from `database.types.ts`. Supabase saw a schema mismatch and fell back to `never`.
- `createBrowserClient()` in `client.ts` was missing the `<Database>` generic, so the type system had no schema to resolve against.

All three had to be correct at the same time. The lesson is that Supabase's type system is a chain — one missing link anywhere produces `never` everywhere.

### 3. Inngest v3 API breaking changes

The app was written using Inngest v2 patterns. After upgrading to v3, two things broke:

`EventSchemas` was removed entirely. In v2, events were typed by passing an `EventSchemas` instance. In v3, the generic is passed directly to `new Inngest<{ events: Events }>()`. However, this also broke because the `T` generic in v3 must extend `ClientOptions` which requires `id` — passing only `{ events: Events }` caused a constraint error. The final fix was to remove the generic entirely and type `event.data` inline with a local type cast inside the function handler. Event type safety is maintained at the point of use without needing a global event map.

`createFunction` also changed from a 3-argument call (`config`, `trigger`, `handler`) to a 2-argument call where `triggers` is a field inside the config object.

### 4. `cookiesToSet` implicitly has `any` type across multiple files

Next.js strict TypeScript mode requires explicit types on all function parameters that cannot be inferred. The `setAll` callback passed to `createServerClient` and `createBrowserClient` had an untyped `cookiesToSet` parameter in three files: `server.ts`, `middleware.ts`, and `auth/callback/route.ts`.

The fix was to derive the type from the cookie store itself rather than importing from `@supabase/ssr` internals (which are sometimes `undefined` in the type definitions):

```ts
type CookieSetOptions = Parameters<typeof cookieStore.set>[2];
```

This extracts the exact options type from Next.js `cookies().set()` — guaranteed to always match and never go stale when the package updates.

### 5. `url.trim is not a function` at runtime

`validateBookmark` was defined to accept two string parameters `(url, title)` but was being called with a single object `({ url, title })`. JavaScript received an object as the first argument, so `url.trim()` was called on an object, throwing at runtime.

The fix was to change the function signature to accept a single `{ url, title }` object and update the return type to `{ valid, urlError, titleError }` so each field can display its own inline error message in the form.

### 6. Realtime WebSocket dropped after one hour with no reconnect

Supabase closes WebSocket connections when the JWT expires, typically after one hour. The channel status changes to `CHANNEL_ERROR` with an undefined error object. The original implementation did not handle this — the UI showed "Offline" permanently until a full page reload.

The fix was a retry loop with exponential backoff (2s, 4s, 8s, 16s, 30s, max 5 attempts). Before each reconnect, the hook calls `supabase.realtime.setAuth(freshToken)` to refresh the JWT on the Realtime socket so the server accepts the new connection. A `visibilitychange` event listener also triggers a reconnect when a backgrounded tab comes back into focus, since these tabs often miss the reconnect window.

---

## Deployment

### 1. Push to GitHub

```bash
git add .
git commit -m "feat: complete smart bookmark manager"
git push origin main
```

Make the repository public for the submission.

### 2. Configure Supabase for production

In your Supabase project:

1. Authentication > URL Configuration > Site URL: `https://your-app.vercel.app`
2. Authentication > URL Configuration > Redirect URLs: `https://your-app.vercel.app/auth/callback`

In Google Cloud Console > OAuth Client > Authorized redirect URIs:

```
https://your-app.vercel.app/auth/callback
```

### 3. Get Inngest production keys

Create an account at app.inngest.com, create a new app, and copy the Event Key and Signing Key from the dashboard.

### 4. Deploy to Vercel

Import the GitHub repo at vercel.com and add these environment variables:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
```

Do not add `INNGEST_DEV` in production.

### 5. Sync Inngest with your production URL

After Vercel deploys, go to Inngest Dashboard > Apps > Sync new app and enter:

```
https://your-app.vercel.app/api/inngest
```

Inngest will discover and register the `enrich-bookmark` function.

---

## One Thing I Would Improve

Bulk import from a browser bookmark export. Currently users add bookmarks one at a time. The most valuable improvement would be a drag-and-drop importer that accepts a browser HTML bookmark export file, parses all URLs from it, batch-inserts them into the database, and enqueues an Inngest enrichment job for each one. The Inngest concurrency control (`limit: 5, key: event.data.userId`) already handles rate limiting for bulk workloads — the infrastructure is ready. What is missing is the file parser, the batch insert method in `bookmarkService`, and the import UI in the dashboard.
