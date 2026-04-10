"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ROUTES } from "@/constants";
import type { AppUser } from "@/types";

interface UseAuthReturn {
  user: AppUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
}


export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // Initial session check — runs once on mount
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ? mapToAppUser(data.user) : null);
      setLoading(false);
    });

    // Subscribe to auth state changes
    // This fires on every session event: SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(mapToAppUser(session.user));
      } else {
        setUser(null);
      }

      // Keep loading false after the initial check resolves
      setLoading(false);

      // Refresh the Next.js router cache on auth change so Server Components
      // re-render with the correct session (e.g. Navbar shows user avatar)
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        router.refresh();
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(ROUTES.LOGIN);
  }, [router]);

  return { user, loading, signOut };
}

// ─── Maps a Supabase User to our clean AppUser type ──────────────────────────
// SRP: transformation logic lives here, not scattered across components.
// DRY: one place to update if Supabase's user shape ever changes.
function mapToAppUser(supabaseUser: {
  id: string;
  email?: string;
  user_metadata?: Record<string, string>;
}): AppUser {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email,
    full_name: supabaseUser.user_metadata?.full_name,
    avatar_url: supabaseUser.user_metadata?.avatar_url,
  };
}