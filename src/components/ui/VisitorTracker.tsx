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

      // Capture UTM params and gclid from URL
      const params = new URLSearchParams(window.location.search);
      const utmSource = params.get("utm_source");
      const utmMedium = params.get("utm_medium");
      const utmCampaign = params.get("utm_campaign");
      const utmTerm = params.get("utm_term");
      const gclid = params.get("gclid");

      // If gclid present but no utm_source, auto-tag as Google Ads
      const effectiveSource = utmSource || (gclid ? "google" : null);
      const effectiveMedium = utmMedium || (gclid ? "cpc" : null);

      // Persist UTMs for signup/booking forms — store in localStorage with 90-day attribution window
      const persist = (key: string, value: string) => {
        try {
          sessionStorage.setItem(key, value);
          localStorage.setItem(`pp_${key}`, JSON.stringify({ v: value, ts: Date.now() }));
        } catch {}
      };
      if (effectiveSource) {
        persist("utm_source", effectiveSource);
        if (effectiveMedium) persist("utm_medium", effectiveMedium);
        if (utmCampaign) persist("utm_campaign", utmCampaign);
        if (utmTerm) persist("utm_term", utmTerm);
      }
      if (gclid) persist("gclid", gclid);

      // Start new session
      fetch("/api/track-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitor_id: visitorId,
          session_id: sessionId,
          referrer: document.referrer || null,
          utm_source: effectiveSource || sessionStorage.getItem("utm_source") || null,
          utm_medium: effectiveMedium || sessionStorage.getItem("utm_medium") || null,
          utm_campaign: utmCampaign || sessionStorage.getItem("utm_campaign") || null,
          utm_term: utmTerm || sessionStorage.getItem("utm_term") || null,
          gclid: gclid || sessionStorage.getItem("gclid") || null,
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

  // Send duration for current page on leave/hide
  useEffect(() => {
    const sendExitDuration = () => {
      const sessionId = sessionStorage.getItem("vs_sid");
      if (!sessionId || !lastPathRef.current) return;
      const duration = Date.now() - lastTimestampRef.current;
      if (duration < 1000) return; // ignore sub-second
      const blob = new Blob(
        [JSON.stringify({ session_id: sessionId, duration_ms: duration })],
        { type: "application/json" }
      );
      navigator.sendBeacon("/api/track-session-duration", blob);
    };

    const handleVisChange = () => {
      if (document.visibilityState === "hidden") sendExitDuration();
    };

    document.addEventListener("visibilitychange", handleVisChange);
    return () => document.removeEventListener("visibilitychange", handleVisChange);
  }, []);

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
