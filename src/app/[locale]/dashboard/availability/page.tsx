import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { AvailabilityTab } from "../photographer/AvailabilityTab";

export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const userId = (session.user as { id?: string }).id;
  const userRow = await queryOne<{ role: string }>("SELECT role FROM users WHERE id = $1", [userId]);
  if (!userRow || userRow.role !== "photographer") redirect("/dashboard");

  const t = await getTranslations("availability");
  return (
    <div className="p-6 sm:p-8">
      <h1 className="font-display text-2xl font-bold text-gray-900">{t("pageTitle")}</h1>
      <div className="mt-4">
        <AvailabilityTab />
      </div>
    </div>
  );
}
