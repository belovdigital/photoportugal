import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { setRequestLocale } from "next-intl/server";
import { ChooseRoleClient } from "./ChooseRoleClient";

export default async function ChooseRolePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { locale } = await params;
  const { callbackUrl } = await searchParams;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const role = (session.user as { role?: string | null }).role;
  if (role) {
    // Already chose a role — honour the callback if it's a safe internal path,
    // otherwise default to dashboard.
    const safeCallback = callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
      ? callbackUrl
      : "/dashboard";
    redirect(safeCallback);
  }

  return <ChooseRoleClient callbackUrl={callbackUrl} />;
}
