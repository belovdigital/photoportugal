import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { sendEmail, emailLayout, emailButton } from "@/lib/email";
import { normalizeLocale, pickT, localizedUrl, type Locale } from "@/lib/email-locale";
import { notifyPhotographerViaTelegram } from "@/lib/notify-photographer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Weekly photographer digest — last-7-days numbers from
 * photographer_daily_stats + a "reply now" nudge, pointing at
 * /dashboard/stats. The dashboard is pull; this is the push that closes
 * the self-improvement loop.
 *
 * Crontab (Mondays 09:05 Lisbon):
 *   5 9 * * 1 curl -s "http://127.0.0.1:8090/api/cron/photographer-digest?secret=$CRON_SECRET"
 *
 * Skips: photographers with zero activity last week (nothing to say),
 * email_messages opt-outs, and anyone already sent within 5 days
 * (weekly_digest_sent_at guards cron retries). Telegram goes through
 * notifyPhotographerViaTelegram (strictly opt-in via telegram_enabled).
 * NO money in this email — counts only, per policy.
 */

const MAX_PER_RUN = 300;

interface DigestCopy {
  subject: (views: number) => string;
  heading: string;
  intro: string;
  views: string;
  visitors: string;
  shown: string;
  inquiries: string;
  paid: string;
  unanswered: (n: number) => string;
  cta: string;
  outro: string;
}

const T: Record<Locale, DigestCopy> = {
  en: {
    subject: (views: number) => `Your week on Photo Portugal: ${views} profile views`,
    heading: "Your weekly stats",
    intro: "Here's how your profile performed over the last 7 days:",
    views: "Profile views",
    visitors: "Unique visitors",
    shown: "Times shown in listings & search",
    inquiries: "New inquiries",
    paid: "Paid bookings",
    unanswered: (n: number) => `⚠️ You have ${n} inquiry${n === 1 ? "" : "ies"} without a reply — answer today, inquiries answered fast convert far better.`,
    cta: "Open your full stats",
    outro: "Tip: your stats page shows which photos get opened most, where visitors come from, and what to improve next.",
  },
  pt: {
    subject: (views: number) => `A sua semana na Photo Portugal: ${views} visualizações do perfil`,
    heading: "As suas estatísticas semanais",
    intro: "Eis o desempenho do seu perfil nos últimos 7 dias:",
    views: "Visualizações do perfil",
    visitors: "Visitantes únicos",
    shown: "Vezes mostrado em listagens e pesquisa",
    inquiries: "Novos pedidos",
    paid: "Reservas pagas",
    unanswered: (n: number) => `⚠️ Tem ${n} pedido${n === 1 ? "" : "s"} sem resposta — responda hoje; pedidos respondidos depressa convertem muito melhor.`,
    cta: "Ver as estatísticas completas",
    outro: "Dica: a página de estatísticas mostra as fotos mais abertas, de onde vêm os visitantes e o que melhorar a seguir.",
  },
  de: {
    subject: (views: number) => `Ihre Woche auf Photo Portugal: ${views} Profilaufrufe`,
    heading: "Ihre Wochenstatistik",
    intro: "So hat Ihr Profil in den letzten 7 Tagen abgeschnitten:",
    views: "Profilaufrufe",
    visitors: "Eindeutige Besucher",
    shown: "In Listen & Suche angezeigt",
    inquiries: "Neue Anfragen",
    paid: "Bezahlte Buchungen",
    unanswered: (n: number) => `⚠️ Sie haben ${n} unbeantwortete Anfrage${n === 1 ? "" : "n"} — antworten Sie heute; schnell beantwortete Anfragen konvertieren deutlich besser.`,
    cta: "Vollständige Statistik öffnen",
    outro: "Tipp: Die Statistikseite zeigt, welche Fotos am häufigsten geöffnet werden, woher Besucher kommen und was Sie als Nächstes verbessern können.",
  },
  es: {
    subject: (views: number) => `Tu semana en Photo Portugal: ${views} vistas del perfil`,
    heading: "Tus estadísticas semanales",
    intro: "Así ha funcionado tu perfil en los últimos 7 días:",
    views: "Vistas del perfil",
    visitors: "Visitantes únicos",
    shown: "Veces mostrado en listados y búsqueda",
    inquiries: "Nuevas solicitudes",
    paid: "Reservas pagadas",
    unanswered: (n: number) => `⚠️ Tienes ${n} solicitud${n === 1 ? "" : "es"} sin responder — contesta hoy; las solicitudes respondidas rápido convierten mucho mejor.`,
    cta: "Ver estadísticas completas",
    outro: "Consejo: la página de estadísticas muestra qué fotos se abren más, de dónde vienen los visitantes y qué mejorar a continuación.",
  },
  fr: {
    subject: (views: number) => `Votre semaine sur Photo Portugal : ${views} vues du profil`,
    heading: "Vos statistiques hebdomadaires",
    intro: "Voici les performances de votre profil ces 7 derniers jours :",
    views: "Vues du profil",
    visitors: "Visiteurs uniques",
    shown: "Affiché dans les listes et la recherche",
    inquiries: "Nouvelles demandes",
    paid: "Réservations payées",
    unanswered: (n: number) => `⚠️ Vous avez ${n} demande${n === 1 ? "" : "s"} sans réponse — répondez aujourd'hui ; les demandes traitées vite convertissent bien mieux.`,
    cta: "Voir les statistiques complètes",
    outro: "Astuce : la page de statistiques montre les photos les plus ouvertes, d'où viennent les visiteurs et quoi améliorer ensuite.",
  },
};

function statRow(label: string, value: number): string {
  return `<tr>
    <td style="padding:8px 0;color:#5f4a3d;font-size:14px;">${label}</td>
    <td style="padding:8px 0;text-align:right;font-weight:700;color:#1f2937;font-size:16px;">${value}</td>
  </tr>`;
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // One bulk query: eligible photographers + their last-7d aggregates
    // + unanswered inquiry count. Guards: sent marker ≥5d old, email
    // opt-out respected, zero-activity profiles skipped.
    const rows = await query<{
      photographer_id: string;
      email: string;
      locale: string | null;
      first_name: string | null;
      views: number;
      uniques: number;
      shown: number;
      inquiries: number;
      paid: number;
      unanswered: number;
    }>(
      `SELECT pp.id AS photographer_id,
              u.email,
              u.locale,
              split_part(COALESCE(NULLIF(pp.display_name, ''), u.name, ''), ' ', 1) AS first_name,
              COALESCE(s.views, 0)::int AS views,
              COALESCE(s.uniques, 0)::int AS uniques,
              COALESCE(s.shown, 0)::int AS shown,
              COALESCE(s.inquiries, 0)::int AS inquiries,
              COALESCE(s.paid, 0)::int AS paid,
              COALESCE(unans.n, 0)::int AS unanswered
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
       LEFT JOIN notification_preferences np ON np.user_id = u.id
       LEFT JOIN LATERAL (
         SELECT SUM(profile_views) AS views,
                SUM(unique_visitors) AS uniques,
                SUM(card_impressions + concierge_impressions + COALESCE(gsc_impressions, 0)) AS shown,
                SUM(inquiries) AS inquiries,
                SUM(paid_bookings) AS paid
         FROM photographer_daily_stats s
         WHERE s.photographer_id = pp.id AND s.date >= (NOW() AT TIME ZONE 'Europe/Lisbon')::date - 7
       ) s ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS n FROM bookings b
         WHERE b.photographer_id = pp.id AND b.status = 'inquiry'
           AND b.created_at > NOW() - INTERVAL '14 days'
           AND NOT EXISTS (
             SELECT 1 FROM messages m
             WHERE m.booking_id = b.id AND m.sender_id = pp.user_id)
       ) unans ON TRUE
       WHERE pp.is_approved = TRUE AND pp.is_test = FALSE
         AND u.email IS NOT NULL
         AND (pp.weekly_digest_sent_at IS NULL OR pp.weekly_digest_sent_at < NOW() - INTERVAL '5 days')
         AND COALESCE(np.email_messages, TRUE) = TRUE
       LIMIT ${MAX_PER_RUN}`,
    );

    let sent = 0;
    let skippedQuiet = 0;
    for (const r of rows) {
      if (r.views + r.shown + r.inquiries + r.unanswered === 0) {
        skippedQuiet++;
        continue;
      }
      const locale = normalizeLocale(r.locale) as Locale;
      const t = pickT(T, locale);
      const statsUrl = localizedUrl("/dashboard/stats", locale);

      const body = `
        <h2 style="margin:0 0 12px;color:#1f2937;">${t.heading}</h2>
        <p style="margin:0 0 16px;color:#5f4a3d;">${r.first_name ? `${r.first_name}, ` : ""}${t.intro}</p>
        <table style="width:100%;border-collapse:collapse;margin:0 0 16px;">
          ${statRow(t.views, r.views)}
          ${statRow(t.visitors, r.uniques)}
          ${statRow(t.shown, r.shown)}
          ${statRow(t.inquiries, r.inquiries)}
          ${statRow(t.paid, r.paid)}
        </table>
        ${r.unanswered > 0 ? `<p style="margin:0 0 16px;padding:12px;background:#fdf4f3;border-radius:8px;color:#a9372a;font-size:14px;">${t.unanswered(r.unanswered)}</p>` : ""}
        ${emailButton(statsUrl, t.cta)}
        <p style="margin:16px 0 0;color:#9ca3af;font-size:13px;">${t.outro}</p>`;

      try {
        await sendEmail(r.email, t.subject(r.views), emailLayout(body, locale));
        // Telegram is opt-in (telegram_enabled) — helper enforces it.
        const tgLines = [
          `📊 ${t.heading}`,
          `${t.views}: ${r.views} · ${t.inquiries}: ${r.inquiries} · ${t.paid}: ${r.paid}`,
          ...(r.unanswered > 0 ? [t.unanswered(r.unanswered)] : []),
          statsUrl,
        ];
        notifyPhotographerViaTelegram(r.photographer_id, tgLines.join("\n")).catch(() => {});
        await query("UPDATE photographer_profiles SET weekly_digest_sent_at = NOW() WHERE id = $1", [r.photographer_id]);
        sent++;
      } catch (e) {
        console.error(`[photographer-digest] send failed for ${r.photographer_id}:`, e);
      }
    }

    return NextResponse.json({ ok: true, eligible: rows.length, sent, skippedQuiet });
  } catch (e) {
    console.error("[photographer-digest]", e);
    return NextResponse.json({ error: "Digest failed" }, { status: 500 });
  }
}
