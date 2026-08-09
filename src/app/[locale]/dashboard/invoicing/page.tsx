import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { Link } from "@/i18n/navigation";
import { country } from "@/lib/country";
import { getTranslations } from "next-intl/server";
import {
  OPERATING_ENTITY,
  activityStartLabel,
  invoicingAnnouncementApplies,
} from "@/lib/invoicing-announcement";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// What a Portuguese photographer has to do now that every shoot needs a fatura.
//
// Written as a page rather than a paragraph on /dashboard/payouts because the
// answer is genuinely six steps long and half of it happens on a government
// site we do not control. Portugal only — see invoicing-announcement.ts.
//
// One thing is deliberately NOT stated: the exact amount to invoice. That
// depends on whether the photographer bills the client the all-in price or
// only their own rate, which is an open decision. Rather than guess, the page
// points at the booking page, which is where the figure belongs anyway.

export default async function InvoicingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const userId = (session.user as { id?: string }).id;
  const user = await queryOne<{ role: string; name: string }>(
    "SELECT role, name FROM users WHERE id = $1",
    [userId]
  );
  // Clients have no business here, and neither does a market this does not
  // apply to — Spanish and Italian photographers answer to a different tax
  // authority and would read Portuguese rules as their own.
  if (user?.role !== "photographer" && user?.role !== "admin") redirect("/dashboard");
  if (!invoicingAnnouncementApplies) redirect("/dashboard");

  const { locale } = await params;
  const t = await getTranslations("invoicing");
  const startDate = activityStartLabel(locale);
  const entity = `${OPERATING_ENTITY.name} — ${OPERATING_ENTITY.form}, NIF ${OPERATING_ENTITY.nif}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-10">
        <p className="text-xs font-bold uppercase tracking-widest text-primary-600">
          {t("eyebrow")}
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold text-gray-900 sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-gray-600">
          {t("intro", { brand: country.brand, date: startDate })}
        </p>
      </header>

      {/* The single most reassuring fact, first: their money is untouched. */}
      <div className="rounded-2xl border border-green-200 bg-green-50 p-5 sm:p-6">
        <p className="text-sm font-bold uppercase tracking-wide text-green-800">
          {t("unchangedTitle")}
        </p>
        <p className="mt-2 text-[15px] leading-relaxed text-green-900">
          {t("unchangedBody")}
        </p>
      </div>

      <div className="mt-10 space-y-8">
        <Step
          n={1}
          title={t("s1title")}
          body={t("s1body", { brand: country.brand })}
          note={t("s1note")}
        />

        <Step
          n={2}
          title={t("s2title")}
          body={t("s2body")}
          note={t("s2note")}
          cta={{ href: "/dashboard/support", label: t("s2cta") }}
        />

        <Step n={3} title={t("s3title")} body={t("s3body")}>
          <ol className="mt-4 space-y-2.5 text-[15px] leading-relaxed text-gray-700">
            {["p1", "p2", "p3", "p4", "p5"].map((k, i) => (
              <li key={k} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warm-100 text-[11px] font-bold text-gray-600">
                  {i + 1}
                </span>
                <span>{t(`s3${k}`)}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 rounded-lg bg-warm-50 px-4 py-3 text-sm leading-relaxed text-gray-600">
            {t("s3deadline")}
          </p>
        </Step>

        {/* The amount is the one number they cannot get from this page. Say so
            plainly instead of offering a formula that may not survive the week. */}
        <Step n={4} title={t("s4title")} body={t("s4body")}>
          <div className="mt-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
            <p className="text-sm font-bold text-amber-900">{t("s4boxTitle")}</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-amber-900">
              {t("s4boxBody")}
            </p>
          </div>
        </Step>

        <Step
          n={5}
          title={t("s5title")}
          body={t("s5body", { entity })}
          note={t("s5note")}
        />

        <Step
          n={6}
          title={t("s6title")}
          body={t("s6body")}
          note={t("s6note")}
          cta={{ href: "/dashboard/profile", label: t("s6cta") }}
        />
      </div>

      {/* IVA gets its own block: it is the one thing that silently becomes
          wrong later, long after the photographer stopped reading. */}
      <section className="mt-10 rounded-2xl border border-warm-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="font-display text-xl font-bold text-gray-900 sm:text-2xl">
          {t("ivaTitle")}
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-gray-600">{t("ivaBody")}</p>
        <p className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-800">
          {t("ivaWarning")}
        </p>
      </section>

      {/* Shoots already delivered under the new activity still need documents,
          and their five-day clock is already running. Saying nothing here would
          leave people quietly late. */}
      <section className="mt-6 rounded-2xl border-2 border-red-300 bg-red-50 p-6 sm:p-8">
        <h2 className="font-display text-xl font-bold text-red-900">
          {t("backlogTitle")}
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-red-900">
          {t("backlogBody", { date: startDate })}
        </p>
        <Link
          href="/dashboard/bookings"
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          {t("backlogCta")}
        </Link>
      </section>

      <section className="mt-6 rounded-2xl border border-warm-200 bg-warm-50 p-6 sm:p-8">
        <h2 className="font-display text-lg font-bold text-gray-900">
          {t("limitsTitle")}
        </h2>
        <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-gray-700">
          {["l1", "l2", "l3"].map((k) => (
            <li key={k} className="flex gap-2.5">
              <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
              <span>{t(k)}</span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-6 rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50 to-warm-50 p-6 text-center sm:p-8">
        <p className="text-base font-semibold text-gray-900">{t("helpTitle")}</p>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-gray-700">
          {t("helpBody", { brand: country.brand })}
        </p>
        <Link
          href="/dashboard/support"
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
        >
          {t("helpCta")}
        </Link>
      </footer>
    </div>
  );
}

function Step({
  n,
  title,
  body,
  note,
  cta,
  children,
}: {
  n: number;
  title: string;
  body: string;
  /** Secondary line — the caveat, not the instruction. */
  note?: string;
  cta?: { href: string; label: string };
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-warm-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50 font-display text-lg font-bold text-primary-700">
          {n}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-bold text-gray-900 sm:text-2xl">
            {title}
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-gray-600">{body}</p>
          {children}
          {note && (
            <p className="mt-3 text-sm leading-relaxed text-gray-500">{note}</p>
          )}
          {cta && (
            <Link
              href={cta.href}
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:text-primary-700"
            >
              {cta.label} →
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
