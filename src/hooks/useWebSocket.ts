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
  onTyping?: (userId: string, userName: string) => void;
  onRead?: (userId: string, timestamp: string) => void;
  onOnline?: (users: { userId: string; userName: string }[]) => void;
  onStatusChange?: (status: "connected" | "disconnected" | "reconnecting") => void;
}

export function useWebSocket({
  bookingId,
  token,
  onMessage,
  onTyping,
  onRead,
  onOnline,
  onStatusChange,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempt = useRef(0);
  const [status, setStatus] = useState<"connected" | "disconnected" | "reconnecting">("disconnected");

  // Use refs for callbacks to avoid reconnecting on every render
  const onMessageRef = useRef(onMessage);
  const onTypingRef = useRef(onTyping);
  const onReadRef = useRef(onRead);
  const onOnlineRef = useRef(onOnline);
  const onStatusChangeRef = useRef(onStatusChange);
  onMessageRef.current = onMessage;
  onTypingRef.current = onTyping;
  onReadRef.current = onRead;
  onOnlineRef.current = onOnline;
  onStatusChangeRef.current = onStatusChange;

  const connect = useCallback(() => {
    if (!bookingId || !token) return;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttempt.current = 0;
      setStatus("connected");
      onStatusChangeRef.current?.("connected");
      ws.send(JSON.stringify({ type: "join", booking_id: bookingId }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case "message":
            onMessageRef.current?.(data.message);
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

    ws.onclose = () => {
      setStatus("reconnecting");
      onStatusChangeRef.current?.("reconnecting");
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempt.current), 30000);
      reconnectAttempt.current++;
      reconnectTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [bookingId, token]); // Only reconnect when bookingId or token changes

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
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
