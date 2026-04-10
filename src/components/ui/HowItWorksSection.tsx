import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { StripeLogo } from "@/components/ui/StripeLogo";

const STEP_KEYS = ["browse", "book", "enjoy", "receive"] as const;

const stepMeta = [
  {
    iconBg: "bg-primary-500",
    numberBg: "bg-primary-100 text-primary-700",
    icon: (
      <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    iconBg: "bg-accent-500",
    numberBg: "bg-accent-50 text-accent-700",
    icon: (
      <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    iconBg: "bg-yellow-500",
    numberBg: "bg-yellow-50 text-yellow-700",
    icon: (
      <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    iconBg: "bg-blue-500",
    numberBg: "bg-blue-50 text-blue-700",
    icon: (
      <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
];

export async function HowItWorksSection() {
  const t = await getTranslations("howItWorks");

  return (
    <section className="relative overflow-hidden bg-warm-50">
      <div className="absolute -left-20 top-10 h-64 w-64 rounded-full bg-primary-100/30 blur-3xl" />
      <div className="absolute -right-20 bottom-10 h-64 w-64 rounded-full bg-accent-100/30 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="text-center">
          <span className="inline-block rounded-full bg-primary-100 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-primary-700">
            {t("badge")}
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold text-gray-900 sm:text-4xl">
            {t("title")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-gray-500">
            {t("subtitle")}
          </p>
        </div>

        {/* Steps */}
        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
          {STEP_KEYS.map((key, i) => (
            <div key={key} className="relative flex flex-col items-center text-center lg:px-6">
              {/* Connector line between steps (desktop only) */}
              {i < STEP_KEYS.length - 1 && (
                <div className="absolute left-[calc(50%+32px)] right-[calc(-50%+32px)] top-6 hidden border-t-2 border-dashed border-warm-300 lg:block" />
              )}

              {/* Icon */}
              <div className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-xl ${stepMeta[i].iconBg} shadow-lg`}>
                {stepMeta[i].icon}
              </div>

              {/* Number badge */}
              <span className={`mt-4 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${stepMeta[i].numberBg}`}>
                {i + 1}
              </span>

              <h3 className="mt-2 text-lg font-bold text-gray-900">{t(`steps.${key}.title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                {key === "browse"
                  ? t.rich(`steps.${key}.description`, {
                      browse: (chunks) => (
                        <Link href="/photographers" className="font-medium text-primary-600 underline decoration-primary-300 hover:text-primary-700">
                          {chunks}
                        </Link>
                      ),
                      concierge: (chunks) => (
                        <Link href="/find-photographer" className="font-medium text-primary-600 underline decoration-primary-300 hover:text-primary-700">
                          {chunks}
                        </Link>
                      ),
                    })
                  : t(`steps.${key}.description`)}
              </p>

              {/* Detail */}
              <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-gray-400">
                <svg className="h-3.5 w-3.5 shrink-0 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {t(`steps.${key}.detail`)}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/choose-booking-type"
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-8 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-primary-700 hover:shadow-xl"
          >
            {t("findYourPhotographer")}
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>

        {/* Payment Protection Trust Block */}
        <div className="mt-16 rounded-2xl border border-accent-200 bg-accent-50/50 p-6 sm:p-8">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-500 shadow-lg">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-lg font-bold text-gray-900">{t("paymentProtection.title")}</h3>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-500">
                  {t("paymentProtection.poweredBy")}
                  <StripeLogo className="h-[14px] w-auto text-[#635BFF]" />
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                {t("paymentProtection.description")}
              </p>
              <div className="mt-4 flex flex-wrap gap-4 text-xs font-medium text-gray-500">
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  {t("paymentProtection.heldUntilDelivery")}
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  {t("paymentProtection.confirmBeforeRelease")}
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  {t("paymentProtection.fullRefund")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
