"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

const EVENT_TYPES = ["corporate_event", "conference", "team_headshots", "brand_content", "real_estate", "other"] as const;

/** B2B inquiry form. Posts to /api/business-inquiry → admin email + TG +
 *  admin dashboard. `?photographer=<slug>` (from profile cards) rides along
 *  so admins see who the company was looking at. */
export function BusinessInquiryForm({ source = "business_page" }: { source?: string }) {
  const t = useTranslations("business.form");
  const searchParams = useSearchParams();
  const photographerSlug = searchParams.get("photographer");

  const [fields, setFields] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    event_type: "corporate_event",
    event_date: "",
    location: "",
    headcount: "",
    message: "",
  });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setFields((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/business-inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, source, photographer_slug: photographerSlug || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("submitFailed"));
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="border border-[#1F1B17]/15 bg-[#FAF6F0] p-10 text-center">
        <svg className="mx-auto h-8 w-8 text-[#1F1B17]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <h3 className="mt-4 text-xl font-semibold text-[#1F1B17]">{t("thanksTitle")}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#1F1B17]/65">{t("thanksText")}</p>
      </div>
    );
  }

  // Editorial form language (matches the /for-business page): sharp
  // corners, hairline borders, small-caps labels, charcoal focus.
  const inputCls = "mt-2 block w-full border border-[#1F1B17]/20 bg-white px-4 py-3 text-base text-[#1F1B17] outline-none transition placeholder:text-[#1F1B17]/35 focus:border-[#1F1B17] md:text-sm";
  const labelCls = "block text-[11px] font-semibold uppercase tracking-[0.15em] text-[#1F1B17]/55";

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelCls}>{t("company")} *</label>
          <input required maxLength={200} className={inputCls} value={fields.company_name} onChange={set("company_name")} placeholder={t("companyPh")} />
        </div>
        <div>
          <label className={labelCls}>{t("contactName")} *</label>
          <input required maxLength={200} className={inputCls} value={fields.contact_name} onChange={set("contact_name")} placeholder={t("contactNamePh")} />
        </div>
        <div>
          <label className={labelCls}>{t("email")} *</label>
          <input required type="email" maxLength={255} className={inputCls} value={fields.email} onChange={set("email")} placeholder="name@company.com" />
        </div>
        <div>
          <label className={labelCls}>{t("phone")}</label>
          <input maxLength={50} className={inputCls} value={fields.phone} onChange={set("phone")} placeholder="+351 …" />
        </div>
        <div>
          <label className={labelCls}>{t("eventType")}</label>
          <select className={inputCls} value={fields.event_type} onChange={set("event_type")}>
            {EVENT_TYPES.map((et) => (
              <option key={et} value={et}>{t(`types.${et}`)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>{t("eventDate")}</label>
          <input type="date" className={inputCls} value={fields.event_date} onChange={set("event_date")} />
        </div>
        <div>
          <label className={labelCls}>{t("location")}</label>
          <input maxLength={200} className={inputCls} value={fields.location} onChange={set("location")} placeholder={t("locationPh")} />
        </div>
        <div>
          <label className={labelCls}>{t("headcount")}</label>
          <input maxLength={50} className={inputCls} value={fields.headcount} onChange={set("headcount")} placeholder="~50" />
        </div>
      </div>
      <div>
        <label className={labelCls}>{t("message")}</label>
        <textarea rows={4} maxLength={5000} className={inputCls} value={fields.message} onChange={set("message")} placeholder={t("messagePh")} />
      </div>
      {error && (
        <p className="border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p>
      )}
      <button
        type="submit"
        disabled={sending}
        className="w-full bg-[#1F1B17] px-6 py-4 text-sm font-semibold tracking-wide text-white transition hover:bg-[#3a332c] disabled:opacity-50 sm:w-auto sm:px-12"
      >
        {sending ? t("sending") : t("submit")}
      </button>
      <p className="text-xs text-[#1F1B17]/45">{t("sla")}</p>
    </form>
  );
}
