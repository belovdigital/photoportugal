"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

const APP_ID = "d02q0i7w";

export function IntercomWidget() {
  const { data: session } = useSession();

  useEffect(() => {
    // Load Intercom script
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
      s.setAttribute("data-cfasync", "false"); // bypass Cloudflare Rocket Loader
      document.head.appendChild(s);
    }

    const user = session?.user as { id?: string; email?: string; name?: string; role?: string } | undefined;
    const intercom = (window as any).Intercom;
    const booted = (window as any).__intercom_booted;

    if (user?.id) {
      const settings = {
        app_id: APP_ID,
        user_id: user.id,
        name: user.name || undefined,
        email: user.email || undefined,
        user_role: user.role || "client",
      };
      if (booted) {
        intercom("update", settings);
      } else {
        intercom("boot", settings);
        (window as any).__intercom_booted = true;
      }
    } else {
      if (!booted) {
        intercom("boot", { app_id: APP_ID });
        (window as any).__intercom_booted = true;
      }
    }
  }, [session]);

  return null;
}
