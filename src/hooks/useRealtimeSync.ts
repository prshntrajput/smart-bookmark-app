"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { RealtimeChannel }  from "@supabase/supabase-js";
import { createClient }          from "@/lib/supabase/client";
import { SUPABASE_TABLES, REALTIME_CHANNELS } from "@/constants";
import type { Bookmark }         from "@/types";

export type RealtimeStatus = "connecting" | "connected" | "disconnected";

interface UseRealtimeSyncParams {
  userId:       string;
  onInsertPing: () => void;
  onDelete:     (id: string)         => void;
  onUpdate:     (bookmark: Bookmark) => void;
}

interface UseRealtimeSyncReturn {
  status:                 RealtimeStatus;
  sendInsertNotification: () => void;
}

const MAX_RETRIES = 5;
const BACKOFF     = [2_000, 4_000, 8_000, 16_000, 30_000];

export function useRealtimeSync({
  userId,
  onInsertPing,
  onDelete,
  onUpdate,
}: UseRealtimeSyncParams): UseRealtimeSyncReturn {
  const [status,     setStatus]     = useState<RealtimeStatus>("connecting");
  const [retryCount, setRetryCount] = useState(0);

  const channelRef      = useRef<RealtimeChannel | null>(null);
  const onInsertPingRef = useRef(onInsertPing);
  const onDeleteRef     = useRef(onDelete);
  const onUpdateRef     = useRef(onUpdate);
  const retryTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef    = useRef(true);

  useEffect(() => { onInsertPingRef.current = onInsertPing; }, [onInsertPing]);
  useEffect(() => { onDeleteRef.current     = onDelete;     }, [onDelete]);
  useEffect(() => { onUpdateRef.current     = onUpdate;     }, [onUpdate]);

  useEffect(() => {
    if (!userId) return;
    isMountedRef.current = true;

    const supabase = createClient();

    const connect = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await supabase.realtime.setAuth(session.access_token);
        }
      } catch { /* non-fatal */ }

      if (!isMountedRef.current) return;

      const channel = supabase
        .channel(`${REALTIME_CHANNELS.BOOKMARKS}-${userId}`, {
          config: { broadcast: { self: false } },
        })

        // ── Broadcast: INSERT ping ──────────────────────────────────────
        .on("broadcast", { event: "bookmark_added" }, () => {
          onInsertPingRef.current();
        })

        // ── postgres_changes: DELETE ────────────────────────────────────
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: SUPABASE_TABLES.BOOKMARKS },
          (payload) => {
            const oldRow = payload.old as Partial<Bookmark>;
            if (oldRow.id && (!oldRow.user_id || oldRow.user_id === userId)) {
              onDeleteRef.current(oldRow.id);
            }
          }
        )

        // ── postgres_changes: UPDATE ────────────────────────────────────
        // Fires after Inngest enriches the bookmark.
        // payload.new has the full updated row (REPLICA IDENTITY FULL).
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: SUPABASE_TABLES.BOOKMARKS },
          (payload) => {
            const updated = payload.new as Bookmark;
            if (updated?.id && updated?.user_id === userId) {
              onUpdateRef.current(updated);
            }
          }
        )

        .subscribe((subStatus, err) => {
          if (!isMountedRef.current) return;

          switch (subStatus) {
            case "SUBSCRIBED":
              setStatus("connected");
              break;

            case "TIMED_OUT":
              setStatus("disconnected");
              console.warn("[Realtime] Timed out — Supabase is retrying…");
              break;

            case "CHANNEL_ERROR":
              setStatus("disconnected");
              console.warn(
                `[Realtime] Connection interrupted (attempt ${retryCount + 1}/${MAX_RETRIES}).`,
                err ?? "Socket closed — likely JWT expiry or network interruption."
              );
              if (retryCount < MAX_RETRIES) {
                const delay = BACKOFF[Math.min(retryCount, BACKOFF.length - 1)];
                retryTimerRef.current = setTimeout(() => {
                  if (isMountedRef.current) setRetryCount((c) => c + 1);
                }, delay);
              } else {
                console.warn("[Realtime] Max retries reached. Refresh to reconnect.");
              }
              break;

            case "CLOSED":
              setStatus("disconnected");
              break;

            default:
              setStatus("connecting");
          }
        });

      channelRef.current = channel;
    };

    connect();

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      const state = channelRef.current?.state;
      if (state === "closed" || state === "errored") {
        setRetryCount((c) => c + 1);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, retryCount]);

  const sendInsertNotification = useCallback(() => {
    channelRef.current
      ?.send({ type: "broadcast", event: "bookmark_added", payload: {} })
      .catch((err) => console.warn("[Realtime] Broadcast failed:", err));
  }, []);

  return { status, sendInsertNotification };
}