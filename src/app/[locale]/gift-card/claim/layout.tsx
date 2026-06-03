import type { Metadata } from "next";

// Magic-link claim landing — must not be indexed. URLs carry one-time
// tokens; serving them via search would leak recipient identity.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function GiftCardClaimLayout({ children }: { children: React.ReactNode }) {
  return children;
}
