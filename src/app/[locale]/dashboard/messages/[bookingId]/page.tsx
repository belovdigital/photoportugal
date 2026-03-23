"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";

export default function MessageRedirect({ params }: { params: Promise<{ bookingId: string }> }) {
  const router = useRouter();

  useEffect(() => {
    params.then(({ bookingId }) => {
      router.replace(`/dashboard/messages?chat=${bookingId}`);
    });
  }, [params, router]);

  return null;
}
