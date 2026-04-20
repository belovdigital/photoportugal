"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function IntercomWidget() {
  const pathname = usePathname();

  useEffect(() => {
    if ((window as any).__intercomLoaded) return;

    // Delay Intercom load to avoid impacting initial page performance
    const loadIntercom = () => {
      if ((window as any).__intercomLoaded) return;
      (window as any).__intercomLoaded = true;

      fetch("/api/auth/me")
        .then(r => r.json())
        .catch(() => null)
        .then(user => {
          const isMobile = window.matchMedia("(max-width: 767px)").matches;
          const settings: Record<string, unknown> = {
            app_id: "d02q0i7w",
            is_mobile: isMobile,
            device_type: isMobile ? "mobile" : "desktop",
          };
          if (user && user.id) {
            settings.user_id = user.id;
            settings.name = user.name || "";
            settings.email = user.email || "";
            fetch("/api/intercom/sync", { method: "POST" }).catch(() => {});
          } else {
            settings.user_type = "guest";
          }

          const script = document.createElement("script");
          script.src = "https://widget.intercom.io/widget/d02q0i7w";
          script.async = true;
          script.setAttribute("data-cfasync", "false");
          document.head.appendChild(script);

          script.onload = () => {
            (window as any).Intercom("boot", settings);
          };
        });
    };

    // Load after 8s idle or on first user interaction, whichever comes first
    const timer = setTimeout(loadIntercom, 8000);
    const events = ["scroll", "click", "touchstart", "keydown"];
    const onInteraction = () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, onInteraction));
      loadIntercom();
    };
    events.forEach(e => window.addEventListener(e, onInteraction, { once: true, passive: true }));

    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, onInteraction));
    };
  }, []);

  // On mobile dashboard pages, push Intercom launcher up so it doesn't
  // overlap the bottom tab bar.
  useEffect(() => {
    if (!(window as any).Intercom) return;
    const isMobile = window.innerWidth < 768;
    const isDashboard = pathname.includes("/dashboard");
    const isAdmin = pathname.includes("/admin");
    (window as any).Intercom("update", {
      hide_default_launcher: isMobile && isAdmin,
      vertical_padding: isMobile && isDashboard ? 110 : 20,
      page: pathname,
    });
  }, [pathname]);

  return null;
}
