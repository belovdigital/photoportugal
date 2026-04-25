import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/app/api/admin/login/route";
import { sendBookingConfirmation, sendBookingConfirmationWithPayment, sendPasswordResetEmail } from "@/lib/email";
import { sendSMS } from "@/lib/sms";
import { query } from "@/lib/db";

export const runtime = "nodejs";

async function isAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  return token ? verifyToken(token) : false;
}

// Temporary admin-only endpoint to send test notifications in any locale.
// Body: { kind: "email" | "sms", target: "alex@belov.pt" | "+351...", locale: "fr" | "de" | ... , template?: "booking" | "payment" | "reset" | "delivery" }
export async function POST(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { kind, target, locale, template } = await req.json();
  if (!target || !locale) return NextResponse.json({ error: "target and locale required" }, { status: 400 });

  if (kind === "email") {
    const tpl = template || "booking";
    // Temporarily set the user's locale so internal pickT() picks it.
    const original = await query<{ locale: string | null }>("SELECT locale FROM users WHERE email = $1", [target]);
    const orig = original[0]?.locale ?? null;
    await query("UPDATE users SET locale = $1 WHERE email = $2", [locale, target]);
    try {
      if (tpl === "booking") {
        await sendBookingConfirmation(target, "Alex Test", "Kate Belova", "May 5, 2026");
      } else if (tpl === "payment") {
        await sendBookingConfirmationWithPayment(target, "Alex Test", "Kate Belova", "May 5, 2026", "https://photoportugal.com/dashboard/bookings", 280);
      } else if (tpl === "reset") {
        await sendPasswordResetEmail(target, "Alex Test", "test_token_xxx");
      } else {
        return NextResponse.json({ error: "unknown template" }, { status: 400 });
      }
      return NextResponse.json({ ok: true, sent: { to: target, locale, template: tpl } });
    } finally {
      // Revert locale
      await query("UPDATE users SET locale = $1 WHERE email = $2", [orig, target]).catch(() => null);
    }
  }

  if (kind === "sms") {
    // Construct a localized "booking confirmed" message
    const photographerName = "Kate Belova";
    const map: Record<string, string> = {
      en: `Photo Portugal: ${photographerName} confirmed your booking! Check your dashboard for payment details.`,
      pt: `Photo Portugal: ${photographerName} confirmou a sua reserva! Veja o seu painel para os detalhes de pagamento.`,
      de: `Photo Portugal: ${photographerName} hat Ihre Buchung bestätigt! Zahlungsdetails finden Sie in Ihrem Dashboard.`,
      es: `Photo Portugal: ${photographerName} ha confirmado su reserva. Consulte el panel para los detalles de pago.`,
      fr: `Photo Portugal : ${photographerName} a confirmé votre réservation ! Détails de paiement sur votre tableau de bord.`,
    };
    const body = map[locale] || map.en;
    const ok = await sendSMS(target, body);
    return NextResponse.json({ ok, sent: { to: target, locale, body } });
  }

  return NextResponse.json({ error: "unknown kind" }, { status: 400 });
}
