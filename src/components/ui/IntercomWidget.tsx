"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function IntercomWidget() {
  const pathname = usePathname();

  useEffect(() => {
    if ((window as any).__intercomLoaded) return;
    (window as any).__intercomLoaded = true;

    // 1. Fetch user, sync to Intercom via server API, then boot widget
    fetch("/api/auth/me")
      .then(r => r.json())
      .catch(() => null)
      .then(user => {
        const settings: Record<string, unknown> = { app_id: "d02q0i7w" };
        if (user && user.id) {
          settings.user_id = user.id;
          settings.name = user.name || "";
          settings.email = user.email || "";
          fetch("/api/intercom/sync", { method: "POST" }).catch(() => {});
        } else {
          // Guest context for proactive messages
          settings.user_type = "guest";
        }

        // 2. Load widget script
        const script = document.createElement("script");
        script.src = "https://widget.intercom.io/widget/d02q0i7w";
        script.async = true;
        script.setAttribute("data-cfasync", "false");
        document.head.appendChild(script);

        script.onload = () => {
          (window as any).Intercom("boot", settings);
        };
      });
  }, []);

  // Update Intercom on page navigation
  useEffect(() => {
    if ((window as any).Intercom) {
      (window as any).Intercom("update", { page: pathname });
    }
  }, [pathname]);

  return null;
}
