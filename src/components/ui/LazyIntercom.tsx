"use client";

import dynamic from "next/dynamic";
import { country } from "@/lib/country";

const IntercomWidget = dynamic(
  () => import("@/components/ui/IntercomWidget").then(m => m.IntercomWidget),
  { ssr: false }
);

export function LazyIntercom() {
  // Markets without an Intercom workspace never render the widget, so the
  // chunk is never fetched and no script is injected at all.
  if (!country.intercomAppId) return null;
  return <IntercomWidget />;
}
