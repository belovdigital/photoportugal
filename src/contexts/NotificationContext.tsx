"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useSession } from "next-auth/react";

interface NotificationData {
  unread_messages: number;
  pending_bookings: number;
}

const NotificationContext = createContext<NotificationData>({
  unread_messages: 0,
  pending_bookings: 0,
});

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [data, setData] = useState<NotificationData>({ unread_messages: 0, pending_bookings: 0 });

  useEffect(() => {
    if (!session?.user) return;

    function fetchNotifications() {
      fetch("/api/notifications")
        .then((r) => r.json())
        .then(setData)
        .catch(() => {});
    }

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 8000);
    return () => clearInterval(interval);
  }, [session?.user]);

  return (
    <NotificationContext.Provider value={data}>
      {children}
    </NotificationContext.Provider>
  );
}
