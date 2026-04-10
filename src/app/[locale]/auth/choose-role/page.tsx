import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { setRequestLocale } from "next-intl/server";
import { ChooseRoleClient } from "./ChooseRoleClient";

export default async function ChooseRolePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const role = (session.user as { role?: string | null }).role;
  if (role) redirect("/dashboard");

  return <ChooseRoleClient />;
}
