"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import Intercom from "@intercom/messenger-js-sdk";

const APP_ID = "d02q0i7w";

export function IntercomWidget() {
  const { data: session } = useSession();

  useEffect(() => {
    const user = session?.user as { id?: string; email?: string; name?: string; role?: string } | undefined;

    if (user?.id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (Intercom as any)({
        app_id: APP_ID,
        user_id: user.id,
        name: user.name || undefined,
        email: user.email || undefined,
        custom_attributes: {
          role: user.role || "client",
        },
      });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (Intercom as any)({
        app_id: APP_ID,
      });
    }
  }, [session]);

  return null;
}
