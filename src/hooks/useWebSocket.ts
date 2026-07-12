"use client";
import { useEffect, useRef, useCallback, useState } from "react";

interface WSMessage {
  id: string;
  text: string | null;
  media_url: string | null;
  sender_id: string;
  sender_name: string;
  sender_avatar: string | null;
  created_at: string;
  read_at: string | null;
  is_system?: boolean;
}

interface UseWebSocketOptions {
  bookingId: string | null;
  token: string | null;
  onMessage?: (msg: WSMessage) => void;
  onMessageEdited?: (data: { message_id: string; text: string; edited_at: string }) => void;
  onMessageDeleted?: (data: { message_id: string; deleted_at: string }) => void;
  onTyping?: (userId: string, userName: string) => void;
  onRead?: (userId: string, timestamp: string) => void;
  onOnline?: (users: { userId: string; userName: string }[]) => void;
  onStatusChange?: (status: "connected" | "disconnected" | "reconnecting") => void;
  // Fired when the server closes with 4001 (invalid/expired token). The
  // caller should re-fetch /api/auth/ws-token and update the `token` prop —
  // the hook reconnects automatically when the token changes.
  onAuthExpired?: () => void;
}

export function useWebSocket({
  bookingId,
  token,
  onMessage,
  onMessageEdited,
  onMessageDeleted,
  onTyping,
  onRead,
  onOnline,
  onStatusChange,
  onAuthExpired,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempt = useRef(0);
  // When the socket OPENED (TCP+upgrade ok). An auth-rejected socket opens
  // fine and dies <1s later — such closes must NOT reset the backoff, or
  // the loop hammers the server every ~2s forever (seen in prod: 12.7k
  // reconnects/day from one tab with an expired token).
  const openedAt = useRef(0);
  // Consecutive auth (4001) closes. After a few, give up entirely — the
  // session itself is gone and the page has an SSE/API fallback anyway.
  const authFailures = useRef(0);
  // intentionalCloseRef = true means "we closed this on purpose, don't reconnect".
  // Set whenever we tear down (cleanup or chat switch) so the dying socket's
  // onclose handler doesn't fight the fresh connection just being opened.
  const intentionalCloseRef = useRef(false);
  const [status, setStatus] = useState<"connected" | "disconnected" | "reconnecting">("disconnected");

  // Use refs for callbacks to avoid reconnecting on every render
  const onMessageRef = useRef(onMessage);
  const onMessageEditedRef = useRef(onMessageEdited);
  const onMessageDeletedRef = useRef(onMessageDeleted);
  const onTypingRef = useRef(onTyping);
  const onReadRef = useRef(onRead);
  const onOnlineRef = useRef(onOnline);
  const onStatusChangeRef = useRef(onStatusChange);
  const onAuthExpiredRef = useRef(onAuthExpired);
  onAuthExpiredRef.current = onAuthExpired;
  onMessageRef.current = onMessage;
  onMessageEditedRef.current = onMessageEdited;
  onMessageDeletedRef.current = onMessageDeleted;
  onTypingRef.current = onTyping;
  onReadRef.current = onRead;
  onOnlineRef.current = onOnline;
  onStatusChangeRef.current = onStatusChange;

  const connect = useCallback(() => {
    if (!bookingId || !token) return;

    // Cancel any pending reconnect from a previous WS instance.
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }

    if (wsRef.current) {
      // Mark stale socket as intentional so its onclose doesn't trigger reconnect.
      intentionalCloseRef.current = true;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    intentionalCloseRef.current = false;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Only react if this is still the active socket.
      if (wsRef.current !== ws) return;
      // Deliberately NOT resetting the reconnect backoff here: a socket
      // the server is about to auth-reject opens successfully first. The
      // backoff resets in onclose only after a provably stable session.
      openedAt.current = Date.now();
      setStatus("connected");
      onStatusChangeRef.current?.("connected");
      ws.send(JSON.stringify({ type: "join", booking_id: bookingId }));
    };

    ws.onmessage = (event) => {
      if (wsRef.current !== ws) return;
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case "message":
            onMessageRef.current?.(data.message);
            break;
          case "message_edited":
            onMessageEditedRef.current?.({
              message_id: data.message_id,
              text: data.text,
              edited_at: data.edited_at,
            });
            break;
          case "message_deleted":
            onMessageDeletedRef.current?.({
              message_id: data.message_id,
              deleted_at: data.deleted_at,
            });
            break;
          case "typing":
            onTypingRef.current?.(data.user_id, data.user_name);
            break;
          case "read":
            onReadRef.current?.(data.user_id, data.timestamp);
            break;
          case "online":
            onOnlineRef.current?.(data.users);
            break;
        }
      } catch {}
    };

    ws.onclose = (event) => {
      // Suppress reconnect & status churn when WE closed this socket on purpose
      // (cleanup or chat switch). Otherwise the dying handler races the fresh one.
      if (intentionalCloseRef.current || wsRef.current !== ws) return;

      const lifetimeMs = openedAt.current ? Date.now() - openedAt.current : 0;
      if (lifetimeMs >= 10_000) {
        // Survived long enough to be a real session — this close is a
        // genuine network hiccup, start the backoff ladder from scratch.
        reconnectAttempt.current = 0;
        authFailures.current = 0;
      }

      if (event.code === 4001) {
        // Server rejected the token (expired/invalid). Reconnecting with
        // the SAME token can never succeed — ask the page for a fresh one
        // (token prop change re-triggers connect). Still schedule a backed-
        // off retry below in case the refresh lands slowly, but give up
        // after a few strikes: the session itself is dead.
        authFailures.current++;
        onAuthExpiredRef.current?.();
        if (authFailures.current >= 5) {
          setStatus("disconnected");
          onStatusChangeRef.current?.("disconnected");
          return;
        }
      }

      setStatus("reconnecting");
      onStatusChangeRef.current?.("reconnecting");
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempt.current), 30000);
      reconnectAttempt.current++;
      reconnectTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      if (intentionalCloseRef.current || wsRef.current !== ws) return;
      ws.close();
    };
  }, [bookingId, token]); // Only reconnect when bookingId or token changes

  useEffect(() => {
    connect();
    return () => {
      // Mark close as intentional BEFORE actually closing so onclose doesn't reconnect.
      intentionalCloseRef.current = true;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const sendTyping = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "typing" }));
    }
  }, []);

  const sendRead = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "read" }));
    }
  }, []);

  return { status, sendTyping, sendRead };
}
