import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/signin");
  }

  const role = (session.user as { role?: string | null }).role;
  if (!role) {
    redirect("/auth/choose-role");
  }

  return (
    <div className="mx-auto flex max-w-screen-xl">
      <DashboardSidebar />
      <main className="min-h-[50vh] flex-1 overflow-x-hidden pb-40">
        {children}
      </main>
    </div>
  );
}
