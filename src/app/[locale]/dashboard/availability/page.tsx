import { getTranslations } from "next-intl/server";
import { AvailabilityTab } from "../photographer/AvailabilityTab";

export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
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
