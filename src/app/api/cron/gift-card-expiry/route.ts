import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { sendEmail, emailLayout, emailButton } from "@/lib/email";
import { pickT, normalizeLocale, getUserLocaleById } from "@/lib/email-locale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Daily cron — two jobs in one pass:
//   1. Send expiry warning emails at 30 / 7 / 1 days before expiry,
//      one-shot per threshold per card (idempotency via _sent flags).
//   2. Expire cards whose expires_at has passed (status → 'expired',
//      silent breakage — no refund). Recipient is not notified at
//      expiry itself; the 1-day warning is their last call.
//
// Advisory-lock guards against parallel runs double-sending.
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lock = await queryOne<{ acquired: boolean }>(
    "SELECT pg_try_advisory_lock(917365413) as acquired"
  );
  if (!lock?.acquired) {
    return NextResponse.json({ ok: true, skipped: "lock_held" });
  }

  let warnings = 0;
  let expired = 0;
  try {
    // Warnings — three windows. Each flag latches the email so re-runs
    // are no-ops, and a card that's already redeemed/expired never gets
    // a warning.
    const tiers = [
      { days: 30, flag: "expiry_warning_30d_sent", label: "30 days" },
      { days: 7,  flag: "expiry_warning_7d_sent",  label: "7 days" },
      { days: 1,  flag: "expiry_warning_1d_sent",  label: "1 day" },
    ] as const;

    for (const tier of tiers) {
      const rows = await query<{
        id: string;
        code: string;
        tier: string;
        recipient_name: string;
        recipient_email: string;
        recipient_user_id: string | null;
        buyer_name: string;
        expires_at: string;
      }>(
        `SELECT id, code, tier::text as tier, recipient_name, recipient_email,
                recipient_user_id, buyer_name, expires_at
           FROM gift_cards
          WHERE status IN ('sent','claimed')
            AND expires_at > NOW()
            AND expires_at <= NOW() + INTERVAL '${tier.days} days'
            AND ${tier.flag} = FALSE
          ORDER BY expires_at ASC
          LIMIT 100`
      );

      for (const card of rows) {
        const claimed = await queryOne<{ id: string }>(
          `UPDATE gift_cards SET ${tier.flag} = TRUE
            WHERE id = $1 AND ${tier.flag} = FALSE RETURNING id`,
          [card.id]
        );
        if (!claimed) continue;

        try {
          const loc = normalizeLocale(card.recipient_user_id ? await getUserLocaleById(card.recipient_user_id) : "en");
          const expiry = new Date(card.expires_at).toLocaleDateString(loc, {
            month: "long", day: "numeric", year: "numeric",
          });
          const T = pickT({
            en: {
              subject: `Your Photo Portugal gift card expires in ${tier.label}`,
              h2: `Your gift is waiting — ${tier.label} left`,
              body: `Just a reminder, ${card.recipient_name.split(" ")[0]}: the gift session from ${card.buyer_name} expires on ${expiry}. Pick a photographer and book a date before then and you're set.`,
              cta: "Pick a photographer",
            },
            pt: {
              subject: `O seu cartão Photo Portugal expira em ${tier.label === "30 days" ? "30 dias" : tier.label === "7 days" ? "7 dias" : "1 dia"}`,
              h2: `O seu presente está à espera — falta${tier.label === "1 day" ? "" : "m"} ${tier.label === "30 days" ? "30 dias" : tier.label === "7 days" ? "7 dias" : "1 dia"}`,
              body: `Apenas um lembrete, ${card.recipient_name.split(" ")[0]}: a sessão oferecida por ${card.buyer_name} expira em ${expiry}. Escolha um fotógrafo e marque uma data antes disso.`,
              cta: "Escolher fotógrafo",
            },
            de: {
              subject: `Ihre Photo Portugal Geschenkkarte läuft in ${tier.label === "30 days" ? "30 Tagen" : tier.label === "7 days" ? "7 Tagen" : "1 Tag"} ab`,
              h2: `Ihr Geschenk wartet — noch ${tier.label === "30 days" ? "30 Tage" : tier.label === "7 days" ? "7 Tage" : "1 Tag"}`,
              body: `Nur zur Erinnerung, ${card.recipient_name.split(" ")[0]}: die Session von ${card.buyer_name} läuft am ${expiry} ab. Wählen Sie vorher einen Fotografen und buchen Sie ein Datum.`,
              cta: "Fotografen wählen",
            },
            es: {
              subject: `Su tarjeta Photo Portugal expira en ${tier.label === "30 days" ? "30 días" : tier.label === "7 days" ? "7 días" : "1 día"}`,
              h2: `Su regalo le espera — falta${tier.label === "1 day" ? "" : "n"} ${tier.label === "30 days" ? "30 días" : tier.label === "7 days" ? "7 días" : "1 día"}`,
              body: `Solo un recordatorio, ${card.recipient_name.split(" ")[0]}: la sesión de ${card.buyer_name} expira el ${expiry}. Elija un fotógrafo y reserve una fecha antes.`,
              cta: "Elegir fotógrafo",
            },
            fr: {
              subject: `Votre carte cadeau Photo Portugal expire dans ${tier.label === "30 days" ? "30 jours" : tier.label === "7 days" ? "7 jours" : "1 jour"}`,
              h2: `Votre cadeau vous attend — ${tier.label === "30 days" ? "30 jours" : tier.label === "7 days" ? "7 jours" : "1 jour"} restant${tier.label === "1 day" ? "" : "s"}`,
              body: `Juste un rappel, ${card.recipient_name.split(" ")[0]} : la séance offerte par ${card.buyer_name} expire le ${expiry}. Choisissez un photographe et réservez une date avant cette échéance.`,
              cta: "Choisir un photographe",
            },
          }, loc);
          const html = emailLayout(`
            <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#1F1F1F;">${T.h2}</h2>
            <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4A4A4A;">${T.body}</p>
            ${emailButton("https://photoportugal.com/photographers", T.cta)}
          `, loc);
          await sendEmail(card.recipient_email, T.subject, html);
          warnings++;
        } catch (mailErr) {
          console.error("[gift-card-expiry] warning send error:", mailErr);
        }
      }
    }

    // Expire — anything past expires_at flips to 'expired'. Atomic.
    const expiredRows = await query<{ id: string }>(
      `UPDATE gift_cards SET status = 'expired'
        WHERE status IN ('sent','claimed') AND expires_at < NOW()
        RETURNING id`
    );
    expired = expiredRows.length;
  } finally {
    await queryOne("SELECT pg_advisory_unlock(917365413) as released").catch(() => null);
  }

  return NextResponse.json({ ok: true, warnings, expired });
}
