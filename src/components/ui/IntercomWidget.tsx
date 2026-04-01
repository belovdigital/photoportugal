"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

const APP_ID = "d02q0i7w";

export function IntercomWidget() {
  const { data: session, status } = useSession();
  const bootedRef = useRef(false);

  useEffect(() => {
    // Don't do anything while session is loading
    if (status === "loading") return;

    // Load Intercom script once
    if (!(window as any).Intercom) {
      const w = window as any;
      const ic = function (...args: any[]) { ic.c(args); };
      ic.q = [] as any[];
      ic.c = function (args: any) { ic.q.push(args); };
      w.Intercom = ic;
      const s = document.createElement("script");
      s.type = "text/javascript";
      s.async = true;
      s.src = `https://widget.intercom.io/widget/${APP_ID}`;
      s.setAttribute("data-cfasync", "false");
      document.head.appendChild(s);
    }

    const user = session?.user as { id?: string; email?: string; name?: string; role?: string } | undefined;
    const method = bootedRef.current ? "update" : "boot";

    if (user?.id) {
      (window as any).Intercom(method, {
        app_id: APP_ID,
        user_id: user.id,
        name: user.name || undefined,
        email: user.email || undefined,
        user_role: user.role || "client",
      });
    } else {
      (window as any).Intercom(method, {
        app_id: APP_ID,
      });
    }
    bootedRef.current = true;
  }, [session, status]);

  return null;
}
