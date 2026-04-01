"use client";

import { useEffect } from "react";

export function IntercomWidget() {
  useEffect(() => {
    // Skip if already loaded
    if ((window as any).__intercomLoaded) return;
    (window as any).__intercomLoaded = true;

    // 1. Load Intercom script
    const script = document.createElement("script");
    script.src = "https://widget.intercom.io/widget/d02q0i7w";
    script.async = true;
    script.setAttribute("data-cfasync", "false");
    document.head.appendChild(script);

    script.onload = () => {
      // 2. Boot anonymous
      (window as any).Intercom("boot", { app_id: "d02q0i7w" });

      // 3. Fetch user data and update
      fetch("/api/auth/me")
        .then(r => r.json())
        .then(user => {
          if (user && user.id) {
            (window as any).Intercom("update", {
              user_id: user.id,
              name: user.name || "",
              email: user.email || "",
              user_role: user.role || "client",
            });
          }
        })
        .catch(() => {});
    };
  }, []);

  return null;
}
