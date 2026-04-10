"use client";

import dynamic from "next/dynamic";

const IntercomWidget = dynamic(
  () => import("@/components/ui/IntercomWidget").then(m => m.IntercomWidget),
  { ssr: false }
);

export function LazyIntercom() {
  return <IntercomWidget />;
}
