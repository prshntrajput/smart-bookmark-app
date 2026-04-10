import { createClient } from "@supabase/supabase-js";

/**
 * Supabase Admin Client — server-side only.
 *
 * Uses the SERVICE ROLE key which bypasses Row Level Security.
 * This is intentional: Inngest runs as a trusted backend service,
 * not as an end user. We use this ONLY for the AI enrichment update.
 *
 * NEVER import this file in any client component or expose the key
 * to the browser. The SUPABASE_SERVICE_ROLE_KEY env var has no
 * NEXT_PUBLIC_ prefix — Next.js will never bundle it client-side.
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession:   false,
    },
  }
);