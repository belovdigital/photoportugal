import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardMobileNav } from "@/components/layout/DashboardMobileNav";
import { PendingReviewBanner } from "@/components/layout/PendingReviewBanner";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/signin");
  }

  const role = (session.user as { role?: string | null }).role;
  if (!role) {
    // Preserve where they were trying to go so choose-role can bounce
    // them back after picking a role (was hard-coded to /photographers,
    // which broke deep-links like /dashboard/messages — caused redirect
    // loops when NextAuth's callbackUrl pointed inside /dashboard).
    const h = await headers();
    const xPath = h.get("x-pathname");
    let callback = "";
    if (xPath && xPath.startsWith("/")) {
      callback = xPath;
    } else {
      const referer = h.get("referer") || "";
      try {
        const r = new URL(referer);
        // After NextAuth signin the referer is /auth/signin?callbackUrl=…
        const cb = r.searchParams.get("callbackUrl");
        if (cb && cb.startsWith("/")) callback = cb;
      } catch { /* no referer or invalid URL */ }
    }
    redirect(`/auth/choose-role${callback ? `?callbackUrl=${encodeURIComponent(callback)}` : ""}`);
  }

  const userId = (session.user as { id?: string }).id;
  const { locale } = await params;

  return (
    <div>
      {userId && <PendingReviewBanner userId={userId} role={role} locale={locale} />}
      <div className="mx-auto flex max-w-screen-xl">
        <DashboardSidebar initialRole={role} />
        <main className="min-h-[50vh] flex-1 overflow-x-hidden pb-24 md:pb-40">
          {children}
        </main>
        <DashboardMobileNav initialRole={role} />
      </div>
    </div>
  );
}
