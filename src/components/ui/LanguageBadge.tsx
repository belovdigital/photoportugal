"use client";

import { useTranslations, useLocale } from "next-intl";
import { speaksEnglish, nonEnglishLanguages } from "@/lib/languages";
import { localizeLanguageNames } from "@/lib/languages-i18n";

// Prominent English-capability badge. Clients kept booking photographers
// they couldn't talk to because languages rendered as tiny gray text (or
// not at all on compact cards). One loud signal either way:
//   🇬🇧 "I speak English"  (green)  — English in languages[]
//   ⚠️ "No English"        (amber)  — languages declared, English absent
//   ⚠️ "Languages not specified" (amber) — empty languages[]
// Other languages render smaller next to/under the chip.
export function LanguageBadge({
  languages,
  size = "sm",
  showOthers = true,
  className = "",
}: {
  languages: string[] | null | undefined;
  size?: "sm" | "md";
  showOthers?: boolean;
  className?: string;
}) {
  const t = useTranslations("languageBadge");
  const locale = useLocale();
  const langs = languages || [];
  const en = speaksEnglish(langs);
  const declared = langs.filter((l) => l && l.trim() !== "").length > 0;
  const others = localizeLanguageNames(nonEnglishLanguages(langs), locale);

  const chipSize = size === "md" ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-xs";
  const chip = en
    ? { cls: "bg-green-50 text-green-700 border-green-200", icon: "🇬🇧", label: t("speaksEnglish") }
    : declared
      ? { cls: "bg-amber-50 text-amber-800 border-amber-300", icon: "⚠️", label: t("noEnglish") }
      : { cls: "bg-amber-50 text-amber-800 border-amber-300", icon: "⚠️", label: t("notSpecified") };

  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${className}`}>
      <span className={`inline-flex items-center gap-1 rounded-full border font-semibold ${chipSize} ${chip.cls}`}>
        <span aria-hidden="true">{chip.icon}</span>
        {chip.label}
      </span>
      {showOthers && others.length > 0 && (
        <span className={`text-gray-400 ${size === "md" ? "text-sm" : "text-xs"}`}>
          {en ? "+ " : ""}{others.join(", ")}
        </span>
      )}
    </div>
  );
}
