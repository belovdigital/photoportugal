import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { sendEmail, emailLayout, emailButton } from "@/lib/email";
import { normalizeLocale, pickT, localizedUrl, type Locale } from "@/lib/email-locale";
import { notifyPhotographerViaTelegram } from "@/lib/notify-photographer";
import { country } from "@/lib/country";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Photographer digest — last calendar month of photographer_daily_stats plus a
 * "reply now" nudge, pointing at /dashboard/stats. The dashboard is pull;
 * this is the push that closes the self-improvement loop.
 *
 * Crontab (1st of the month, 09:05 server time):
 *   5 9 1 * * curl -s "http://127.0.0.1:8090/api/cron/photographer-digest?secret=$CRON_SECRET"
 *
 * The window is a whole month, not 7 days: at this platform's volume an
 * average photographer sees ~4 profile views and 0.25 inquiries a WEEK, so a
 * weekly table was a column of zeros for nearly everyone and read as "the
 * platform is dead" (WhatsApp group, 2026-08-03). For the same reason a quiet
 * month gets an explanation and something to do instead of being silently
 * skipped — photographers told us they never received a report at all.
 *
 * It is a NAMED calendar month, closed before the mail goes out — "your July",
 * sent on 1 August. A rolling 30-day window on a weekly cron shipped the same
 * "your month on <brand>" four times a month, each report re-counting three
 * quarters of the previous one's traffic.
 *
 * Nobody is sent a month they were not here for: the tenure guard wants the
 * profile to exist before the month began. Without it, a photographer approved
 * five days earlier was mailed a month's report built from a handful of views —
 * on Spain (2026-08-10) most of those views were us opening her own profile.
 * Whole markets are gated by `country.photographerDigest` for the same reason.
 *
 * Site impressions and Google Search impressions are separate lines:
 * they are different things, and GSC data lags 2-3 days.
 *
 * Skips: email_messages opt-outs and anyone already sent since the 1st
 * (weekly_digest_sent_at — kept under its original, now weekly-sounding name;
 * renaming it means a migration on three markets for nothing). Telegram goes
 * through notifyPhotographerViaTelegram (strictly opt-in via telegram_enabled).
 * NO money in this email — counts only, per policy.
 */

const MAX_PER_RUN = 300;
/** The market's own clock decides which calendar month has just closed. */
const TZ = country.timezone;

interface DigestCopy {
  subject: (views: number, month: string) => string;
  heading: (monthYear: string) => string;
  intro: (month: string) => string;
  views: string;
  visitors: string;
  shownSite: string;
  shownGoogle: string;
  inquiries: string;
  paid: string;
  peer: (n: number, month: string) => string;
  quiet: (month: string) => string;
  unanswered: (n: number) => string;
  cta: string;
  outro: string;
}

/**
 * "de avril" is not French. Three months take the elided article — avril, août,
 * octobre — and the subject line is the one place the construction appears.
 */
function frDe(month: string): string {
  return /^[aeiouâàéèêîôû]/i.test(month) ? `d'${month}` : `de ${month}`;
}

const T: Record<Locale, DigestCopy> = {
  en: {
    subject: (views: number, month: string) => `Your ${month} on ${country.brand}: ${views} profile views`,
    heading: (monthYear: string) => `Your stats for ${monthYear}`,
    intro: (month: string) => `Here's how your profile performed in ${month}:`,
    views: "Profile views",
    visitors: "Unique visitors",
    shownSite: "Card shown on the site",
    shownGoogle: "Shown in Google search",
    inquiries: "New inquiries",
    paid: "Paid bookings",
    peer: (n: number, month: string) => `A typical photographer on the platform had ${n} profile views in ${month}.`,
    quiet: (month: string) =>
      `Your card was shown, but nobody opened your profile in ${month}. About 3-4 visitors out of 100 who see a card open the profile, so a month with few impressions can genuinely end at zero. What moves it most: add every location you actually shoot in (photographers listed in 10+ locations are shown roughly twice as often), and replace your cover photo — in listings it is the only thing a visitor sees.`,
    unanswered: (n: number) => `⚠️ You have ${n} inquiry${n === 1 ? "" : "ies"} without a reply — answer today, inquiries answered fast convert far better.`,
    cta: "Open your full stats",
    outro: "Tip: your stats page shows which photos get opened most, where visitors come from, and what to improve next.",
  },
  pt: {
    subject: (views: number, month: string) => `O seu mês de ${month} na ${country.brand}: ${views} visualizações do perfil`,
    heading: (monthYear: string) => `As suas estatísticas de ${monthYear}`,
    intro: (month: string) => `Eis o desempenho do seu perfil em ${month}:`,
    views: "Visualizações do perfil",
    visitors: "Visitantes únicos",
    shownSite: "Cartão mostrado no site",
    shownGoogle: "Mostrado na pesquisa Google",
    inquiries: "Novos pedidos",
    paid: "Reservas pagas",
    peer: (n: number, month: string) => `Um fotógrafo típico da plataforma teve ${n} visualizações do perfil em ${month}.`,
    quiet: (month: string) =>
      `O seu cartão foi mostrado, mas ninguém abriu o seu perfil em ${month}. Cerca de 3-4 em cada 100 visitantes que veem um cartão abrem o perfil, por isso um mês com poucos aparecimentos pode mesmo terminar a zero. O que mais ajuda: acrescentar todos os locais onde realmente fotografa (quem está listado em 10+ locais aparece cerca do dobro das vezes) e trocar a foto de capa — nas listagens é a única coisa que o visitante vê.`,
    unanswered: (n: number) => `⚠️ Tem ${n} pedido${n === 1 ? "" : "s"} sem resposta — responda hoje; pedidos respondidos depressa convertem muito melhor.`,
    cta: "Ver as estatísticas completas",
    outro: "Dica: a página de estatísticas mostra as fotos mais abertas, de onde vêm os visitantes e o que melhorar a seguir.",
  },
  de: {
    subject: (views: number, month: string) => `Ihr ${month} auf ${country.brand}: ${views} Profilaufrufe`,
    heading: (monthYear: string) => `Ihre Statistik für ${monthYear}`,
    intro: (month: string) => `So hat Ihr Profil im ${month} abgeschnitten:`,
    views: "Profilaufrufe",
    visitors: "Eindeutige Besucher",
    shownSite: "Karte auf der Website gezeigt",
    shownGoogle: "In der Google-Suche gezeigt",
    inquiries: "Neue Anfragen",
    paid: "Bezahlte Buchungen",
    peer: (n: number, month: string) => `Ein typischer Fotograf auf der Plattform hatte im ${month} ${n} Profilaufrufe.`,
    quiet: (month: string) =>
      `Ihre Karte wurde gezeigt, aber im ${month} hat niemand Ihr Profil geöffnet. Etwa 3-4 von 100 Besuchern, die eine Karte sehen, öffnen das Profil — ein Monat mit wenigen Einblendungen kann also tatsächlich bei null enden. Am meisten bewirken: alle Orte eintragen, an denen Sie wirklich fotografieren (wer in 10+ Orten gelistet ist, wird etwa doppelt so oft gezeigt), und das Titelbild austauschen — in Übersichten ist es das Einzige, was ein Besucher sieht.`,
    unanswered: (n: number) => `⚠️ Sie haben ${n} unbeantwortete Anfrage${n === 1 ? "" : "n"} — antworten Sie heute; schnell beantwortete Anfragen konvertieren deutlich besser.`,
    cta: "Vollständige Statistik öffnen",
    outro: "Tipp: Die Statistikseite zeigt, welche Fotos am häufigsten geöffnet werden, woher Besucher kommen und was Sie als Nächstes verbessern können.",
  },
  es: {
    subject: (views: number, month: string) => `Tu mes de ${month} en ${country.brand}: ${views} vistas del perfil`,
    heading: (monthYear: string) => `Tus estadísticas de ${monthYear}`,
    intro: (month: string) => `Así ha funcionado tu perfil en ${month}:`,
    views: "Vistas del perfil",
    visitors: "Visitantes únicos",
    shownSite: "Tarjeta mostrada en el sitio",
    shownGoogle: "Mostrado en la búsqueda de Google",
    inquiries: "Nuevas solicitudes",
    paid: "Reservas pagadas",
    peer: (n: number, month: string) => `Un fotógrafo típico de la plataforma tuvo ${n} vistas del perfil en ${month}.`,
    quiet: (month: string) =>
      `Tu tarjeta se mostró, pero nadie abrió tu perfil en ${month}. Alrededor de 3-4 de cada 100 visitantes que ven una tarjeta abren el perfil, así que un mes con pocas apariciones puede terminar realmente en cero. Lo que más ayuda: añadir todas las ubicaciones donde realmente fotografías (quien aparece en 10+ ubicaciones se muestra casi el doble) y cambiar tu foto de portada: en los listados es lo único que ve el visitante.`,
    unanswered: (n: number) => `⚠️ Tienes ${n} solicitud${n === 1 ? "" : "es"} sin responder — contesta hoy; las solicitudes respondidas rápido convierten mucho mejor.`,
    cta: "Ver estadísticas completas",
    outro: "Consejo: la página de estadísticas muestra qué fotos se abren más, de dónde vienen los visitantes y qué mejorar a continuación.",
  },
  fr: {
    subject: (views: number, month: string) => `Votre mois ${frDe(month)} sur ${country.brand} : ${views} vues du profil`,
    heading: (monthYear: string) => `Vos statistiques pour ${monthYear}`,
    intro: (month: string) => `Voici les performances de votre profil en ${month} :`,
    views: "Vues du profil",
    visitors: "Visiteurs uniques",
    shownSite: "Carte affichée sur le site",
    shownGoogle: "Affiché dans la recherche Google",
    inquiries: "Nouvelles demandes",
    paid: "Réservations payées",
    peer: (n: number, month: string) => `Un photographe typique de la plateforme a eu ${n} vues du profil en ${month}.`,
    quiet: (month: string) =>
      `Votre carte a été affichée, mais personne n'a ouvert votre profil en ${month}. Environ 3 à 4 visiteurs sur 100 qui voient une carte ouvrent le profil : un mois avec peu d'affichages peut donc réellement finir à zéro. Ce qui change le plus : ajouter tous les lieux où vous photographiez vraiment (les photographes présents dans 10+ lieux sont affichés environ deux fois plus souvent) et remplacer votre photo de couverture — dans les listes, c'est la seule chose que le visiteur voit.`,
    unanswered: (n: number) => `⚠️ Vous avez ${n} demande${n === 1 ? "" : "s"} sans réponse — répondez aujourd'hui ; les demandes traitées vite convertissent bien mieux.`,
    cta: "Voir les statistiques complètes",
    outro: "Astuce : la page de statistiques montre les photos les plus ouvertes, d'où viennent les visiteurs et quoi améliorer ensuite.",
  },
  it: {
    subject: (views: number, month: string) => `Il tuo mese di ${month} su ${country.brand}: ${views} visite al profilo`,
    heading: (monthYear: string) => `Le tue statistiche di ${monthYear}`,
    intro: (month: string) => `Ecco come è andato il tuo profilo nel mese di ${month}:`,
    views: "Visite al profilo",
    visitors: "Visitatori unici",
    shownSite: "Scheda mostrata sul sito",
    shownGoogle: "Mostrato nella ricerca Google",
    inquiries: "Nuove richieste",
    paid: "Prenotazioni pagate",
    peer: (n: number, month: string) => `Un fotografo tipo sulla piattaforma ha avuto ${n} visite al profilo nel mese di ${month}.`,
    quiet: (month: string) =>
      `La tua scheda è stata mostrata, ma nel mese di ${month} nessuno ha aperto il profilo. Circa 3-4 visitatori su 100 che vedono una scheda aprono il profilo, quindi un mese con poche visualizzazioni può davvero finire a zero. Cosa incide di più: aggiungi tutte le località in cui fotografi davvero (i fotografi presenti in 10+ località vengono mostrati circa il doppio delle volte) e cambia la foto di copertina — negli elenchi è l'unica cosa che il visitatore vede.`,
    unanswered: (n: number) => `⚠️ Hai ${n} richiest${n === 1 ? "a" : "e"} senza risposta — rispondi oggi: le richieste evase in fretta convertono molto meglio.`,
    cta: "Apri le statistiche complete",
    outro: "Consiglio: la pagina delle statistiche mostra quali foto vengono aperte di più, da dove arrivano i visitatori e cosa migliorare.",
  },
};

function statRow(label: string, value: number): string {
  return `<tr>
    <td style="padding:8px 0;color:#5f4a3d;font-size:14px;">${label}</td>
    <td style="padding:8px 0;text-align:right;font-weight:700;color:#1f2937;font-size:16px;">${value}</td>
  </tr>`;
}

/**
 * "julho" / "julho de 2026" in the recipient's own language. Noon UTC keeps the
 * date on the 1st whatever the formatter's zone does with it.
 */
function monthLabels(monthStart: string, locale: Locale): { month: string; monthYear: string } {
  const d = new Date(`${monthStart}T12:00:00Z`);
  return {
    month: new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(d),
    monthYear: new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(d),
  };
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // A market too young to have a month of traffic sends nothing at all.
  if (!country.photographerDigest) {
    return NextResponse.json({ ok: true, skipped: "market", country: country.code });
  }

  try {
    // The month that has just closed, in the market's own timezone, plus the
    // 1st of the current one — the marker every "already sent" check compares
    // against, so a retry later the same month is a no-op.
    const bounds = await queryOne<{ month_start: string; month_end: string; this_month: string }>(
      `SELECT to_char(date_trunc('month', local_now) - INTERVAL '1 month', 'YYYY-MM-DD') AS month_start,
              to_char(date_trunc('month', local_now) - INTERVAL '1 day',   'YYYY-MM-DD') AS month_end,
              to_char(date_trunc('month', local_now),                      'YYYY-MM-DD') AS this_month
         FROM (SELECT NOW() AT TIME ZONE '${TZ}' AS local_now) t`,
    );
    if (!bounds) {
      return NextResponse.json({ error: "Digest failed" }, { status: 500 });
    }
    const { month_start: monthStart, month_end: monthEnd, this_month: thisMonth } = bounds;

    // Anonymous peer context — photographers ask "how is everyone else
    // doing?" every time these numbers look bad, so answer it up front.
    // Same tenure rule as the recipients: a roster of week-old profiles
    // sitting at zero would drag the median down and answer nothing.
    const peer = await queryOne<{ median_views: number | null }>(
      `SELECT (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY v))::int AS median_views
       FROM (
         SELECT pp.id, COALESCE(SUM(s.profile_views), 0)::float AS v
         FROM photographer_profiles pp
         LEFT JOIN photographer_daily_stats s
           ON s.photographer_id = pp.id
          AND s.date >= $1::date AND s.date <= $2::date
         WHERE pp.is_approved = TRUE AND pp.is_test = FALSE
           AND (pp.created_at AT TIME ZONE '${TZ}') < $1::timestamp
         GROUP BY pp.id
       ) q`,
      [monthStart, monthEnd],
    );

    // One bulk query: eligible photographers + their month aggregates + an
    // unanswered inquiry count. Guards: profile older than the month it is
    // being sent, nothing sent yet since the 1st, email opt-out respected.
    const rows = await query<{
      photographer_id: string;
      email: string;
      locale: string | null;
      first_name: string | null;
      views: number;
      uniques: number;
      shown_site: number;
      shown_google: number;
      inquiries: number;
      paid: number;
      unanswered: number;
    }>(
      `SELECT pp.id AS photographer_id,
              u.email,
              u.locale,
              split_part(COALESCE(NULLIF(u.first_name, ''), u.name, ''), ' ', 1) AS first_name,
              COALESCE(s.views, 0)::int AS views,
              COALESCE(s.uniques, 0)::int AS uniques,
              COALESCE(s.shown_site, 0)::int AS shown_site,
              COALESCE(s.shown_google, 0)::int AS shown_google,
              COALESCE(s.inquiries, 0)::int AS inquiries,
              COALESCE(s.paid, 0)::int AS paid,
              COALESCE(unans.n, 0)::int AS unanswered
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
       LEFT JOIN notification_preferences np ON np.user_id = u.id
       LEFT JOIN LATERAL (
         SELECT SUM(profile_views) AS views,
                SUM(unique_visitors) AS uniques,
                SUM(card_impressions + concierge_impressions) AS shown_site,
                SUM(COALESCE(gsc_impressions, 0)) AS shown_google,
                SUM(inquiries) AS inquiries,
                SUM(paid_bookings) AS paid
         FROM photographer_daily_stats s
         WHERE s.photographer_id = pp.id AND s.date >= $1::date AND s.date <= $2::date
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
         AND (pp.created_at AT TIME ZONE '${TZ}') < $1::timestamp
         AND (pp.weekly_digest_sent_at IS NULL
              OR (pp.weekly_digest_sent_at AT TIME ZONE '${TZ}') < $3::timestamp)
         AND COALESCE(np.email_messages, TRUE) = TRUE
       LIMIT ${MAX_PER_RUN}`,
      [monthStart, monthEnd, thisMonth],
    );

    const labels = new Map<Locale, { month: string; monthYear: string }>();
    let sent = 0;
    let quiet = 0;
    for (const r of rows) {
      const locale = normalizeLocale(r.locale) as Locale;
      const t = pickT(T, locale);
      if (!labels.has(locale)) labels.set(locale, monthLabels(monthStart, locale));
      const { month, monthYear } = labels.get(locale)!;
      const statsUrl = localizedUrl("/dashboard/stats", locale);
      // A month with impressions but no profile views is the case that
      // panics people. Explain it in the mail instead of shipping a bare
      // column of zeros (or, as before, staying silent altogether).
      const isQuiet = r.views === 0 && r.inquiries === 0;
      if (isQuiet) quiet++;

      const body = `
        <h2 style="margin:0 0 12px;color:#1f2937;">${t.heading(monthYear)}</h2>
        <p style="margin:0 0 16px;color:#5f4a3d;">${r.first_name ? `${r.first_name}, ` : ""}${t.intro(month)}</p>
        <table style="width:100%;border-collapse:collapse;margin:0 0 16px;">
          ${statRow(t.views, r.views)}
          ${statRow(t.visitors, r.uniques)}
          ${statRow(t.shownSite, r.shown_site)}
          ${statRow(t.shownGoogle, r.shown_google)}
          ${statRow(t.inquiries, r.inquiries)}
          ${statRow(t.paid, r.paid)}
        </table>
        ${peer?.median_views !== null && peer?.median_views !== undefined
          ? `<p style="margin:0 0 16px;color:#9ca3af;font-size:13px;">${t.peer(peer.median_views, month)}</p>`
          : ""}
        ${isQuiet ? `<p style="margin:0 0 16px;padding:12px;background:#faf8f5;border-radius:8px;color:#5f4a3d;font-size:14px;">${t.quiet(month)}</p>` : ""}
        ${r.unanswered > 0 ? `<p style="margin:0 0 16px;padding:12px;background:#fdf4f3;border-radius:8px;color:#a9372a;font-size:14px;">${t.unanswered(r.unanswered)}</p>` : ""}
        ${emailButton(statsUrl, t.cta)}
        <p style="margin:16px 0 0;color:#9ca3af;font-size:13px;">${t.outro}</p>`;

      try {
        await sendEmail(r.email, t.subject(r.views, month), emailLayout(body, locale));
        // Telegram is opt-in (telegram_enabled) — helper enforces it.
        const tgLines = [
          `📊 ${t.heading(monthYear)}`,
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

    return NextResponse.json({
      ok: true,
      month: `${monthStart}..${monthEnd}`,
      eligible: rows.length,
      sent,
      quiet,
      peerMedianViews: peer?.median_views ?? null,
    });
  } catch (e) {
    console.error("[photographer-digest]", e);
    return NextResponse.json({ error: "Digest failed" }, { status: 500 });
  }
}
