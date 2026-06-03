import type { Metadata } from "next";

// Post-purchase confirmation — must not be indexed. Visiting via search
// is meaningless (it's per-card state) and would leak buyer info.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function GiftCardSuccessLayout({ children }: { children: React.ReactNode }) {
  return children;
}
