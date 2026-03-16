"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MessageRedirect({ params }: { params: Promise<{ bookingId: string }> }) {
  const router = useRouter();

  useEffect(() => {
    params.then(({ bookingId }) => {
      router.replace(`/dashboard/messages?chat=${bookingId}`);
    });
  }, [params, router]);

  return null;
}
