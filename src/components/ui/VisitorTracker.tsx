"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

function generateId(): string {
  return crypto.randomUUID();
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 min

export function VisitorTracker() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const lastPathRef = useRef<string | null>(null);
  const lastTimestampRef = useRef<number>(Date.now());
  const linkedRef = useRef(false);
  const initializedRef = useRef(false);

  // Initialize visitor + session on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Get or create visitor_id (persists across sessions via cookie)
    let visitorId = getCookie("vid");
    if (!visitorId) {
      visitorId = generateId();
      setCookie("vid", visitorId, 365);
    }

    // Check session state
    const lastActivity = parseInt(sessionStorage.getItem("vs_last") || "0");
    const existingSessionId = sessionStorage.getItem("vs_sid");
    const isNewSession = !existingSessionId || (Date.now() - lastActivity) > SESSION_TIMEOUT;

    if (isNewSession) {
      const sessionId = generateId();
      sessionStorage.setItem("vs_sid", sessionId);
      sessionStorage.setItem("vs_last", String(Date.now()));

      // Capture UTM params from URL
      const params = new URLSearchParams(window.location.search);
      const utmSource = params.get("utm_source");
      const utmMedium = params.get("utm_medium");
      const utmCampaign = params.get("utm_campaign");
      const utmTerm = params.get("utm_term");

      // Persist UTMs for signup forms
      if (utmSource) {
        sessionStorage.setItem("utm_source", utmSource);
        if (utmMedium) sessionStorage.setItem("utm_medium", utmMedium);
        if (utmCampaign) sessionStorage.setItem("utm_campaign", utmCampaign);
        if (utmTerm) sessionStorage.setItem("utm_term", utmTerm);
      }

      // Start new session
      fetch("/api/track-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitor_id: visitorId,
          session_id: sessionId,
          referrer: document.referrer || null,
          utm_source: utmSource || sessionStorage.getItem("utm_source") || null,
          utm_medium: utmMedium || sessionStorage.getItem("utm_medium") || null,
          utm_campaign: utmCampaign || sessionStorage.getItem("utm_campaign") || null,
          utm_term: utmTerm || sessionStorage.getItem("utm_term") || null,
          landing_page: window.location.pathname,
          screen_width: window.innerWidth,
          language: navigator.language,
        }),
      }).catch(() => {});
    } else {
      sessionStorage.setItem("vs_last", String(Date.now()));
    }

    lastPathRef.current = pathname;
    lastTimestampRef.current = Date.now();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track page changes
  useEffect(() => {
    if (!initializedRef.current) return;
    if (pathname === lastPathRef.current) return;

    const sessionId = sessionStorage.getItem("vs_sid");
    if (!sessionId) return;

    const prevDuration = Date.now() - lastTimestampRef.current;
    sessionStorage.setItem("vs_last", String(Date.now()));

    fetch("/api/track-session-pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        path: pathname,
        prev_duration_ms: prevDuration,
      }),
    }).catch(() => {});

    lastPathRef.current = pathname;
    lastTimestampRef.current = Date.now();
  }, [pathname]);

  // Link visitor to user on login
  useEffect(() => {
    if (linkedRef.current) return;
    if (status !== "authenticated" || !session?.user) return;

    const visitorId = getCookie("vid");
    if (!visitorId) return;

    const linkKey = `vs_linked_${visitorId}`;
    if (sessionStorage.getItem(linkKey)) {
      linkedRef.current = true;
      return;
    }

    linkedRef.current = true;
    sessionStorage.setItem(linkKey, "1");

    fetch("/api/link-visitor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitor_id: visitorId }),
    }).catch(() => {});
  }, [status, session]);

  return null;
}
