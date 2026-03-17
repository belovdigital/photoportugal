import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/signin");
  }

  return (
    <div className="mx-auto flex max-w-screen-xl">
      <DashboardSidebar />
      <main className="min-h-[calc(100vh-100px)] flex-1 overflow-x-hidden border-r border-warm-200">
        {children}
      </main>
    </div>
  );
}
