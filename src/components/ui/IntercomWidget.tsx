"use client";

import { useEffect } from "react";

export function IntercomWidget() {
  useEffect(() => {
    if ((window as any).__intercomLoaded) return;
    (window as any).__intercomLoaded = true;

    // 1. Fetch user first, THEN load and boot Intercom with full data
    fetch("/api/auth/me")
      .then(r => r.json())
      .catch(() => null)
      .then(user => {
        const settings: Record<string, unknown> = { app_id: "d02q0i7w" };
        if (user && user.id) {
          settings.user_id = user.id;
          settings.name = user.name || "";
          settings.email = user.email || "";
          settings.user_role = user.role || "client";
        }

        // 2. Load script
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

  return null;
}
