"use client";

import { Suspense, use } from "react";
import { MessagesContent } from "../page";

export default function MessageRedirect({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = use(params);
  return (
    <Suspense>
      <MessagesContent initialChatId={bookingId} />
    </Suspense>
  );
}
