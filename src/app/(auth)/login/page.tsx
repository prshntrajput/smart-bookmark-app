import type { Metadata } from "next";
import { Bookmark, Lock, RefreshCw, Search } from "lucide-react";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { APP_CONFIG } from "@/constants";

export const metadata: Metadata = {
  title: `Sign In — ${APP_CONFIG.NAME}`,
  description: APP_CONFIG.DESCRIPTION,
};


interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm space-y-8">

        {/* ── Brand mark ───────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-sm">
            <Bookmark className="h-7 w-7 text-primary-foreground" />
          </div>
          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              {APP_CONFIG.NAME}
            </h1>
            <p className="text-sm text-muted-foreground">
              Save and sync bookmarks across all your tabs
            </p>
          </div>
        </div>

        {/* ── Sign-in card ─────────────────────────────────────────────── */}
        <div className="rounded-xl border bg-card px-6 py-7 shadow-sm space-y-5">

          {/* Error banner — shown when OAuth callback fails */}
          {error === "auth_callback_failed" && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              <span className="mt-0.5 shrink-0">⚠</span>
              <span>
                Sign-in failed. Please try again or use a different account.
              </span>
            </div>
          )}

          <div className="space-y-1.5 text-center">
            <h2 className="text-base font-medium">Welcome back</h2>
            <p className="text-sm text-muted-foreground">
              Sign in with your Google account to continue
            </p>
          </div>

          {/* The sign-in button is isolated in its own client component.
              The login page itself remains a Server Component — we only
              ship JS to the client for the button's onClick handler. */}
          <GoogleSignInButton />

          <p className="text-center text-xs text-muted-foreground">
            Your bookmarks are private and only visible to you.
          </p>
        </div>

        {/* ── Feature highlights ───────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <FeatureHint icon={Lock} label="Private bookmarks" />
          <FeatureHint icon={RefreshCw} label="Real-time sync" />
          <FeatureHint icon={Search} label="Instant search" />
        </div>

      </div>
    </div>
  );
}

// ─── Small helper — purely presentational, no state ──────────────────────────
function FeatureHint({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border bg-card px-2 py-3">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-xs text-muted-foreground leading-tight">{label}</span>
    </div>
  );
}