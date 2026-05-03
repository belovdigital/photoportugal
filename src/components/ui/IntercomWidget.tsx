"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Routes where Intercom should never load (chat-style pages where it competes)
const SUPPRESS_INTERCOM_ROUTES = ["/concierge"];

export function IntercomWidget() {
  const pathname = usePathname();

  useEffect(() => {
    if (SUPPRESS_INTERCOM_ROUTES.some(r => pathname.includes(r))) return;
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
          // Compute vertical_padding at boot time too — Intercom on
          // some browsers (notably mobile Safari) only honours the
          // padding from the initial boot settings and ignores later
          // `update` calls. Computing it here from the CURRENT
          // pathname guarantees the launcher starts at the correct
          // height; route changes after boot still go through the
          // second useEffect's update.
          const path = window.location.pathname;
          const hasBottomBar = isMobile && (
            /^\/(?:[a-z]{2}\/)?locations\/[^/]+/.test(path) ||
            /^\/(?:[a-z]{2}\/)?photographers\/[^/]+/.test(path) ||
            /^\/(?:[a-z]{2}\/)?photoshoots\/[^/]+/.test(path) ||
            path.includes("/dashboard")
          );
          const settings: Record<string, unknown> = {
            app_id: "d02q0i7w",
            is_mobile: isMobile,
            device_type: isMobile ? "mobile" : "desktop",
            vertical_padding: hasBottomBar ? 100 : 20,
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

  // Lift Intercom above sticky mobile bottom bars. The Intercom JS
  // `vertical_padding` setting is silently ignored by the mobile
  // launcher (only the desktop launcher honours it), so we go with a
  // CSS-level override that targets the iframe wrappers Intercom
  // injects into our DOM. Toggling a body class lets us scope the
  // override to routes that actually have a sticky bottom bar.
  //
  // Selectors cover both the pre-boot lightweight launcher and the
  // fully booted iframe launcher; Intercom switches between them
  // depending on session state.
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    const isAdmin = pathname.includes("/admin");
    const isLocationDetail = /^\/(?:[a-z]{2}\/)?locations\/[^/]+/.test(pathname);
    const isPhotographerProfile = /^\/(?:[a-z]{2}\/)?photographers\/[^/]+/.test(pathname);
    const isPhotoshootType = /^\/(?:[a-z]{2}\/)?photoshoots\/[^/]+/.test(pathname);
    const isDashboard = pathname.includes("/dashboard");

    const hasMobileBottomBar =
      isMobile && (isLocationDetail || isPhotographerProfile || isPhotoshootType || isDashboard);

    document.body.classList.toggle("intercom-lifted", hasMobileBottomBar);

    // Also send hide_default_launcher and page through Intercom for
    // analytics/admin behaviour, with retry for boot delay.
    const settings = {
      hide_default_launcher: isAdmin,
      page: pathname,
    };
    let attempts = 0;
    const apply = () => {
      const ic = (window as Window & { Intercom?: (cmd: string, s?: unknown) => void }).Intercom;
      if (typeof ic === "function") {
        ic("update", settings);
        return true;
      }
      return false;
    };
    if (apply()) return;
    const id = setInterval(() => {
      attempts += 1;
      if (apply() || attempts > 60) clearInterval(id);
    }, 500);
    return () => clearInterval(id);
  }, [pathname]);

  return null;
}
