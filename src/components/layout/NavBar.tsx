import Image from "next/image";
import { Bookmark } from "lucide-react";
import { SignOutButton } from "./SignOutButton";
import { APP_CONFIG } from "@/constants";
import type { AppUser } from "@/types";

interface NavbarProps {
  user: AppUser;
}


export function Navbar({ user }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6 lg:px-8">

        {/* ── Left: Brand ─────────────────────────────────────────── */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Bookmark className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold tracking-tight">
            {APP_CONFIG.NAME}
          </span>
        </div>

        {/* ── Right: User info + sign out ──────────────────────────── */}
        <div className="flex items-center gap-1 sm:gap-3">

          {/* User identity */}
          <div className="flex items-center gap-2.5">
            <UserAvatar user={user} />
            {/* Hide name on very small screens — avatar is enough */}
            <div className="hidden flex-col sm:flex">
              {user.full_name && (
                <span className="text-sm font-medium leading-none">
                  {user.full_name}
                </span>
              )}
              {user.email && (
                <span className="mt-1 text-xs leading-none text-muted-foreground">
                  {user.email}
                </span>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="hidden h-6 w-px bg-border sm:block" />

          <SignOutButton />
        </div>

      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UserAvatar — shows Google profile picture or initials fallback.
// Extracted as its own component: SRP (only handles avatar display logic).
// ─────────────────────────────────────────────────────────────────────────────
function UserAvatar({ user }: { user: AppUser }) {
  if (user.avatar_url) {
    return (
      <Image
        src={user.avatar_url}
        alt={user.full_name ?? "User avatar"}
        width={32}
        height={32}
        className="rounded-full object-cover ring-1 ring-border"
        // Priority because it's above the fold in the navbar
        priority
      />
    );
  }

  return (
    <div
      aria-label={`Avatar for ${user.full_name ?? user.email ?? "user"}`}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground ring-1 ring-border"
    >
      {getInitials(user.full_name, user.email)}
    </div>
  );
}

// ─── Pure utility — derives 1-2 letter initials from name or email ───────────
function getInitials(
  name: string | undefined,
  email: string | undefined
): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  if (email) {
    return email[0].toUpperCase();
  }
  return "U";
}