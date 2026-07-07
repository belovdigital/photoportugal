import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
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

  const userId = (session.user as { id?: string }).id;
  let role = (session.user as { role?: string | null }).role;
  if (!role) {
    // No role yet → default to client and let them straight through.
    // Photographers always get role set explicitly via
    // /for-photographers/join → signup?role=photographer → set-role (the
    // intent survives Google OAuth via callbackUrl) BEFORE they reach the
    // dashboard, so a null role here is a client who signed in (typically via
    // Google) without picking one. This replaces the "Tourist or
    // Photographer?" interstitial that confused message-link clients AND
    // caused a choose-role ⇄ dashboard redirect loop whenever the JWT role
    // and DB role briefly disagreed. The JWT picks the role up from the DB
    // sync on the next request; we set `role` locally so THIS render is
    // already correct.
    if (userId) {
      try {
        await query("UPDATE users SET role = 'client' WHERE id = $1 AND role IS NULL", [userId]);
      } catch (e) {
        console.error("[dashboard] failed to default role to client:", e);
      }
    }
    role = "client";
  }

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
