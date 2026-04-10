

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  DASHBOARD: "/dashboard",
  AUTH_CALLBACK: "/auth/callback",
} as const;

export const APP_CONFIG = {
  NAME: "Smart Bookmark",
  DESCRIPTION:
    "Save, organize, and manage your bookmarks with real-time sync across tabs.",
  MAX_TITLE_LENGTH: 255,
  MAX_URL_LENGTH: 2048,
} as const;

export const SUPABASE_TABLES = {
  BOOKMARKS: "bookmarks",
} as const;

export const REALTIME_CHANNELS = {

  BOOKMARKS: "db-bookmarks",
} as const;