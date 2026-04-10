import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (session?.user) {
    const role = (session.user as { role?: string | null }).role;
    if (!role) {
      // Null role — let them through to choose-role (rendered under this layout)
      return children;
    }
    redirect("/dashboard");
  }
  return children;
}
