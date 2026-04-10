"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { SUPABASE_TABLES, REALTIME_CHANNELS } from "@/constants";
import type { Bookmark } from "@/types";

export type RealtimeStatus = "connecting" | "connected" | "disconnected";

interface UseRealtimeSyncParams {
  userId: string;
  onInsertPing: () => void;
  onDelete: (id: string) => void;
}

interface UseRealtimeSyncReturn {
  status: RealtimeStatus;

  sendInsertNotification: () => void;
}

export function useRealtimeSync({
  userId,
  onInsertPing,
  onDelete,
}: UseRealtimeSyncParams): UseRealtimeSyncReturn {
  const [status, setStatus] = useState<RealtimeStatus>("connecting");

  // Stable ref to the active channel — used by sendInsertNotification
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Callback refs — subscription never restarts on re-renders
  const onInsertPingRef = useRef(onInsertPing);
  const onDeleteRef     = useRef(onDelete);

  useEffect(() => { onInsertPingRef.current = onInsertPing; }, [onInsertPing]);
  useEffect(() => { onDeleteRef.current     = onDelete;     }, [onDelete]);

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`${REALTIME_CHANNELS.BOOKMARKS}-${userId}`, {
        config: {
          // self: false (default) — the inserting tab does NOT receive
          // its own broadcast. It already updated state via addBookmark().
          broadcast: { self: false },
        },
      })

      // ── INSERT: Supabase Broadcast ──────────────────────────────────────
      // Received when ANOTHER tab calls sendInsertNotification().
      // We respond by calling refreshBookmarks() — a full re-fetch.
      // This is 100% reliable: no RLS evaluation, pure WebSocket delivery.
      .on("broadcast", { event: "bookmark_added" }, () => {
        onInsertPingRef.current();
      })

      // ── DELETE: postgres_changes ────────────────────────────────────────
      // Kept as-is — this was already working correctly.
      // payload.old.id comes from Postgres WAL primary key — always present.
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: SUPABASE_TABLES.BOOKMARKS,
        },
        (payload) => {
          const oldRow = payload.old as Partial<Bookmark>;
          if (oldRow.id && (!oldRow.user_id || oldRow.user_id === userId)) {
            onDeleteRef.current(oldRow.id);
          }
        }
      )

      .subscribe((subStatus, err) => {
        switch (subStatus) {
          case "SUBSCRIBED":
            setStatus("connected");
            break;
          case "TIMED_OUT":
            setStatus("disconnected");
            console.warn("[Realtime] Timed out. Auto-retrying…");
            break;
          case "CHANNEL_ERROR":
            setStatus("disconnected");
            console.error("[Realtime] Channel error:", err ?? "unknown");
            break;
          case "CLOSED":
            setStatus("disconnected");
            break;
          default:
            setStatus("connecting");
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [userId]);

  // ── sendInsertNotification ──────────────────────────────────────────────
  // Called by BookmarkManager immediately after a successful bookmark insert.
  // Sends a broadcast to all OTHER tabs subscribed to this channel.
  // Tabs receive it → onInsertPing fires → refreshBookmarks() runs.
  const sendInsertNotification = useCallback(() => {
    if (!channelRef.current) return;

    channelRef.current
      .send({
        type: "broadcast",
        event: "bookmark_added",
        payload: {},
      })
      .catch((err) => {
        console.warn("[Realtime] Broadcast failed:", err);
      });
  }, []);

  return { status, sendInsertNotification };
}