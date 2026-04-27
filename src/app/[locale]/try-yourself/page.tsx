import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TryYourselfClient } from "./TryYourselfClient";
import { SCENES } from "@/lib/ai-scenes";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "tryYourself" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    robots: { index: false, follow: false }, // experimental landing — keep out of search until validated
  };
}

export default async function TryYourselfPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Pass scene IDs + visual metadata from server (canonical list); names come from translations client-side.
  const scenes = SCENES.map((s) => ({
    id: s.id,
    emoji: s.emoji,
    gradient: s.gradient,
    conciergeLoc: s.conciergeLoc,
  }));

  return <TryYourselfClient locale={locale} scenes={scenes} />;
}
