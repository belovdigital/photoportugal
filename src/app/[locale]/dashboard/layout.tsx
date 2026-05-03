import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
    redirect("/auth/choose-role");
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
