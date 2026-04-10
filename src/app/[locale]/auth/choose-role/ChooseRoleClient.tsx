"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Camera, MapPin } from "lucide-react";

export function ChooseRoleClient() {
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();
  const { update } = useSession();
  const t = useTranslations("chooseRole");

  async function selectRole(role: "client" | "photographer") {
    setLoading(role);
    try {
      await fetch(`/api/auth/set-role?role=${role}`, { redirect: "manual" });
      // Force NextAuth to refresh the JWT with updated role from DB
      await update({ role });
      // Small delay to ensure cookie is written, then hard redirect
      await new Promise(r => setTimeout(r, 300));
      window.location.href = role === "photographer" ? "/dashboard/photographer" : "/photographers";
    } catch {
      setLoading(null);
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-lg text-center">
        <img src="/logo.svg" alt="Photo Portugal" className="mx-auto mb-8 h-8" />
        <h1 className="font-display text-3xl font-bold text-gray-900">{t("title")}</h1>
        <p className="mt-2 text-gray-500">{t("subtitle")}</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {/* Tourist / Client */}
          <button
            onClick={() => selectRole("client")}
            disabled={loading !== null}
            className={`group relative flex h-48 flex-col justify-start rounded-2xl border-2 p-6 text-left transition hover:shadow-lg ${
              loading === "client" ? "border-primary-400 bg-primary-50" : "border-warm-200 hover:border-primary-300"
            } ${loading && loading !== "client" ? "opacity-50" : ""}`}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
              <MapPin className="h-5 w-5" />
            </div>
            <h3 className="mt-3 text-lg font-bold text-gray-900">{t("tourist")}</h3>
            <p className="mt-1 text-sm text-gray-500">{t("touristDesc")}</p>
            {loading === "client" && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
              </div>
            )}
          </button>

          {/* Photographer */}
          <button
            onClick={() => selectRole("photographer")}
            disabled={loading !== null}
            className={`group relative flex h-48 flex-col justify-start rounded-2xl border-2 p-6 text-left transition hover:shadow-lg ${
              loading === "photographer" ? "border-blue-400 bg-blue-50" : "border-warm-200 hover:border-blue-300"
            } ${loading && loading !== "photographer" ? "opacity-50" : ""}`}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <Camera className="h-5 w-5" />
            </div>
            <h3 className="mt-3 text-lg font-bold text-gray-900">{t("photographer")}</h3>
            <p className="mt-1 text-sm text-gray-500">{t("photographerDesc")}</p>
            {loading === "photographer" && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
