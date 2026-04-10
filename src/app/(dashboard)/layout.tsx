import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/NavBar";
import { ROUTES } from "@/constants";
import type { AppUser } from "@/types";


export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belt-and-suspenders redirect — middleware catches most cases,
  // but this ensures layout never renders with null user on full load.
  if (!user) {
    redirect(ROUTES.LOGIN);
  }

  // Map Supabase user to our clean AppUser type
  // Centralised here so child pages don't repeat this mapping
  const appUser: AppUser = {
    id: user.id,
    email: user.email,
    full_name: user.user_metadata?.full_name,
    avatar_url: user.user_metadata?.avatar_url,
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={appUser} />
      {children}
    </div>
  );
}