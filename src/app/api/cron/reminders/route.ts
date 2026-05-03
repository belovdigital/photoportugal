import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import {
  sendEmail,
  getAdminEmail,
  sendPaymentReminderToClient,
  sendAdminAutoCancelNotification,
  renderShootReminderToClient,
  renderShootReminderToPhotographer,
  renderDeliveryReminderToPhotographer,
  renderTrustpilotFollowUpToClient,
  renderTrustpilotFollowUpToPhotographer,
  emailLayout,
  emailButton,
} from "@/lib/email";
import { sendSMS } from "@/lib/sms";
import { queueNotification, processNotificationQueue } from "@/lib/notification-queue";
import { requireStripe, calculatePayment } from "@/lib/stripe";
import { rm } from "fs/promises";
import path from "path";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/var/www/photoportugal/uploads";

export async function GET(req: NextRequest) {
  // Verify cron secret
  if (req.nextUrl.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Prevent concurrent cron runs with advisory lock
  try {
    const lock = await queryOne<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock(123456789) as acquired"
    );
    if (!lock?.acquired) {
      return NextResponse.json({ error: "Cron already running", skipped: true });
    }
  } catch {}

  const results = {
    paymentReminders: 0,
    autoCancelled: 0,
    shootReminders: 0,
    sessionReminders: 0,
    deliveryReminders: 0,
    deliveryEscalations: 0,
    deliveryAutoRefunds: 0,
    autoReleasedPayments: 0,
    trustpilotFollowUps: 0,
    reviewChatRequests: 0,
    errors: [] as string[],
  };

  // === 1. Payment reminder #1 (6h after confirmation if unpaid — early nudge) ===
  try {
    const unpaidBookings = await query<{
      id: string;
      client_email: string;
      client_name: string;
      client_phone: string | null;
      client_id: string;
      photographer_name: string;
      payment_url: string | null;
      total_price: number | null;
    }>(
      `SELECT b.id, u.email as client_email, u.name as client_name,
              u.phone as client_phone, u.id as client_id,
              pu.name as photographer_name,
              b.payment_url, b.total_price
       FROM bookings b
       JOIN users u ON u.id = b.client_id
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users pu ON pu.id = pp.user_id
       WHERE b.status = 'confirmed'
         AND b.payment_status != 'paid'
         AND COALESCE(b.confirmed_at, b.created_at) < NOW() - INTERVAL '6 hours'
         AND COALESCE(b.confirmed_at, b.created_at) > NOW() - INTERVAL '24 hours'
         AND b.payment_reminder_sent = FALSE`
    );

    for (const booking of unpaidBookings) {
      try {
        await sendPaymentReminderToClient(
          booking.client_email,
          booking.client_name,
          booking.photographer_name,
          null,
          booking.total_price
        );
        // SMS reminder
        if (booking.client_phone) {
          const smsPrefs = await queryOne<{ sms_bookings: boolean }>(
            "SELECT sms_bookings FROM notification_preferences WHERE user_id = $1",
            [booking.client_id]
          );
          if (smsPrefs?.sms_bookings !== false) {
            const { getUserLocaleById, pickT } = await import("@/lib/email-locale");
            const cLocale = await getUserLocaleById(booking.client_id);
            const priceStr = booking.total_price ? ` (€${Math.round(booking.total_price)})` : "";
            const smsBody = pickT({
              en: `Photo Portugal: Your slot with ${booking.photographer_name}${priceStr} is held until payment. Auto-cancel in ~18h if unpaid: https://photoportugal.com/dashboard/bookings`,
              pt: `Photo Portugal: O seu horário com ${booking.photographer_name}${priceStr} está reservado até ao pagamento. Cancelamento automático em ~18h: https://photoportugal.com/dashboard/bookings`,
              de: `Photo Portugal: Ihr Termin mit ${booking.photographer_name}${priceStr} ist nur bis zur Zahlung reserviert. Auto-Storno in ~18h: https://photoportugal.com/dashboard/bookings`,
              es: `Photo Portugal: Su sesión con ${booking.photographer_name}${priceStr} está reservada hasta el pago. Cancelación automática en ~18h: https://photoportugal.com/dashboard/bookings`,
              fr: `Photo Portugal : Votre créneau avec ${booking.photographer_name}${priceStr} est réservé jusqu'au paiement. Annulation automatique dans ~18h : https://photoportugal.com/dashboard/bookings`,
            }, cLocale);
            sendSMS(
              booking.client_phone,
              smsBody
            ).catch(err => console.error("[cron] payment reminder sms error:", err));
          }
        }
        // Push: client gets a tap-through to bookings.
        import("@/lib/push").then(m =>
          m.sendPushNotification(
            booking.client_id,
            "Payment reminder",
            `Your booking with ${booking.photographer_name} is awaiting payment.`,
            { type: "booking", bookingId: booking.id }
          )
        ).catch(err => console.error("[cron] payment reminder push error:", err));
        await queryOne(
          "UPDATE bookings SET payment_reminder_sent = TRUE WHERE id = $1 RETURNING id",
          [booking.id]
        );
        results.paymentReminders++;
      } catch (err) {
        results.errors.push(`Payment reminder for booking ${booking.id}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Payment reminders query: ${err}`);
  }

  // === 1b. Final payment reminder (18h after confirmation — 6h before auto-cancel) ===
  let paymentFinalReminders = 0;
  try {
    const finalReminderBookings = await query<{
      id: string;
      client_email: string;
      client_name: string;
      client_phone: string | null;
      client_id: string;
      photographer_name: string;
      total_price: number | null;
    }>(
      `SELECT b.id, u.email as client_email, u.name as client_name,
              u.phone as client_phone, u.id as client_id,
              pu.name as photographer_name, b.total_price
       FROM bookings b
       JOIN users u ON u.id = b.client_id
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users pu ON pu.id = pp.user_id
       WHERE b.status = 'confirmed'
         AND b.payment_status != 'paid'
         AND b.confirmed_at < NOW() - INTERVAL '18 hours'
         AND b.confirmed_at > NOW() - INTERVAL '24 hours'
         AND b.payment_final_reminder_sent = FALSE`
    );

    for (const booking of finalReminderBookings) {
      try {
        const BASE_URL = process.env.AUTH_URL || "https://photoportugal.com";
        const { getUserLocaleByEmail, pickT } = await import("@/lib/email-locale");
        const cLocale = await getUserLocaleByEmail(booking.client_email);
        const priceStr = booking.total_price ? ` (€${Math.round(booking.total_price)})` : "";
        const firstName = booking.client_name.split(" ")[0];
        const T = pickT({
          en: { subject: "Last chance — your booking will be cancelled in 6 hours", h2: "Your Booking Will Be Cancelled Soon", greet: `Hi ${firstName},`, body1: `Your photoshoot with <strong>${booking.photographer_name}</strong>${priceStr} will be <strong>automatically cancelled in 6 hours</strong> if payment is not received.`, body2: `${booking.photographer_name} is holding this time slot for you — don't miss out!`, cta: "Pay Now & Secure Your Booking", footer: "If you no longer wish to proceed, the booking will be cancelled automatically. No action needed." },
          pt: { subject: "Última oportunidade — a sua reserva será cancelada em 6 horas", h2: "A sua reserva será cancelada em breve", greet: `Olá ${firstName},`, body1: `A sua sessão com <strong>${booking.photographer_name}</strong>${priceStr} será <strong>automaticamente cancelada em 6 horas</strong> se o pagamento não for recebido.`, body2: `${booking.photographer_name} está a reservar este horário para si — não perca esta oportunidade!`, cta: "Pagar agora e garantir a reserva", footer: "Se já não pretende avançar, a reserva será cancelada automaticamente. Nenhuma ação necessária." },
          de: { subject: "Letzte Chance — Ihre Buchung wird in 6 Stunden storniert", h2: "Ihre Buchung wird bald storniert", greet: `Hallo ${firstName},`, body1: `Ihr Fotoshooting mit <strong>${booking.photographer_name}</strong>${priceStr} wird <strong>in 6 Stunden automatisch storniert</strong>, wenn keine Zahlung eingeht.`, body2: `${booking.photographer_name} hält diesen Termin für Sie frei — verpassen Sie ihn nicht!`, cta: "Jetzt bezahlen und Buchung sichern", footer: "Wenn Sie nicht mehr fortfahren möchten, wird die Buchung automatisch storniert. Keine Aktion erforderlich." },
          es: { subject: "Última oportunidad — su reserva se cancelará en 6 horas", h2: "Su reserva se cancelará pronto", greet: `Hola ${firstName},`, body1: `Su sesión con <strong>${booking.photographer_name}</strong>${priceStr} se <strong>cancelará automáticamente en 6 horas</strong> si no se recibe el pago.`, body2: `${booking.photographer_name} está reservando este horario para usted — ¡no lo pierda!`, cta: "Pagar ahora y asegurar la reserva", footer: "Si ya no desea continuar, la reserva se cancelará automáticamente. No es necesario hacer nada." },
          fr: { subject: "Dernière chance — votre réservation sera annulée dans 6 heures", h2: "Votre réservation sera bientôt annulée", greet: `Bonjour ${firstName},`, body1: `Votre séance photo avec <strong>${booking.photographer_name}</strong>${priceStr} sera <strong>automatiquement annulée dans 6 heures</strong> si le paiement n'est pas reçu.`, body2: `${booking.photographer_name} réserve ce créneau pour vous — ne le manquez pas !`, cta: "Payer maintenant et sécuriser la réservation", footer: "Si vous ne souhaitez plus continuer, la réservation sera annulée automatiquement. Aucune action requise." },
        }, cLocale);
        await sendEmail(
          booking.client_email,
          T.subject,
          `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #C94536;">${T.h2}</h2>
            <p>${T.greet}</p>
            <p>${T.body1}</p>
            <p>${T.body2}</p>
            <p><a href="${BASE_URL}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">${T.cta}</a></p>
            <p style="color: #999; font-size: 12px;">${T.footer}</p>
            <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
          </div>`
        );
        // SMS final reminder
        if (booking.client_phone) {
          const smsPrefs = await queryOne<{ sms_bookings: boolean }>(
            "SELECT sms_bookings FROM notification_preferences WHERE user_id = $1",
            [booking.client_id]
          );
          if (smsPrefs?.sms_bookings !== false) {
            const smsBody = pickT({
              en: `Photo Portugal: Last chance! Your booking with ${booking.photographer_name} will be cancelled in 6 hours if not paid. Pay now: https://photoportugal.com/dashboard/bookings`,
              pt: `Photo Portugal: Última oportunidade! A sua reserva com ${booking.photographer_name} será cancelada em 6 horas se não for paga. Pague agora: https://photoportugal.com/dashboard/bookings`,
              de: `Photo Portugal: Letzte Chance! Ihre Buchung mit ${booking.photographer_name} wird in 6 Stunden storniert, wenn nicht bezahlt. Jetzt bezahlen: https://photoportugal.com/dashboard/bookings`,
              es: `Photo Portugal: ¡Última oportunidad! Su reserva con ${booking.photographer_name} se cancelará en 6 horas si no se paga. Pague ahora: https://photoportugal.com/dashboard/bookings`,
              fr: `Photo Portugal : Dernière chance ! Votre réservation avec ${booking.photographer_name} sera annulée dans 6 heures si non payée. Payez maintenant : https://photoportugal.com/dashboard/bookings`,
            }, cLocale);
            sendSMS(
              booking.client_phone,
              smsBody
            ).catch(err => console.error("[cron] final payment reminder sms error:", err));
          }
        }
        await queryOne(
          "UPDATE bookings SET payment_final_reminder_sent = TRUE WHERE id = $1 RETURNING id",
          [booking.id]
        );
        paymentFinalReminders++;
      } catch (err) {
        results.errors.push(`Final payment reminder for booking ${booking.id}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Final payment reminders query: ${err}`);
  }

  // === 1bb. CRITICAL 30-min final warning (23h30m after confirmation — last chance) ===
  let paymentCriticalReminders = 0;
  try {
    const criticalBookings = await query<{
      id: string;
      client_email: string;
      client_name: string;
      client_phone: string | null;
      client_id: string;
      photographer_name: string;
      total_price: number | null;
    }>(
      `SELECT b.id, u.email as client_email, u.name as client_name,
              u.phone as client_phone, u.id as client_id,
              pu.name as photographer_name, b.total_price
       FROM bookings b
       JOIN users u ON u.id = b.client_id
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users pu ON pu.id = pp.user_id
       WHERE b.status = 'confirmed'
         AND b.payment_status != 'paid'
         AND b.confirmed_at < NOW() - INTERVAL '23 hours 30 minutes'
         AND b.confirmed_at > NOW() - INTERVAL '24 hours'
         AND b.payment_critical_reminder_sent = FALSE`
    );

    for (const booking of criticalBookings) {
      try {
        const BASE_URL = process.env.AUTH_URL || "https://photoportugal.com";
        const { getUserLocaleByEmail, pickT } = await import("@/lib/email-locale");
        const cLocale = await getUserLocaleByEmail(booking.client_email);
        const priceStr = booking.total_price ? ` (€${Math.round(booking.total_price)})` : "";
        const firstName = booking.client_name.split(" ")[0];
        const T = pickT({
          en: { subject: "🚨 FINAL WARNING — 30 minutes left to pay", h2: "30 Minutes Left — Last Chance", greet: `Hi ${firstName},`, body1: `This is the FINAL warning. Your booking with <strong>${booking.photographer_name}</strong>${priceStr} will be <strong>automatically cancelled in approximately 30 minutes</strong>.`, body2: `Pay now or lose your slot — there will be no further warnings.`, cta: "Pay Now — Final Chance" },
          pt: { subject: "🚨 AVISO FINAL — restam 30 minutos para pagar", h2: "30 Minutos Restantes — Última Oportunidade", greet: `Olá ${firstName},`, body1: `Este é o aviso FINAL. A sua reserva com <strong>${booking.photographer_name}</strong>${priceStr} será <strong>automaticamente cancelada em aproximadamente 30 minutos</strong>.`, body2: `Pague agora ou perca o seu horário — não haverá mais avisos.`, cta: "Pagar agora — Última oportunidade" },
          de: { subject: "🚨 LETZTE WARNUNG — 30 Minuten zum Bezahlen", h2: "30 Minuten verbleibend — Letzte Chance", greet: `Hallo ${firstName},`, body1: `Dies ist die LETZTE Warnung. Ihre Buchung mit <strong>${booking.photographer_name}</strong>${priceStr} wird <strong>in etwa 30 Minuten automatisch storniert</strong>.`, body2: `Jetzt bezahlen oder den Termin verlieren — es wird keine weiteren Warnungen geben.`, cta: "Jetzt bezahlen — Letzte Chance" },
          es: { subject: "🚨 AVISO FINAL — quedan 30 minutos para pagar", h2: "30 Minutos Restantes — Última Oportunidad", greet: `Hola ${firstName},`, body1: `Este es el aviso FINAL. Su reserva con <strong>${booking.photographer_name}</strong>${priceStr} se <strong>cancelará automáticamente en aproximadamente 30 minutos</strong>.`, body2: `Pague ahora o pierda su horario — no habrá más avisos.`, cta: "Pagar ahora — Última oportunidad" },
          fr: { subject: "🚨 DERNIER AVERTISSEMENT — 30 minutes pour payer", h2: "30 Minutes Restantes — Dernière Chance", greet: `Bonjour ${firstName},`, body1: `Ceci est le DERNIER avertissement. Votre réservation avec <strong>${booking.photographer_name}</strong>${priceStr} sera <strong>automatiquement annulée dans environ 30 minutes</strong>.`, body2: `Payez maintenant ou perdez votre créneau — il n'y aura plus d'avertissement.`, cta: "Payer maintenant — Dernière chance" },
        }, cLocale);
        await sendEmail(
          booking.client_email,
          T.subject,
          `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #DC2626;">${T.h2}</h2>
            <p>${T.greet}</p>
            <p style="font-size: 16px; line-height: 1.6;">${T.body1}</p>
            <p style="font-size: 15px; font-weight: bold; color: #DC2626;">${T.body2}</p>
            <p><a href="${BASE_URL}/dashboard/bookings" style="display: inline-block; background: #DC2626; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 17px;">${T.cta}</a></p>
            <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
          </div>`
        );

        // Critical SMS — short and urgent
        if (booking.client_phone) {
          const smsPrefs = await queryOne<{ sms_bookings: boolean }>(
            "SELECT sms_bookings FROM notification_preferences WHERE user_id = $1",
            [booking.client_id]
          );
          if (smsPrefs?.sms_bookings !== false) {
            const smsBody = pickT({
              en: `🚨 Photo Portugal: FINAL WARNING — your booking with ${booking.photographer_name} will be cancelled in ~30 minutes if not paid. Pay NOW: https://photoportugal.com/dashboard/bookings`,
              pt: `🚨 Photo Portugal: AVISO FINAL — a sua reserva com ${booking.photographer_name} será cancelada em ~30 min se não for paga. Pague JÁ: https://photoportugal.com/dashboard/bookings`,
              de: `🚨 Photo Portugal: LETZTE WARNUNG — Ihre Buchung mit ${booking.photographer_name} wird in ~30 Min storniert, wenn nicht bezahlt. JETZT zahlen: https://photoportugal.com/dashboard/bookings`,
              es: `🚨 Photo Portugal: AVISO FINAL — su reserva con ${booking.photographer_name} se cancelará en ~30 min si no se paga. Pague YA: https://photoportugal.com/dashboard/bookings`,
              fr: `🚨 Photo Portugal : DERNIER AVERTISSEMENT — votre réservation avec ${booking.photographer_name} sera annulée dans ~30 min si non payée. Payez MAINTENANT : https://photoportugal.com/dashboard/bookings`,
            }, cLocale);
            sendSMS(booking.client_phone, smsBody).catch(err => console.error("[cron] critical sms error:", err));
          }
        }

        await queryOne(
          "UPDATE bookings SET payment_critical_reminder_sent = TRUE WHERE id = $1 RETURNING id",
          [booking.id]
        );
        paymentCriticalReminders++;
      } catch (err) {
        results.errors.push(`Critical reminder for booking ${booking.id}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Critical reminders query: ${err}`);
  }

  // === 1c. Auto-cancel unpaid bookings (24h after confirmation) ===
  try {
    const staleUnpaid = await query<{
      id: string;
      client_email: string;
      client_name: string;
      photographer_email: string;
      photographer_name: string;
      photographer_user_id: string;
      photographer_profile_id: string;
    }>(
      `SELECT b.id, cu.email as client_email, cu.name as client_name,
              pu.email as photographer_email, pu.name as photographer_name,
              pu.id as photographer_user_id, pp.id as photographer_profile_id
       FROM bookings b
       JOIN users cu ON cu.id = b.client_id
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users pu ON pu.id = pp.user_id
       WHERE b.status = 'confirmed'
         AND b.payment_status IS DISTINCT FROM 'paid'
         AND COALESCE(b.confirmed_at, b.updated_at) < NOW() - INTERVAL '24 hours'`
    );

    for (const booking of staleUnpaid) {
      try {
        // Mark cancelled with cancelled_by='system' so the dashboard /
        // chat / Telegram alerts can distinguish auto-cancel from a
        // manual photographer/client cancel.
        await queryOne(
          `UPDATE bookings
           SET status = 'cancelled', cancelled_at = NOW(),
               cancelled_by = 'system',
               cancelled_reason = 'Auto-cancelled — payment not received within 24 hours'
           WHERE id = $1 RETURNING id`,
          [booking.id]
        );

        // Notify client (localized)
        const { getUserLocaleByEmail: gulb, pickT: pkt } = await import("@/lib/email-locale");
        const cLoc = await gulb(booking.client_email);
        const Tcancel = pkt({
          en: { subject: "Booking cancelled — payment not received", h2: "Booking Auto-Cancelled", greet: `Hi ${booking.client_name},`, body1: `Your booking with <strong>${booking.photographer_name}</strong> has been automatically cancelled because payment was not received within 24 hours.`, body2: "If you'd still like to book, feel free to submit a new request.", cta: "Browse Photographers" },
          pt: { subject: "Reserva cancelada — pagamento não recebido", h2: "Reserva cancelada automaticamente", greet: `Olá ${booking.client_name},`, body1: `A sua reserva com <strong>${booking.photographer_name}</strong> foi cancelada automaticamente porque o pagamento não foi recebido em 24 horas.`, body2: "Se ainda desejar reservar, fique à vontade para enviar um novo pedido.", cta: "Ver fotógrafos" },
          de: { subject: "Buchung storniert — Zahlung nicht erhalten", h2: "Buchung automatisch storniert", greet: `Hallo ${booking.client_name},`, body1: `Ihre Buchung mit <strong>${booking.photographer_name}</strong> wurde automatisch storniert, da die Zahlung nicht innerhalb von 24 Stunden eingegangen ist.`, body2: "Wenn Sie weiterhin buchen möchten, senden Sie gerne eine neue Anfrage.", cta: "Fotografen ansehen" },
          es: { subject: "Reserva cancelada — pago no recibido", h2: "Reserva cancelada automáticamente", greet: `Hola ${booking.client_name},`, body1: `Su reserva con <strong>${booking.photographer_name}</strong> ha sido cancelada automáticamente porque no se recibió el pago en 24 horas.`, body2: "Si aún desea reservar, no dude en enviar una nueva solicitud.", cta: "Ver fotógrafos" },
          fr: { subject: "Réservation annulée — paiement non reçu", h2: "Réservation annulée automatiquement", greet: `Bonjour ${booking.client_name},`, body1: `Votre réservation avec <strong>${booking.photographer_name}</strong> a été automatiquement annulée car le paiement n'a pas été reçu dans les 24 heures.`, body2: "Si vous souhaitez toujours réserver, n'hésitez pas à envoyer une nouvelle demande.", cta: "Voir les photographes" },
        }, cLoc);
        sendEmail(
          booking.client_email,
          Tcancel.subject,
          `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #C94536;">${Tcancel.h2}</h2>
            <p>${Tcancel.greet}</p>
            <p>${Tcancel.body1}</p>
            <p>${Tcancel.body2}</p>
            <p><a href="${process.env.AUTH_URL || "https://photoportugal.com"}/photographers" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">${Tcancel.cta}</a></p>
            <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
          </div>`
        );

        // Notify photographer
        sendEmail(
          booking.photographer_email,
          `Booking auto-cancelled — client did not pay`,
          `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #C94536;">Booking Auto-Cancelled</h2>
            <p>Hi ${booking.photographer_name},</p>
            <p>The booking with <strong>${booking.client_name}</strong> has been automatically cancelled because payment was not received within 24 hours.</p>
            <p><a href="${process.env.AUTH_URL || "https://photoportugal.com"}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Bookings</a></p>
            <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
          </div>`
        );

        results.autoCancelled++;
        import("@/lib/telegram").then(({ sendTelegram }) => {
          sendTelegram(`⏰ <b>Booking Auto-Cancelled</b>\n\n${booking.client_name} → ${booking.photographer_name}\nReason: Payment not received within 24h`, "bookings");
        }).catch((err) => console.error("[cron] telegram auto-cancel error:", err));
        sendAdminAutoCancelNotification(booking.client_name, booking.photographer_name)
          .catch((err) => console.error("[cron] admin email auto-cancel error:", err));

        // SMS/WhatsApp to photographer
        try {
          const photographerPhone = await queryOne<{ phone: string | null }>(
            "SELECT phone FROM users WHERE id = $1",
            [booking.photographer_user_id]
          );
          const smsPrefs = await queryOne<{ sms_bookings: boolean }>(
            "SELECT sms_bookings FROM notification_preferences WHERE user_id = $1",
            [booking.photographer_user_id]
          );
          if (photographerPhone?.phone && smsPrefs?.sms_bookings !== false) {
            queueNotification({
              channel: "sms",
              recipient: photographerPhone.phone,
              body: `Photo Portugal: Booking with ${booking.client_name} has been auto-cancelled (payment not received within 24h). Log in to view: https://photoportugal.com/dashboard/bookings`,
              dedupKey: `auto_cancel_sms:${booking.id}`,
            }).catch(err => console.error("[cron] sms auto-cancel error:", err));
          }
        } catch (smsErr) {
          console.error("[cron] auto-cancel sms error:", smsErr);
        }

        // Telegram to photographer
        import("@/lib/notify-photographer").then(m =>
          m.notifyPhotographerViaTelegram(
            booking.photographer_profile_id,
            `⏰ Booking auto-cancelled\n\nClient: ${booking.client_name}\nReason: Payment not received within 24h\n\nView: https://photoportugal.com/dashboard/bookings`
          )
        ).catch((err) => console.error("[cron] telegram photographer auto-cancel error:", err));
      } catch (err) {
        results.errors.push(`Auto-cancel booking ${booking.id}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Auto-cancel unpaid query: ${err}`);
  }

  // === 2. Shoot reminders (24h before shoot_date) ===
  try {
    const upcomingBookings = await query<{
      id: string;
      client_email: string;
      client_name: string;
      photographer_email: string;
      photographer_name: string;
      shoot_date: string;
    }>(
      `SELECT b.id, cu.email as client_email, cu.name as client_name,
              pu.email as photographer_email, pu.name as photographer_name,
              b.shoot_date::text
       FROM bookings b
       JOIN users cu ON cu.id = b.client_id
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users pu ON pu.id = pp.user_id
       WHERE b.status IN ('confirmed')
         AND b.payment_status = 'paid'
         AND b.shoot_date = CURRENT_DATE + INTERVAL '1 day'
         AND b.shoot_reminder_sent = FALSE
         AND b.reminder_sent = FALSE`
    );

    for (const booking of upcomingBookings) {
      try {
        // Get phone numbers for timezone-aware queuing
        const smsInfo = await queryOne<{
          photographer_phone: string | null; photographer_user_id: string;
          client_phone: string | null; client_id: string;
        }>(
          `SELECT pu.phone as photographer_phone, pu.id as photographer_user_id,
                  cu.phone as client_phone, cu.id as client_id
           FROM bookings b
           JOIN users cu ON cu.id = b.client_id
           JOIN photographer_profiles pp ON pp.id = b.photographer_id
           JOIN users pu ON pu.id = pp.user_id
           WHERE b.id = $1`,
          [booking.id]
        );

        // Queue email reminders (timezone-aware — "tomorrow" must be accurate)
        {
          const rendered = renderShootReminderToClient(booking.client_name, booking.photographer_name, booking.shoot_date);
          await queueNotification({
            channel: "email",
            recipient: booking.client_email,
            subject: rendered.subject,
            body: rendered.html,
            dedupKey: `shoot_reminder_email_client:${booking.id}`,
            recipientPhone: smsInfo?.client_phone || undefined,
          });
        }
        {
          const rendered = renderShootReminderToPhotographer(booking.photographer_name, booking.client_name, booking.shoot_date);
          await queueNotification({
            channel: "email",
            recipient: booking.photographer_email,
            subject: rendered.subject,
            body: rendered.html,
            dedupKey: `shoot_reminder_email_photographer:${booking.id}`,
            recipientPhone: smsInfo?.photographer_phone || undefined,
          });
        }

        // SMS reminders to both parties
        try {
          if (smsInfo) {
            // Photographer WhatsApp/SMS
            if (smsInfo.photographer_phone) {
              const pPrefs = await queryOne<{ sms_bookings: boolean }>(
                "SELECT sms_bookings FROM notification_preferences WHERE user_id = $1",
                [smsInfo.photographer_user_id]
              );
              if (pPrefs?.sms_bookings !== false) {
                queueNotification({
                  channel: "sms",
                  recipient: smsInfo.photographer_phone,
                  body: `Photo Portugal: Reminder — you have a photoshoot with ${booking.client_name} tomorrow. Check your dashboard for details.`,
                  dedupKey: `shoot_reminder_sms_photographer:${booking.id}`,
                }).catch(err => console.error("[sms] error:", err));
              }
            }
            // Client WhatsApp/SMS
            if (smsInfo.client_phone) {
              const cPrefs = await queryOne<{ sms_bookings: boolean }>(
                "SELECT sms_bookings FROM notification_preferences WHERE user_id = $1",
                [smsInfo.client_id]
              );
              if (cPrefs?.sms_bookings !== false) {
                const { getUserLocaleById, pickT } = await import("@/lib/email-locale");
                const cLocale = await getUserLocaleById(smsInfo.client_id);
                const body = pickT({
                  en: `Photo Portugal: Reminder — your photoshoot with ${booking.photographer_name} is tomorrow! Check your dashboard for details.`,
                  pt: `Photo Portugal: Lembrete — a sua sessão fotográfica com ${booking.photographer_name} é amanhã! Veja os detalhes no seu painel.`,
                  de: `Photo Portugal: Erinnerung — Ihr Fotoshooting mit ${booking.photographer_name} ist morgen! Details im Dashboard.`,
                  fr: `Photo Portugal : Rappel — votre séance photo avec ${booking.photographer_name} est demain ! Détails sur votre tableau de bord.`,
                }, cLocale);
                queueNotification({
                  channel: "sms",
                  recipient: smsInfo.client_phone,
                  body,
                  dedupKey: `shoot_reminder_sms_client:${booking.id}`,
                }).catch(err => console.error("[sms] error:", err));
              }
            }
          }
        } catch (smsErr) {
          console.error("[cron] shoot reminder sms error:", smsErr);
        }

        // Push notifications to both parties — same dedup-by-update guard
        // as SMS (only fires once because we set shoot_reminder_sent below).
        if (smsInfo) {
          import("@/lib/push").then(m => Promise.all([
            m.sendPushNotification(
              smsInfo.photographer_user_id,
              "Photoshoot tomorrow",
              `You have a photoshoot with ${booking.client_name} tomorrow.`,
              { type: "booking", bookingId: booking.id }
            ),
            m.sendPushNotification(
              smsInfo.client_id,
              "Photoshoot tomorrow",
              `Your session with ${booking.photographer_name} is tomorrow!`,
              { type: "booking", bookingId: booking.id }
            ),
          ])).catch(err => console.error("[cron] shoot reminder push error:", err));
        }

        await queryOne(
          "UPDATE bookings SET shoot_reminder_sent = TRUE WHERE id = $1 RETURNING id",
          [booking.id]
        );
        results.shootReminders++;
      } catch (err) {
        results.errors.push(`Shoot reminder for booking ${booking.id}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Shoot reminders query: ${err}`);
  }

  // === 2b. Session reminders (after shoot date passed, photographer hasn't marked done) ===
  try {
    const sessionReminders = await query<{
      id: string;
      shoot_date: string | null;
      flexible_date_from: string | null;
      flexible_date_to: string | null;
      photographer_email: string;
      photographer_name: string;
      client_name: string;
      photographer_profile_id: string;
    }>(
      `SELECT b.id, b.shoot_date::text, b.flexible_date_from::text, b.flexible_date_to::text,
              pu.email as photographer_email, pu.name as photographer_name,
              cu.name as client_name,
              pp.id as photographer_profile_id
       FROM bookings b
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users pu ON pu.id = pp.user_id
       JOIN users cu ON cu.id = b.client_id
       WHERE b.status = 'confirmed'
         AND b.payment_status = 'paid'
         AND COALESCE(b.session_reminder_sent, FALSE) = FALSE
         AND (
           (b.shoot_date IS NOT NULL AND b.shoot_date < CURRENT_DATE)
           OR (b.flexible_date_to IS NOT NULL AND b.flexible_date_to < CURRENT_DATE)
         )`
    );

    for (const booking of sessionReminders) {
      try {
        const { formatShootDate } = await import("@/lib/format-shoot-date");
        const dateOpts = { month: "long" as const, day: "numeric" as const, year: "numeric" as const };
        const dateDisplay = formatShootDate(booking.shoot_date, "en", dateOpts)
          || formatShootDate(booking.flexible_date_to, "en", dateOpts)
          || "your scheduled date";
        const baseUrl = process.env.AUTH_URL || "https://photoportugal.com";

        await sendEmail(
          booking.photographer_email,
          `Did your session with ${booking.client_name} take place?`,
          emailLayout(`
            <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Did the session take place?</h2>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${booking.photographer_name.split(" ")[0]},</p>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Your session with <strong>${booking.client_name}</strong> was scheduled for ${dateDisplay}. Please confirm that the session took place by marking it in your dashboard.</p>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">If something went wrong or the client didn't show up, please contact our support team.</p>
            ${emailButton(`${baseUrl}/dashboard/bookings`, "Confirm Session")}
          `)
        );

        // Telegram notification
        try {
          const { notifyPhotographerViaTelegram } = await import("@/lib/notify-photographer");
          await notifyPhotographerViaTelegram(
            booking.photographer_profile_id,
            `Did the session with ${booking.client_name} take place?\n\nPlease confirm in your dashboard:\n${baseUrl}/dashboard/bookings`
          );
        } catch {}

        await queryOne(
          "UPDATE bookings SET session_reminder_sent = TRUE WHERE id = $1 RETURNING id",
          [booking.id]
        );
        results.sessionReminders++;
      } catch (err) {
        results.errors.push(`Session reminder for booking ${booking.id}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Session reminders query: ${err}`);
  }

  // === 3. Delivery reminders (if delivery_days passed after completion) ===
  try {
    const overdueDeliveries = await query<{
      id: string;
      photographer_email: string;
      photographer_name: string;
      photographer_phone: string | null;
      client_name: string;
    }>(
      `SELECT b.id, pu.email as photographer_email, pu.name as photographer_name,
              pu.phone as photographer_phone, cu.name as client_name
       FROM bookings b
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users pu ON pu.id = pp.user_id
       JOIN users cu ON cu.id = b.client_id
       LEFT JOIN packages p ON p.id = b.package_id
       WHERE b.status = 'completed'
         AND b.delivery_token IS NULL
         AND b.shoot_date < NOW() - (COALESCE(p.delivery_days, 7) * INTERVAL '1 day')
         AND b.delivery_reminder_sent = FALSE`
    );

    for (const booking of overdueDeliveries) {
      try {
        {
          const rendered = renderDeliveryReminderToPhotographer(booking.photographer_name, booking.client_name);
          await queueNotification({
            channel: "email",
            recipient: booking.photographer_email,
            subject: rendered.subject,
            body: rendered.html,
            dedupKey: `delivery_reminder_email:${booking.id}`,
            recipientPhone: booking.photographer_phone || undefined,
          });
        }
        await queryOne(
          "UPDATE bookings SET delivery_reminder_sent = TRUE WHERE id = $1 RETURNING id",
          [booking.id]
        );
        results.deliveryReminders++;
      } catch (err) {
        results.errors.push(`Delivery reminder for booking ${booking.id}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Delivery reminders query: ${err}`);
  }

  // === 3b. Delivery escalation: 14-day second reminder + admin alert ===
  try {
    const overdueEscalations = await query<{
      id: string;
      photographer_email: string;
      photographer_name: string;
      client_name: string;
      client_email: string;
    }>(
      `SELECT b.id, pu.email as photographer_email, pu.name as photographer_name,
              cu.name as client_name, cu.email as client_email
       FROM bookings b
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users pu ON pu.id = pp.user_id
       JOIN users cu ON cu.id = b.client_id
       LEFT JOIN packages p ON p.id = b.package_id
       WHERE b.status = 'completed'
         AND b.delivery_token IS NULL
         AND b.updated_at < NOW() - INTERVAL '14 days'
         AND b.delivery_reminder_sent = TRUE
         AND NOT EXISTS (
           SELECT 1 FROM bookings b2 WHERE b2.id = b.id AND b2.updated_at < NOW() - INTERVAL '21 days'
         )`
    );

    for (const booking of overdueEscalations) {
      try {
        // Second reminder to photographer
        await sendEmail(
          booking.photographer_email,
          `Urgent: ${booking.client_name} is still waiting for their photos (14 days overdue)`,
          `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #C94536;">Second Delivery Reminder</h2>
            <p>Hi ${booking.photographer_name},</p>
            <p>Your client <strong>${booking.client_name}</strong> has been waiting for their photos for over 14 days. Please deliver the photos as soon as possible.</p>
            <p style="padding: 12px; background: #fef2f2; border-radius: 8px; color: #991b1b; font-size: 13px;">
              <strong>Warning:</strong> If photos are not delivered within 21 days, the booking will be automatically cancelled and the client will receive a full refund.
            </p>
            <p><a href="${process.env.AUTH_URL || "https://photoportugal.com"}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Go to Bookings</a></p>
            <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
          </div>`
        );

        // Alert admin
        const adminEmail = await getAdminEmail();
        const adminEmails = adminEmail.split(",").map((e: string) => e.trim()).filter(Boolean);
        for (const email of adminEmails) {
          await sendEmail(
            email,
            `[Alert] Photographer ${booking.photographer_name} overdue on delivery for 14 days`,
            `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
              <h2 style="color: #C94536;">Delivery Overdue — 14 Days</h2>
              <p>Photographer <strong>${booking.photographer_name}</strong> (${booking.photographer_email}) has not delivered photos for booking ${booking.id}.</p>
              <p>Client: <strong>${booking.client_name}</strong> (${booking.client_email})</p>
              <p>The booking will be auto-refunded at 21 days if not resolved.</p>
              <p><a href="${process.env.AUTH_URL || "https://photoportugal.com"}/admin" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Go to Admin</a></p>
            </div>`
          );
        }

        results.deliveryEscalations++;
      } catch (err) {
        results.errors.push(`Delivery escalation for booking ${booking.id}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Delivery escalation query: ${err}`);
  }

  // === 3c. Delivery auto-refund: 21 days overdue, auto-cancel and refund ===
  try {
    const overdueAutoRefunds = await query<{
      id: string;
      photographer_email: string;
      photographer_name: string;
      client_email: string;
      client_name: string;
      payment_status: string | null;
      stripe_payment_intent_id: string | null;
      total_price: number | null;
      service_fee: number | null;
    }>(
      `SELECT b.id, pu.email as photographer_email, pu.name as photographer_name,
              cu.email as client_email, cu.name as client_name,
              b.payment_status, b.stripe_payment_intent_id, b.total_price, b.service_fee
       FROM bookings b
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users pu ON pu.id = pp.user_id
       JOIN users cu ON cu.id = b.client_id
       WHERE b.status = 'completed'
         AND b.delivery_token IS NULL
         AND b.updated_at < NOW() - INTERVAL '21 days'`
    );

    for (const booking of overdueAutoRefunds) {
      try {
        // Refund if paid
        if (booking.payment_status === "paid" && booking.stripe_payment_intent_id) {
          try {
            const stripeClient = requireStripe();
            await stripeClient.refunds.create({
              payment_intent: booking.stripe_payment_intent_id,
            });
            await queryOne(
              "UPDATE bookings SET payment_status = 'refunded' WHERE id = $1 RETURNING id",
              [booking.id]
            );
          } catch (stripeErr) {
            console.error(`[cron] auto-refund stripe error for booking ${booking.id}:`, stripeErr);
          }
        }

        // Cancel the booking
        await queryOne(
          "UPDATE bookings SET status = 'cancelled' WHERE id = $1 RETURNING id",
          [booking.id]
        );

        const baseUrl = process.env.AUTH_URL || "https://photoportugal.com";

        // Email client
        sendEmail(
          booking.client_email,
          `Booking cancelled — photographer did not deliver photos`,
          `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #C94536;">Booking Auto-Cancelled</h2>
            <p>Hi ${booking.client_name},</p>
            <p>Your booking with <strong>${booking.photographer_name}</strong> has been automatically cancelled because the photos were not delivered within 21 days.</p>
            ${booking.payment_status === "paid" ? `<p>A full refund has been issued. The refund should appear in your account within 5-10 business days.</p>` : ""}
            <p><a href="${baseUrl}/photographers" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Browse Photographers</a></p>
            <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
          </div>`
        );

        // Email photographer
        sendEmail(
          booking.photographer_email,
          `Booking cancelled — photos not delivered within 21 days`,
          `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #C94536;">Booking Auto-Cancelled</h2>
            <p>Hi ${booking.photographer_name},</p>
            <p>Your booking with <strong>${booking.client_name}</strong> has been automatically cancelled because photos were not delivered within 21 days.</p>
            ${booking.payment_status === "paid" ? `<p>The client's payment has been refunded.</p>` : ""}
            <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
          </div>`
        );

        results.deliveryAutoRefunds++;
      } catch (err) {
        results.errors.push(`Delivery auto-refund for booking ${booking.id}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Delivery auto-refund query: ${err}`);
  }

  // === 3d. Auto-release payment: 14 days after delivery without client acceptance ===
  try {
    const autoReleaseBookings = await query<{
      id: string;
      total_price: number | null;
      payout_amount: number | null;
      payout_transferred: boolean;
      stripe_payment_intent_id: string | null;
      photographer_stripe_id: string | null;
      photographer_stripe_ready: boolean;
      photographer_plan: string;
      photographer_email: string;
      photographer_name: string;
      client_email: string;
      client_name: string;
    }>(
      `SELECT b.id, b.total_price, b.payout_amount, b.payout_transferred,
              b.stripe_payment_intent_id,
              pp.stripe_account_id as photographer_stripe_id,
              pp.stripe_onboarding_complete as photographer_stripe_ready,
              pp.plan as photographer_plan,
              pu.email as photographer_email,
              pu.name as photographer_name,
              cu.email as client_email,
              cu.name as client_name
       FROM bookings b
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users pu ON pu.id = pp.user_id
       JOIN users cu ON cu.id = b.client_id
       WHERE b.status = 'delivered'
         AND COALESCE(b.delivery_accepted, FALSE) = FALSE
         AND b.payment_status = 'paid'
         AND b.stripe_payment_intent_id IS NOT NULL
         AND b.updated_at < NOW() - INTERVAL '14 days'`
    );

    for (const booking of autoReleaseBookings) {
      try {
        // Mark as accepted
        await queryOne(
          "UPDATE bookings SET delivery_accepted = TRUE, delivery_accepted_at = NOW() WHERE id = $1 AND COALESCE(delivery_accepted, FALSE) = FALSE RETURNING id",
          [booking.id]
        );

        // Transfer payout to photographer (same logic as delivery accept)
        if (!booking.payout_transferred && booking.photographer_stripe_id && booking.photographer_stripe_ready) {
          try {
            const stripeClient = requireStripe();

            let payoutAmount = booking.payout_amount ? Number(booking.payout_amount) : null;
            if (!payoutAmount && booking.total_price) {
              const payment = calculatePayment(booking.total_price, booking.photographer_plan);
              payoutAmount = payment.photographerPayout;
            }

            if (payoutAmount && payoutAmount > 0) {
              // Atomic claim — flip TRUE only if currently FALSE so a
              // concurrent /accept call can't fire transfers.create
              // for the same booking. See accept/route.ts for the full
              // race-condition rationale.
              const claim = await queryOne<{ id: string }>(
                "UPDATE bookings SET payout_transferred = TRUE WHERE id = $1 AND COALESCE(payout_transferred, FALSE) = FALSE RETURNING id",
                [booking.id]
              );
              if (claim) {
                try {
                  await stripeClient.transfers.create({
                    amount: Math.round(payoutAmount * 100),
                    currency: "eur",
                    destination: booking.photographer_stripe_id,
                    ...(booking.stripe_payment_intent_id
                      ? { transfer_group: booking.stripe_payment_intent_id }
                      : {}),
                    metadata: {
                      booking_id: booking.id,
                      type: "auto_release_payout",
                      ...(booking.stripe_payment_intent_id
                        ? { payment_intent_id: booking.stripe_payment_intent_id }
                        : {}),
                    },
                  }, { idempotencyKey: `payout_${booking.id}` });
                } catch (transferErr) {
                  // Roll back claim so this booking can be retried.
                  // Idempotency key means a re-run won't double-pay
                  // even if the failed call actually went through.
                  await queryOne(
                    "UPDATE bookings SET payout_transferred = FALSE WHERE id = $1 RETURNING id",
                    [booking.id]
                  ).catch(() => {});
                  throw transferErr;
                }
              }
            }
          } catch (stripeErr) {
            console.error(`[cron] auto-release payout error for booking ${booking.id}:`, stripeErr);
          }
        }

        // Update delivery expiry to 90 days from now
        const newExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
        await queryOne(
          "UPDATE bookings SET delivery_expires_at = $1 WHERE id = $2 RETURNING id",
          [newExpiry.toISOString(), booking.id]
        );

        const baseUrl = process.env.AUTH_URL || "https://photoportugal.com";

        // Email client
        sendEmail(
          booking.client_email,
          `Photos auto-accepted after 14 days`,
          `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #C94536;">Photos Auto-Accepted</h2>
            <p>Hi ${booking.client_name},</p>
            <p>Your photos from <strong>${booking.photographer_name}</strong> have been automatically accepted after 14 days. The payment has been released to the photographer.</p>
            <p>Your photos are still available for download for 90 days.</p>
            <p><a href="${baseUrl}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Bookings</a></p>
            <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
          </div>`
        );

        // Email photographer
        sendEmail(
          booking.photographer_email,
          `Photos auto-accepted after 14 days — payment released`,
          `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #C94536;">Payment Released!</h2>
            <p>Hi ${booking.photographer_name},</p>
            <p>The photos for <strong>${booking.client_name}</strong> have been automatically accepted after 14 days. Your payment has been transferred to your Stripe account.</p>
            <p><a href="${baseUrl}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Dashboard</a></p>
            <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
          </div>`
        );

        results.autoReleasedPayments++;
      } catch (err) {
        results.errors.push(`Auto-release payment for booking ${booking.id}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Auto-release payments query: ${err}`);
  }

  // === 3d2. Client delivery review reminder (3 days after delivered, if not accepted) ===
  let deliveryReviewReminders = 0;
  try {
    const unacceptedDeliveries = await query<{
      id: string;
      client_email: string;
      client_name: string;
      photographer_name: string;
    }>(
      `SELECT b.id, cu.email as client_email, cu.name as client_name,
              pu.name as photographer_name
       FROM bookings b
       JOIN users cu ON cu.id = b.client_id
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users pu ON pu.id = pp.user_id
       WHERE b.status = 'delivered'
         AND COALESCE(b.delivery_accepted, FALSE) = FALSE
         AND b.updated_at < NOW() - INTERVAL '3 days'
         AND COALESCE(b.delivery_review_reminder_sent, FALSE) = FALSE`
    );

    for (const booking of unacceptedDeliveries) {
      try {
        const baseUrl = process.env.AUTH_URL || "https://photoportugal.com";
        await sendEmail(
          booking.client_email,
          `Don't forget to review your photos from ${booking.photographer_name}!`,
          `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #C94536;">Your photos are waiting!</h2>
            <p>Hi ${booking.client_name.split(" ")[0]},</p>
            <p>Your photo previews from <strong>${booking.photographer_name}</strong> are ready and waiting for your review. Accept them to download the full-resolution versions.</p>
            <p><a href="${baseUrl}/dashboard/bookings" style="display: inline-block; background: #C94536; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Review Your Photos</a></p>
            <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
          </div>`
        );
        await queryOne(
          "UPDATE bookings SET delivery_review_reminder_sent = TRUE WHERE id = $1 RETURNING id",
          [booking.id]
        );
        deliveryReviewReminders++;
      } catch (err) {
        results.errors.push(`Delivery review reminder for booking ${booking.id}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Delivery review reminders query: ${err}`);
  }

  // === 3e. Retry pending payouts (delivery accepted but payout not transferred) ===
  try {
    const pendingPayouts = await query<{
      id: string; total_price: number | null; payout_amount: number | null;
      stripe_payment_intent_id: string | null;
      photographer_stripe_id: string; photographer_plan: string;
      photographer_email: string; photographer_name: string;
    }>(
      `SELECT b.id, b.total_price, b.payout_amount, b.stripe_payment_intent_id,
              pp.stripe_account_id as photographer_stripe_id,
              pp.plan as photographer_plan,
              pu.email as photographer_email, pu.name as photographer_name
       FROM bookings b
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users pu ON pu.id = pp.user_id
       WHERE b.delivery_accepted = TRUE
         AND b.payment_status = 'paid'
         AND b.stripe_payment_intent_id IS NOT NULL
         AND COALESCE(b.payout_transferred, FALSE) = FALSE
         AND pp.stripe_account_id IS NOT NULL
         AND pp.stripe_onboarding_complete = TRUE
         AND b.delivery_accepted_at < NOW() - INTERVAL '7 days'`
    );

    for (const booking of pendingPayouts) {
      try {
        const stripeClient = requireStripe();
        let payoutAmount = booking.payout_amount ? Number(booking.payout_amount) : null;
        if (!payoutAmount && booking.total_price) {
          const payment = calculatePayment(booking.total_price, booking.photographer_plan);
          payoutAmount = payment.photographerPayout;
        }
        if (payoutAmount && payoutAmount > 0) {
          // Atomic claim — wins the race against /accept and other
          // cron paths. Same pattern as accept/route.ts. Note the
          // idempotency key reuses the booking id so a transfer that
          // actually completed but whose response we lost won't be
          // re-issued on retry — Stripe returns the original.
          const claim = await queryOne<{ id: string }>(
            "UPDATE bookings SET payout_transferred = TRUE WHERE id = $1 AND COALESCE(payout_transferred, FALSE) = FALSE RETURNING id",
            [booking.id]
          );
          if (!claim) continue;
          try {
            await stripeClient.transfers.create({
              amount: Math.round(payoutAmount * 100),
              currency: "eur",
              destination: booking.photographer_stripe_id,
              ...(booking.stripe_payment_intent_id ? { transfer_group: booking.stripe_payment_intent_id } : {}),
              metadata: {
                booking_id: booking.id,
                type: "retry_payout",
                ...(booking.stripe_payment_intent_id ? { payment_intent_id: booking.stripe_payment_intent_id } : {}),
              },
            }, { idempotencyKey: `payout_${booking.id}` });
          } catch (transferErr) {
            await queryOne(
              "UPDATE bookings SET payout_transferred = FALSE WHERE id = $1 RETURNING id",
              [booking.id]
            ).catch(() => {});
            throw transferErr;
          }
          sendEmail(booking.photographer_email, "Payment transferred!",
            `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
              <h2 style="color: #C94536;">Payment Transferred!</h2>
              <p>Hi ${booking.photographer_name.split(" ")[0]},</p>
              <p>Your payment of <strong>€${Math.round(payoutAmount)}</strong> has been transferred to your Stripe account.</p>
              <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
            </div>`
          );
          console.log(`[cron] Retry payout success for booking ${booking.id}: €${payoutAmount}`);
        }
      } catch (err) {
        results.errors.push(`Retry payout for booking ${booking.id}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Retry payouts query: ${err}`);
  }

  // === 4. Review request chat from Kate (3h after delivery accepted) ===
  // Primary signal — Kate-voice card in the booking chat with a 10%-off
  // promise. Runs BEFORE the day-1 email so the chat lands first.
  try {
    const needsReviewChat = await query<{ id: string; client_name: string }>(
      `SELECT b.id, cu.name as client_name
       FROM bookings b
       JOIN users cu ON cu.id = b.client_id
       WHERE b.delivery_accepted = TRUE
         AND b.delivery_accepted_at < NOW() - INTERVAL '3 hours'
         AND b.delivery_accepted_at > NOW() - INTERVAL '24 hours'
         AND COALESCE(b.review_chat_sent, FALSE) = FALSE
         AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id = b.id)`
    );

    const { sendReviewRequestMessage } = await import("@/lib/booking-messages");
    for (const booking of needsReviewChat) {
      try {
        const firstName = (booking.client_name || "").split(" ")[0];
        const ok = await sendReviewRequestMessage(booking.id, firstName);
        if (ok) {
          await query("UPDATE bookings SET review_chat_sent = TRUE WHERE id = $1", [booking.id]);
          results.reviewChatRequests++;
        }
      } catch (err) {
        results.errors.push(`Review chat for booking ${booking.id}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Review chat query: ${err}`);
  }

  // === 4a. Review reminder (1 day after delivery accepted, no review yet) ===
  let reviewReminders = 0;
  try {
    const needsReviewReminder = await query<{
      id: string; client_email: string; client_name: string;
      photographer_name: string; photographer_slug: string;
      client_phone: string | null;
    }>(
      `SELECT b.id, cu.email as client_email, cu.name as client_name,
              pu.name as photographer_name, pp.slug as photographer_slug,
              cu.phone as client_phone
       FROM bookings b
       JOIN users cu ON cu.id = b.client_id
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users pu ON pu.id = pp.user_id
       WHERE b.status = 'delivered'
         AND b.delivery_accepted = TRUE
         AND b.delivery_accepted_at < NOW() - INTERVAL '1 day'
         AND b.delivery_accepted_at > NOW() - INTERVAL '2 days'
         AND COALESCE(b.review_requested, FALSE) = FALSE
         AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id = b.id)`
    );

    const baseUrl = process.env.AUTH_URL || "https://photoportugal.com";

    for (const booking of needsReviewReminder) {
      try {
        const firstName = booking.client_name.split(" ")[0];
        const reviewUrl = `${baseUrl}/dashboard/bookings?review=${encodeURIComponent(booking.id)}`;
        await sendEmail(
          booking.client_email,
          `How was your photoshoot with ${booking.photographer_name}?`,
          `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #C94536;">How was your experience?</h2>
            <p>Hi ${firstName},</p>
            <p>We hope you love your photos from <strong>${booking.photographer_name}</strong>!</p>
            <p>A quick review would mean the world — it helps other travelers find great photographers and supports ${booking.photographer_name.split(" ")[0]}'s work on our platform.</p>
            <p style="background: #FFF8E1; border: 1px solid #FFE082; border-radius: 10px; padding: 12px 16px; font-size: 14px;">🎁 As a thank-you, you'll get a <strong>10% off code</strong> for your next session — valid for 12 months.</p>
            <p><a href="${reviewUrl}" style="display: inline-block; background: #C94536; color: white; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 16px;">Leave a Review</a></p>
            <p style="color: #666; font-size: 13px;">It only takes a minute and makes a big difference.</p>
            <p style="color: #999; font-size: 12px;">Photo Portugal — photoportugal.com</p>
          </div>`
        );
        await queryOne("UPDATE bookings SET review_requested = TRUE WHERE id = $1 RETURNING id", [booking.id]);
        reviewReminders++;
      } catch (err) {
        results.errors.push(`Review reminder for booking ${booking.id}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Review reminders query: ${err}`);
  }

  // === 4b. SMS review reminder (5 days after delivery accepted, still no review) ===
  let smsReviewReminders = 0;
  try {
    const needsSmsReview = await query<{
      id: string; client_name: string; client_phone: string; client_locale: string | null;
      photographer_name: string;
    }>(
      `SELECT b.id, cu.name as client_name, cu.phone as client_phone, cu.locale as client_locale,
              pu.name as photographer_name
       FROM bookings b
       JOIN users cu ON cu.id = b.client_id
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users pu ON pu.id = pp.user_id
       WHERE b.status = 'delivered'
         AND b.delivery_accepted = TRUE
         AND b.delivery_accepted_at < NOW() - INTERVAL '5 days'
         AND cu.phone IS NOT NULL
         AND COALESCE(b.review_sms_sent, FALSE) = FALSE
         AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id = b.id)`
    );

    const { normalizeLocale, pickT, localizedUrl } = await import("@/lib/email-locale");

    for (const booking of needsSmsReview) {
      try {
        const firstName = booking.client_name.split(" ")[0];
        const cLocale = normalizeLocale(booking.client_locale);
        const url = localizedUrl(`/dashboard/bookings?review=${encodeURIComponent(booking.id)}`, cLocale);
        const body = pickT({
          en: `Hi ${firstName}! We'd love to hear about your photoshoot with ${booking.photographer_name}. A quick review helps other travelers: ${url}`,
          pt: `Olá ${firstName}! Gostaríamos de saber como correu a sua sessão com ${booking.photographer_name}. Uma avaliação rápida ajuda outros viajantes: ${url}`,
          de: `Hallo ${firstName}! Wir würden gerne hören, wie Ihr Fotoshooting mit ${booking.photographer_name} war. Eine kurze Bewertung hilft anderen Reisenden: ${url}`,
          fr: `Bonjour ${firstName} ! Nous serions ravis de connaître votre avis sur la séance avec ${booking.photographer_name}. Un court avis aide d'autres voyageurs : ${url}`,
        }, cLocale);
        await queueNotification({
          channel: "sms",
          recipient: booking.client_phone,
          body,
          dedupKey: `review_sms:${booking.id}`,
        });
        await query("UPDATE bookings SET review_sms_sent = TRUE WHERE id = $1", [booking.id]);
        smsReviewReminders++;
      } catch (err) {
        results.errors.push(`SMS review reminder for booking ${booking.id}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`SMS review reminders query: ${err}`);
  }

  // === 4c. Trustpilot follow-up (3 days after delivery accepted) ===
  try {
    const recentlyAccepted = await query<{
      id: string;
      client_email: string;
      client_name: string;
      client_phone: string | null;
      photographer_email: string;
      photographer_name: string;
      photographer_phone: string | null;
    }>(
      `SELECT b.id, cu.email as client_email, cu.name as client_name,
              cu.phone as client_phone,
              pu.email as photographer_email, pu.name as photographer_name,
              pu.phone as photographer_phone
       FROM bookings b
       JOIN users cu ON cu.id = b.client_id
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users pu ON pu.id = pp.user_id
       WHERE b.status = 'delivered'
         AND b.delivery_accepted = TRUE
         AND b.delivery_accepted_at < NOW() - INTERVAL '3 days'
         AND b.delivery_accepted_at > NOW() - INTERVAL '4 days'
         AND b.trustpilot_sent = FALSE`
    );

    for (const booking of recentlyAccepted) {
      try {
        {
          const rendered = renderTrustpilotFollowUpToClient(booking.client_name, booking.photographer_name);
          await queueNotification({
            channel: "email",
            recipient: booking.client_email,
            subject: rendered.subject,
            body: rendered.html,
            dedupKey: `trustpilot_email_client:${booking.id}`,
            recipientPhone: booking.client_phone || undefined,
          });
        }
        {
          const rendered = renderTrustpilotFollowUpToPhotographer(booking.photographer_name);
          await queueNotification({
            channel: "email",
            recipient: booking.photographer_email,
            subject: rendered.subject,
            body: rendered.html,
            dedupKey: `trustpilot_email_photographer:${booking.id}`,
            recipientPhone: booking.photographer_phone || undefined,
          });
        }
        await queryOne(
          "UPDATE bookings SET trustpilot_sent = TRUE WHERE id = $1 RETURNING id",
          [booking.id]
        );
        results.trustpilotFollowUps++;
      } catch (err) {
        results.errors.push(`Trustpilot follow-up for booking ${booking.id}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Trustpilot follow-ups query: ${err}`);
  }

  // === Early Bird tier expiration ===
  let earlyBirdExpired = 0;
  try {
    const expired = await query<{ id: string; early_bird_tier: string }>(
      `SELECT id, early_bird_tier FROM photographer_profiles
       WHERE early_bird_expires_at IS NOT NULL
       AND early_bird_expires_at < NOW()
       AND early_bird_tier IS NOT NULL
       AND is_founding = FALSE`
    );
    for (const p of expired) {
      // Downgrade to free plan
      await queryOne(
        `UPDATE photographer_profiles
         SET plan = 'free', early_bird_tier = NULL, early_bird_expires_at = NULL
         WHERE id = $1 RETURNING id`,
        [p.id]
      );
      earlyBirdExpired++;
    }
  } catch (err) {
    results.errors.push(`Early bird expiration: ${err}`);
  }

  // === 4.5. Retry stuck delivery ZIP builds ===
  // Catches cases where the fire-and-forget buildDeliveryZip() trigger in /accept
  // was lost (e.g. process restarted before the build finished).
  let zipsBuilt = 0;
  try {
    const stuckZips = await query<{ id: string }>(
      `SELECT b.id FROM bookings b
       WHERE b.delivery_accepted = TRUE
         AND COALESCE(b.zip_ready, FALSE) = FALSE
         AND b.delivery_accepted_at < NOW() - INTERVAL '5 minutes'
         AND EXISTS (SELECT 1 FROM delivery_photos dp WHERE dp.booking_id = b.id)
       LIMIT 5`
    );
    if (stuckZips.length > 0) {
      const { buildDeliveryZip } = await import("@/lib/build-zip");
      for (const booking of stuckZips) {
        try {
          const result = await buildDeliveryZip(booking.id);
          if (result) zipsBuilt++;
        } catch (err) {
          console.error(`[cron] zip rebuild error for booking ${booking.id}:`, err);
        }
      }
    }
  } catch (err) {
    results.errors.push(`Stuck ZIP rebuild: ${err}`);
  }

  // === 4d. Delivery expiry warning (7 days before public link expires) ===
  // Public delivery URL is good for 90 days; on day 83 we email the client
  // a single-click ZIP download so they don't lose photos by inertia. The
  // plaintext password is recovered from the auto-sent DELIVERY chat
  // message (delivery_password column is bcrypted, can't be reused in URL).
  let deliveryExpiryWarnings = 0;
  try {
    const expiringSoon = await query<{
      id: string; client_email: string; client_name: string; client_locale: string | null;
      photographer_name: string; delivery_token: string; delivery_expires_at: string;
      zip_ready: boolean; zip_size: number | null;
      delivery_chat_payload: string | null;
    }>(
      `SELECT b.id, cu.email as client_email, cu.name as client_name, cu.locale as client_locale,
              pu.name as photographer_name, b.delivery_token, b.delivery_expires_at,
              COALESCE(b.zip_ready, FALSE) as zip_ready, b.zip_size,
              (SELECT m.text FROM messages m
                WHERE m.booking_id = b.id AND m.text LIKE 'DELIVERY:%'
                ORDER BY m.created_at DESC LIMIT 1) as delivery_chat_payload
       FROM bookings b
       JOIN users cu ON cu.id = b.client_id
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users pu ON pu.id = pp.user_id
       WHERE b.delivery_token IS NOT NULL
         AND b.delivery_expires_at IS NOT NULL
         AND b.delivery_expires_at > NOW()
         AND b.delivery_expires_at < NOW() + INTERVAL '7 days'
         AND COALESCE(b.delivery_expiry_warning_sent, FALSE) = FALSE
         AND EXISTS (SELECT 1 FROM delivery_photos dp WHERE dp.booking_id = b.id)`
    );

    const baseUrl = process.env.AUTH_URL || "https://photoportugal.com";
    for (const booking of expiringSoon) {
      try {
        let pw = "";
        if (booking.delivery_chat_payload?.startsWith("DELIVERY:")) {
          const parts = booking.delivery_chat_payload.split(":");
          pw = parts[parts.length - 1] || "";
        }
        const galleryUrl = `${baseUrl}/delivery/${booking.delivery_token}${pw ? `?pw=${encodeURIComponent(pw)}` : ""}`;
        const downloadUrl = pw
          ? `${baseUrl}/api/delivery/${booking.delivery_token}/download?password=${encodeURIComponent(pw)}`
          : null;
        const firstName = booking.client_name.split(" ")[0];
        const expiresOn = new Date(booking.delivery_expires_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
        const sizeText = booking.zip_size ? ` (${(Number(booking.zip_size) / 1024 / 1024).toFixed(0)} MB)` : "";

        const ctaBlock = booking.zip_ready && downloadUrl
          ? `<p style="text-align: center; margin: 24px 0;"><a href="${downloadUrl}" style="display: inline-block; background: #C94536; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 17px;">⬇️ Download all photos${sizeText}</a></p>
             <p style="text-align: center; font-size: 12px; color: #999;">One click — no login needed.</p>`
          : `<p style="text-align: center; margin: 24px 0;"><a href="${galleryUrl}" style="display: inline-block; background: #C94536; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 17px;">📸 Open your gallery</a></p>
             <p style="text-align: center; font-size: 12px; color: #999;">Download photos one by one from the gallery page.</p>`;

        await sendEmail(
          booking.client_email,
          `Your photos from ${booking.photographer_name} expire in 7 days`,
          `<div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
            <h2 style="color: #C94536;">Don't lose your photos!</h2>
            <p>Hi ${firstName},</p>
            <p>Your gallery from <strong>${booking.photographer_name}</strong> will be removed from Photo Portugal on <strong>${expiresOn}</strong> (7 days from now).</p>
            <p>Make sure to download the full ZIP to keep them forever:</p>
            ${ctaBlock}
            <p style="font-size: 13px; color: #666;">After ${expiresOn}, the public link stops working. We keep a hidden backup for another 3 months in case anything goes wrong, but the cleanest path is to download now.</p>
            <p style="color: #999; font-size: 12px; margin-top: 24px;">Photo Portugal — photoportugal.com</p>
          </div>`
        );
        await query("UPDATE bookings SET delivery_expiry_warning_sent = TRUE WHERE id = $1", [booking.id]);
        deliveryExpiryWarnings++;
      } catch (err) {
        results.errors.push(`Delivery expiry warning for booking ${booking.id}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Delivery expiry warning query: ${err}`);
  }

  // === 5. Expired delivery file cleanup ===
  let expiredDeliveriesCleaned = 0;
  try {
    const expiredDeliveries = await query<{ id: string }>(
      `SELECT b.id FROM bookings b
       WHERE b.delivery_expires_at < NOW() - INTERVAL '90 days'
         AND EXISTS (SELECT 1 FROM delivery_photos dp WHERE dp.booking_id = b.id)`
    );

    for (const booking of expiredDeliveries) {
      try {
        // Snapshot all blob URLs (originals + previews + zip) BEFORE the DELETE
        // so we can clean storage even after the rows are gone.
        const blobs = await query<{ url: string; preview_url: string | null }>(
          "SELECT url, preview_url FROM delivery_photos WHERE booking_id = $1",
          [booking.id]
        );
        const zipRow = await queryOne<{ zip_path: string | null }>(
          "SELECT zip_path FROM bookings WHERE id = $1", [booking.id]
        );

        // Delete delivery_photos records from DB
        const deleted = await queryOne<{ count: string }>(
          "WITH d AS (DELETE FROM delivery_photos WHERE booking_id = $1 RETURNING id) SELECT COUNT(*) as count FROM d",
          [booking.id]
        );

        // Delete blobs from R2 (current) and local disk (legacy fallback).
        const { deleteFromS3 } = await import("@/lib/s3");
        const R2_PUBLIC_PREFIX = (process.env.R2_PUBLIC_URL || "https://files.photoportugal.com") + "/";
        const allUrls = [
          ...blobs.flatMap((b) => [b.url, b.preview_url].filter((u): u is string => !!u)),
          zipRow?.zip_path || null,
        ].filter((u): u is string => !!u);

        for (const url of allUrls) {
          try {
            if (url.startsWith(R2_PUBLIC_PREFIX)) {
              await deleteFromS3(url.slice(R2_PUBLIC_PREFIX.length));
            } else if (url.startsWith("s3://")) {
              await deleteFromS3(url.replace(/^s3:\/\/[^/]+\//, ""));
            }
            // /uploads/... paths are cleaned via the rm below
          } catch { /* best-effort */ }
        }

        // Legacy local-disk cleanup — harmless if dir doesn't exist.
        const deliveryDir = path.join(UPLOAD_DIR, "delivery", booking.id);
        try {
          await rm(deliveryDir, { recursive: true, force: true });
        } catch {
          // Directory may not exist, that's fine
        }

        expiredDeliveriesCleaned++;
        console.log(`[cron/reminders] cleaned expired delivery for booking ${booking.id} (${deleted?.count || 0} photos)`);
      } catch (err) {
        results.errors.push(`Expired delivery cleanup for booking ${booking.id}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Expired delivery cleanup query: ${err}`);
  }

  // === Checklist complete → notify admins (cron catch-up) ===
  try {
    const readyPhotographers = await query<{ id: string }>(
      `SELECT pp.id FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE COALESCE(pp.checklist_notified, FALSE) = FALSE
         AND COALESCE(u.is_banned, FALSE) = FALSE
         AND u.avatar_url IS NOT NULL
         AND pp.cover_url IS NOT NULL
         AND pp.bio IS NOT NULL AND LENGTH(pp.bio) > 10
         AND (SELECT COUNT(*) FROM portfolio_items WHERE photographer_id = pp.id) >= 15
         AND (SELECT COUNT(*) FROM packages WHERE photographer_id = pp.id) >= 1
         AND (SELECT COUNT(*) FROM photographer_locations WHERE photographer_id = pp.id) >= 1
         AND pp.stripe_account_id IS NOT NULL AND pp.stripe_onboarding_complete = TRUE
         AND u.phone IS NOT NULL`
    );
    for (const p of readyPhotographers) {
      try {
        const { checkAndNotifyChecklistComplete } = await import("@/lib/checklist-notify");
        await checkAndNotifyChecklistComplete(p.id);
      } catch {}
    }
  } catch (err) {
    results.errors.push(`Checklist ready notification: ${err}`);
  }

  // === Checklist deadline reminders (last day — 6-7 days after registration) ===
  let checklistDeadlineEmails = 0;
  try {
    const incompletePhotographers = await query<{ email: string; name: string; id: string }>(
      `SELECT u.email, u.name, pp.id
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE pp.is_approved = FALSE
         AND pp.created_at >= NOW() - INTERVAL '8 days'
         AND pp.created_at < NOW() - INTERVAL '6 days'
         AND COALESCE(pp.checklist_deadline_emailed, FALSE) = FALSE
         AND NOT (u.avatar_url IS NOT NULL AND pp.cover_url IS NOT NULL AND pp.bio IS NOT NULL AND LENGTH(pp.bio) > 10
           AND (SELECT COUNT(*) FROM portfolio_items WHERE photographer_id = pp.id) >= 15
           AND (SELECT COUNT(*) FROM packages WHERE photographer_id = pp.id) >= 1
           AND (SELECT COUNT(*) FROM photographer_locations WHERE photographer_id = pp.id) >= 1
           AND pp.stripe_account_id IS NOT NULL AND pp.stripe_onboarding_complete = TRUE
           AND u.phone IS NOT NULL)`
    );
    for (const p of incompletePhotographers) {
      try {
        // Mark as emailed first to prevent re-sending on next cron run
        await queryOne("UPDATE photographer_profiles SET checklist_deadline_emailed = TRUE WHERE id = $1", [p.id]);
        await sendEmail(
          p.email,
          "Complete your Photo Portugal profile today",
          `<p>Hi ${p.name},</p>
<p>Your photographer profile on Photo Portugal is almost ready, but some steps are still incomplete.</p>
<p><strong>Please complete your profile today</strong> to avoid account deactivation. Once your checklist is done, our team will review and approve your profile so you can start receiving bookings.</p>
<p><a href="https://photoportugal.com/dashboard" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Complete My Profile</a></p>
<p>If you need help, reply to this email or visit our <a href="https://photoportugal.com/support">Help Center</a>.</p>
<p>Best,<br>Photo Portugal Team</p>`
        );
        checklistDeadlineEmails++;
        console.log(`[cron/reminders] checklist deadline email sent to ${p.email}`);
      } catch (err) {
        results.errors.push(`Checklist deadline email for ${p.email}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Checklist deadline query: ${err}`);
  }

  // === Auto-deactivate photographers who didn't complete checklist in 7 days ===
  // Two-tier Stripe check:
  //   1. SQL pre-filter — checklist treats `stripe_onboarding_complete=TRUE`
  //      as the only "Stripe done" signal. Anyone whose KYC isn't fully
  //      verified makes it into the candidate pool, including people who
  //      finished filling everything in but Stripe is still verifying.
  //   2. Stripe API check — for each candidate with a stripe_account_id,
  //      fetch the account and look at `details_submitted`:
  //        TRUE  → photographer did their part, waiting on Stripe KYC
  //                (don't punish, skip deactivation)
  //        FALSE → bailed mid-onboarding, never submitted their info
  //                → deactivate
  //      No stripe_account_id at all → deactivate.
  //   The previous version treated "started Stripe" as "complete enough",
  //   which let abandoned-mid-onboarding accounts slip through forever.
  let checklistDeactivated = 0;
  try {
    const candidates = await query<{
      id: string; email: string; name: string;
      stripe_account_id: string | null;
      stripe_onboarding_complete: boolean;
    }>(
      `SELECT pp.id, u.email, u.name,
              pp.stripe_account_id,
              COALESCE(pp.stripe_onboarding_complete, FALSE) as stripe_onboarding_complete
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE pp.is_approved = FALSE
         AND pp.created_at < NOW() - INTERVAL '7 days'
         AND COALESCE(u.is_banned, FALSE) = FALSE
         AND NOT (u.avatar_url IS NOT NULL AND pp.cover_url IS NOT NULL AND pp.bio IS NOT NULL AND LENGTH(pp.bio) > 10
           AND (SELECT COUNT(*) FROM portfolio_items WHERE photographer_id = pp.id) >= 15
           AND (SELECT COUNT(*) FROM packages WHERE photographer_id = pp.id) >= 1
           AND (SELECT COUNT(*) FROM photographer_locations WHERE photographer_id = pp.id) >= 1
           AND COALESCE(pp.stripe_onboarding_complete, FALSE) = TRUE
           AND u.phone IS NOT NULL)`
    );

    const stripeClient = (() => {
      try { return requireStripe(); } catch { return null; }
    })();

    for (const p of candidates) {
      try {
        // If photographer started Stripe AND filled in their details,
        // give them the benefit of the doubt — Stripe's verification is
        // out of their hands. If they never started Stripe, OR started
        // but bailed before submitting, deactivate.
        let waitingOnStripe = false;
        if (p.stripe_account_id && stripeClient) {
          if (p.stripe_onboarding_complete) {
            waitingOnStripe = true; // already verified, must be other checklist gaps
          } else {
            try {
              const acct = await stripeClient.accounts.retrieve(p.stripe_account_id);
              if (acct.details_submitted) waitingOnStripe = true;
              // Sync DB flag back from Stripe — when a photographer
              // completes the onboarding form, Stripe flips
              // charges_enabled + payouts_enabled but our DB doesn't
              // know unless they trigger the booking flow that
              // refreshes it. Catching it here prevents the next 15-min
              // cron tick from hammering the Stripe API for the same
              // already-resolved account.
              if (acct.charges_enabled && acct.payouts_enabled) {
                await query(
                  "UPDATE photographer_profiles SET stripe_onboarding_complete = TRUE WHERE id = $1 AND COALESCE(stripe_onboarding_complete, FALSE) = FALSE",
                  [p.id]
                ).catch(() => {});
              }
            } catch (err) {
              console.error(`[cron] stripe accounts.retrieve failed for ${p.email}:`, err);
              // Be cautious — if Stripe fetch fails (transient), skip
              // deactivation this run. We'll re-evaluate next cron tick.
              waitingOnStripe = true;
            }
          }
        }
        if (waitingOnStripe) {
          // Skip — only Stripe-verification-pending blocking them.
          continue;
        }

        await query("UPDATE users SET is_banned = TRUE WHERE id = (SELECT user_id FROM photographer_profiles WHERE id = $1)", [p.id]);
        await sendEmail(
          p.email,
          "Your Photo Portugal account has been deactivated",
          `<p>Hi ${p.name},</p>
<p>Your photographer profile on Photo Portugal has been deactivated because the onboarding checklist was not completed within 7 days of registration.</p>
<p>If you'd like to reactivate your account, please contact us at <a href="mailto:info@photoportugal.com">info@photoportugal.com</a> and we'll help you get started again.</p>
<p>Best,<br>Photo Portugal Team</p>`
        );
        checklistDeactivated++;
        console.log(`[cron/reminders] deactivated incomplete photographer ${p.name} (${p.email})`);
        import("@/lib/telegram").then(({ sendTelegram }) => {
          sendTelegram(`🚫 <b>Photographer Deactivated</b>\n\n${p.name} (${p.email})\nReason: Profile not completed within 7 days`, "photographers");
        }).catch((err) => console.error("[cron] telegram deactivation error:", err));
      } catch (err) {
        results.errors.push(`Checklist deactivation for ${p.email}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Checklist deactivation query: ${err}`);
  }

  // Clean old notification logs (30 days)
  try {
    const { cleanOldNotificationLogs } = await import("@/lib/notification-log");
    await cleanOldNotificationLogs();
  } catch {}

  // Clean old visitor sessions (30 days)
  try {
    await queryOne("DELETE FROM visitor_sessions WHERE started_at < NOW() - INTERVAL '30 days'", []);
  } catch {}

  // Clean unverified users older than 24h (spam prevention)
  let unverifiedCleaned = 0;
  try {
    // Only delete users who registered via email (have password_hash), not OAuth
    const deleted = await query<{ id: string }>(
      `DELETE FROM users
       WHERE email_verified = FALSE
         AND password_hash IS NOT NULL
         AND created_at < NOW() - INTERVAL '24 hours'
         AND NOT EXISTS (SELECT 1 FROM bookings WHERE client_id = users.id)
         AND NOT EXISTS (SELECT 1 FROM photographer_profiles WHERE user_id = users.id AND is_approved = TRUE)
       RETURNING id`
    );
    unverifiedCleaned = deleted.length;
    if (unverifiedCleaned > 0) console.log(`[cron/reminders] cleaned ${unverifiedCleaned} unverified users`);
  } catch (err) {
    results.errors.push(`Unverified user cleanup: ${err}`);
  }

  // === ABANDONED BOOKING REMINDERS ===
  // 1. Clients who visited /book/ page but never created a booking (24h after registration)
  let abandonedBookingEmails = 0;
  try {
    const { sendAbandonedBookingReminder } = await import("@/lib/email");
    // Find clients registered 4-48h ago with no bookings, who visited a /book/ page
    const abandonedClients = await query<{
      id: string; name: string; email: string;
    }>(
      `SELECT u.id, u.name, u.email
       FROM users u
       WHERE u.role = 'client'
         AND u.email_verified = TRUE
         AND u.created_at > NOW() - INTERVAL '48 hours'
         AND u.created_at < NOW() - INTERVAL '4 hours'
         AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.client_id = u.id)
         AND NOT EXISTS (SELECT 1 FROM notification_logs nl WHERE nl.recipient = u.email AND nl.event LIKE '%Still thinking%')
         AND NOT EXISTS (SELECT 1 FROM notification_logs nl WHERE nl.recipient = u.email AND nl.event LIKE '%Still looking%')
         AND EXISTS (
           SELECT 1 FROM visitor_sessions vs
           WHERE vs.user_id = u.id AND vs.pageviews::text LIKE '%/book/%'
         )
       ORDER BY u.created_at DESC
       LIMIT 10`
    );
    for (const c of abandonedClients) {
      // Get all /book/ and /photographers/ visits to find which photographers they looked at
      const sessions = await query<{ pageviews: string }>(
        `SELECT pageviews::text FROM visitor_sessions WHERE user_id = $1 OR visitor_id IN (SELECT visitor_id FROM visitor_sessions WHERE user_id = $1)`,
        [c.id]
      );
      const allPageviews = sessions.map(s => s.pageviews).join(" ");
      // Extract unique photographer slugs from /book/slug (most interested) and /photographers/slug
      const bookSlugs = [...new Set([...allPageviews.matchAll(/\/book\/([a-z0-9-]+)/g)].map(m => m[1]))];
      const profileSlugs = [...new Set([...allPageviews.matchAll(/\/photographers\/([a-z0-9-]+)/g)].map(m => m[1]))]
        .filter(s => !s.startsWith("location") && s !== "location");
      // Prioritize: /book/ slugs first, then most-viewed profiles
      const slugs = [...new Set([...bookSlugs, ...profileSlugs])].slice(0, 3);
      if (slugs.length === 0) continue;
      const photographers = await query<{ name: string; slug: string }>(
        `SELECT u.name, pp.slug FROM photographer_profiles pp JOIN users u ON u.id = pp.user_id WHERE pp.slug = ANY($1) AND pp.is_approved = TRUE`,
        [slugs]
      );
      if (photographers.length === 0) continue;
      // Sort to match slug order (book slugs first)
      const sorted = slugs.map(s => photographers.find(p => p.slug === s)).filter(Boolean) as { name: string; slug: string }[];
      await sendAbandonedBookingReminder(c.email, c.name, sorted);
      abandonedBookingEmails++;
    }
  } catch (err) {
    results.errors.push(`Abandoned booking reminders: ${err}`);
  }

  // 2. Clients registered 24-48h ago with no bookings and no /book/ visits → generic nudge
  let noBookingNudges = 0;
  try {
    const { sendNoBookingNudge } = await import("@/lib/email");
    const nudgeClients = await query<{ email: string; name: string }>(
      `SELECT u.email, u.name
       FROM users u
       WHERE u.role = 'client'
         AND u.email_verified = TRUE
         AND u.created_at > NOW() - INTERVAL '48 hours'
         AND u.created_at < NOW() - INTERVAL '4 hours'
         AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.client_id = u.id)
         AND NOT EXISTS (SELECT 1 FROM notification_logs nl WHERE nl.recipient = u.email AND nl.event LIKE '%Still thinking%')
         AND NOT EXISTS (SELECT 1 FROM notification_logs nl WHERE nl.recipient = u.email AND nl.event LIKE '%Still looking%')
         AND NOT EXISTS (SELECT 1 FROM notification_logs nl WHERE nl.recipient = u.email AND nl.event LIKE '%Need help finding%')
       LIMIT 10`
    );
    for (const c of nudgeClients) {
      await sendNoBookingNudge(c.email, c.name);
      noBookingNudges++;
    }
  } catch (err) {
    results.errors.push(`No-booking nudges: ${err}`);
  }

  // === New client admin notifications (delayed from OAuth to avoid photographer duplicates) ===
  let newClientNotifications = 0;
  try {
    // Find clients created 3-10 min ago via Google OAuth who haven't been notified yet
    // By this time, photographers have already gone through set-role and changed their role
    const newClients = await query<{ id: string; name: string; email: string }>(
      `SELECT u.id, u.name, u.email FROM users u
       WHERE u.role = 'client'
         AND u.google_id IS NOT NULL
         AND u.created_at > NOW() - INTERVAL '10 minutes'
         AND u.created_at < NOW() - INTERVAL '3 minutes'
         AND u.admin_notified IS NOT TRUE
         AND NOT EXISTS (SELECT 1 FROM photographer_profiles pp WHERE pp.user_id = u.id)
       LIMIT 20`
    );
    for (const c of newClients) {
      try {
        const { sendAdminNewClientNotification } = await import("@/lib/email");
        const { sendTelegram } = await import("@/lib/telegram");
        await sendAdminNewClientNotification(c.name || "Unknown", c.email);
        await sendTelegram(`👤 <b>New Client (Google)</b>\n\n<b>Name:</b> ${c.name || "Unknown"}\n<b>Email:</b> ${c.email}`, "clients");
        await query("UPDATE users SET admin_notified = TRUE WHERE id = $1", [c.id]);
        newClientNotifications++;
      } catch {}
    }
  } catch (err) {
    results.errors.push(`New client notifications: ${err}`);
  }

  // === UNANSWERED MESSAGE REMINDERS ===
  // Find conversations where a client sent a message and the photographer hasn't replied
  let unansweredReminders6h = 0;
  let unansweredReminders12h = 0;
  let unansweredAdminAlerts = 0;
  try {
    // Get all bookings with unread messages from clients (photographer hasn't replied)
    const unanswered = await query<{
      booking_id: string;
      photographer_user_id: string;
      photographer_name: string;
      photographer_email: string;
      photographer_phone: string | null;
      client_name: string;
      last_client_msg_at: string;
      hours_since: number;
      reminder_6h_sent: boolean;
      reminder_12h_sent: boolean;
      reminder_24h_sent: boolean;
    }>(`
      SELECT
        b.id as booking_id,
        pp.user_id as photographer_user_id,
        pu.name as photographer_name,
        pu.email as photographer_email,
        pu.phone as photographer_phone,
        cu.name as client_name,
        first_client_msg.created_at as first_client_msg_at,
        EXTRACT(EPOCH FROM (NOW() - first_client_msg.created_at))/3600 as hours_since,
        COALESCE(b.reminder_6h_sent, FALSE) as reminder_6h_sent,
        COALESCE(b.reminder_12h_sent, FALSE) as reminder_12h_sent,
        COALESCE(b.reminder_24h_sent, FALSE) as reminder_24h_sent
      FROM bookings b
      JOIN photographer_profiles pp ON pp.id = b.photographer_id
      JOIN users pu ON pu.id = pp.user_id
      JOIN users cu ON cu.id = b.client_id
      JOIN LATERAL (
        SELECT m.created_at FROM messages m
        WHERE m.booking_id = b.id AND m.sender_id = b.client_id AND m.is_system = FALSE
        ORDER BY m.created_at ASC LIMIT 1
      ) first_client_msg ON TRUE
      WHERE b.status = 'inquiry'
        AND NOT EXISTS (
          SELECT 1 FROM messages m2
          WHERE m2.booking_id = b.id
            AND m2.sender_id = pp.user_id
            AND m2.is_system = FALSE
        )
        AND EXTRACT(EPOCH FROM (NOW() - first_client_msg.created_at))/3600 >= 6
    `);

    const BASE_URL = process.env.AUTH_URL || "https://photoportugal.com";

    for (const u of unanswered) {
      try {
        const firstName = u.photographer_name.split(" ")[0];

        // 6-hour reminder
        if (u.hours_since >= 6 && !u.reminder_6h_sent) {
          // SMS
          if (u.photographer_phone) {
            await queueNotification({
              channel: "sms",
              recipient: u.photographer_phone,
              body: `Hi ${firstName}! ${u.client_name} is waiting for your reply on Photo Portugal. Please respond soon: ${BASE_URL}/dashboard/messages`,
              dedupKey: `unanswered_6h_sms:${u.booking_id}`,
            }).catch(console.error);
          }
          // Email
          await queueNotification({
            channel: "email",
            recipient: u.photographer_email,
            subject: `${u.client_name} is waiting for your reply`,
            body: emailLayout(`
              <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#C94536;">You have an unanswered message</h2>
              <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${firstName},</p>
              <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;"><strong>${u.client_name}</strong> sent you a message and is waiting for your reply. Quick responses help you win more bookings!</p>
              ${emailButton(`${BASE_URL}/dashboard/messages`, "Reply Now")}
            `),
            dedupKey: `unanswered_6h_email:${u.booking_id}`,
            recipientPhone: u.photographer_phone || undefined,
          }).catch(console.error);
          await query("UPDATE bookings SET reminder_6h_sent = TRUE WHERE id = $1", [u.booking_id]);
          unansweredReminders6h++;
        }

        // 12-hour reminder
        if (u.hours_since >= 12 && !u.reminder_12h_sent) {
          if (u.photographer_phone) {
            await queueNotification({
              channel: "sms",
              recipient: u.photographer_phone,
              body: `Reminder: ${u.client_name} has been waiting ${Math.round(u.hours_since)}h for your reply on Photo Portugal. Respond now to avoid losing this client: ${BASE_URL}/dashboard/messages`,
              dedupKey: `unanswered_12h_sms:${u.booking_id}`,
            }).catch(console.error);
          }
          await queueNotification({
            channel: "email",
            recipient: u.photographer_email,
            subject: `Reminder: ${u.client_name} is still waiting for your reply`,
            body: emailLayout(`
              <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#C94536;">Don't miss this opportunity!</h2>
              <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${firstName},</p>
              <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;"><strong>${u.client_name}</strong> sent you a message <strong>${Math.round(u.hours_since)} hours ago</strong> and hasn't received a reply yet.</p>
              <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Clients who don't hear back quickly often book someone else. Please reply as soon as possible!</p>
            `),
            dedupKey: `unanswered_12h_email:${u.booking_id}`,
            recipientPhone: u.photographer_phone || undefined,
          }).catch(console.error);
          await query("UPDATE bookings SET reminder_12h_sent = TRUE WHERE id = $1", [u.booking_id]);
          unansweredReminders12h++;
        }

        // 24-hour admin alert
        if (u.hours_since >= 24 && !u.reminder_24h_sent) {
          const { sendTelegram } = await import("@/lib/telegram");
          await sendTelegram(
            `⚠️ <b>Unanswered message (${Math.round(u.hours_since)}h)</b>\n\n` +
            `Client: ${u.client_name}\n` +
            `Photographer: ${u.photographer_name}\n` +
            `Waiting since: ${Math.round(u.hours_since)} hours`,
            "clients"
          ).catch(console.error);
          await query("UPDATE bookings SET reminder_24h_sent = TRUE WHERE id = $1", [u.booking_id]);
          unansweredAdminAlerts++;
        }
      } catch (err) {
        results.errors.push(`Unanswered reminder for booking ${u.booking_id}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Unanswered reminders: ${err}`);
  }

  // === SILENT CLIENT FOLLOW-UP (48h after photographer replied, client hasn't responded) ===
  let clientFollowUps = 0;
  try {
    const silentClients = await query<{
      booking_id: string;
      client_name: string;
      client_email: string;
      client_phone: string | null;
      client_locale: string | null;
      photographer_name: string;
      photographer_slug: string;
      hours_since_reply: number;
    }>(`
      SELECT
        b.id as booking_id,
        cu.name as client_name,
        cu.email as client_email,
        cu.phone as client_phone,
        cu.locale as client_locale,
        pu.name as photographer_name,
        pp.slug as photographer_slug,
        EXTRACT(EPOCH FROM (NOW() - last_photographer_msg.created_at))/3600 as hours_since_reply
      FROM bookings b
      JOIN users cu ON cu.id = b.client_id
      JOIN photographer_profiles pp ON pp.id = b.photographer_id
      JOIN users pu ON pu.id = pp.user_id
      JOIN LATERAL (
        SELECT m.created_at FROM messages m
        WHERE m.booking_id = b.id AND m.sender_id = pp.user_id AND m.is_system = FALSE
        ORDER BY m.created_at DESC LIMIT 1
      ) last_photographer_msg ON TRUE
      WHERE b.status = 'inquiry'
        AND COALESCE(b.client_followup_sent, FALSE) = FALSE
        AND EXTRACT(EPOCH FROM (NOW() - last_photographer_msg.created_at))/3600 >= 24
        AND NOT EXISTS (
          SELECT 1 FROM messages m2
          WHERE m2.booking_id = b.id
            AND m2.sender_id = b.client_id
            AND m2.is_system = FALSE
            AND m2.created_at > last_photographer_msg.created_at
        )
    `);

    const BASE_URL = process.env.AUTH_URL || "https://photoportugal.com";

    for (const c of silentClients) {
      try {
        const firstName = c.client_name.split(" ")[0];
        // Email
        await queueNotification({
          channel: "email",
          recipient: c.client_email,
          subject: `${c.photographer_name} is waiting for your reply`,
          body: emailLayout(`
            <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Still interested?</h2>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${firstName},</p>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;"><strong>${c.photographer_name}</strong> replied to your message and is waiting to hear back from you. Don't miss out — great photographers get booked fast!</p>
            ${emailButton(`${BASE_URL}/dashboard/messages`, "Reply Now")}
            <p style="margin:0;font-size:13px;line-height:1.5;color:#9B8E82;">If you're no longer interested, no action needed.</p>
          `),
          dedupKey: `client_followup_email:${c.booking_id}`,
          recipientPhone: c.client_phone || undefined,
        }).catch(console.error);
        // SMS
        if (c.client_phone) {
          const { normalizeLocale, pickT, localizedUrl } = await import("@/lib/email-locale");
          const cLocale = normalizeLocale(c.client_locale);
          const url = localizedUrl("/dashboard/messages", cLocale);
          const smsBody = pickT({
            en: `Hi ${firstName}! ${c.photographer_name} replied to your message on Photo Portugal and is waiting for you. Check it out: ${url}`,
            pt: `Olá ${firstName}! ${c.photographer_name} respondeu à sua mensagem na Photo Portugal e está à sua espera. Veja: ${url}`,
            de: `Hallo ${firstName}! ${c.photographer_name} hat Ihrer Nachricht auf Photo Portugal geantwortet und wartet auf Sie. Hier ansehen: ${url}`,
            fr: `Bonjour ${firstName} ! ${c.photographer_name} a répondu à votre message sur Photo Portugal et vous attend. À voir : ${url}`,
          }, cLocale);
          await queueNotification({
            channel: "sms",
            recipient: c.client_phone,
            body: smsBody,
            dedupKey: `client_followup_sms:${c.booking_id}`,
          }).catch(console.error);
        }
        await query("UPDATE bookings SET client_followup_sent = TRUE WHERE id = $1", [c.booking_id]);
        clientFollowUps++;
      } catch (err) {
        results.errors.push(`Client follow-up for booking ${c.booking_id}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Client follow-ups: ${err}`);
  }

  // === SILENT CLIENT 7-DAY ESCALATION (gentler 2nd nudge if still no reply) ===
  let clientFollowUps7d = 0;
  try {
    const silent7d = await query<{
      booking_id: string;
      client_name: string;
      client_email: string;
      client_phone: string | null;
      photographer_name: string;
      days_since_reply: number;
    }>(`
      SELECT
        b.id as booking_id,
        cu.name as client_name,
        cu.email as client_email,
        cu.phone as client_phone,
        pu.name as photographer_name,
        EXTRACT(EPOCH FROM (NOW() - last_photographer_msg.created_at))/86400 as days_since_reply
      FROM bookings b
      JOIN users cu ON cu.id = b.client_id
      JOIN photographer_profiles pp ON pp.id = b.photographer_id
      JOIN users pu ON pu.id = pp.user_id
      JOIN LATERAL (
        SELECT m.created_at FROM messages m
        WHERE m.booking_id = b.id AND m.sender_id = pp.user_id AND m.is_system = FALSE
        ORDER BY m.created_at DESC LIMIT 1
      ) last_photographer_msg ON TRUE
      WHERE b.status = 'inquiry'
        AND COALESCE(b.client_followup_sent, FALSE) = TRUE
        AND COALESCE(b.client_followup_7d_sent, FALSE) = FALSE
        AND EXTRACT(EPOCH FROM (NOW() - last_photographer_msg.created_at))/86400 >= 7
        AND NOT EXISTS (
          SELECT 1 FROM messages m2
          WHERE m2.booking_id = b.id
            AND m2.sender_id = b.client_id
            AND m2.is_system = FALSE
            AND m2.created_at > last_photographer_msg.created_at
        )
    `);

    const BASE_URL2 = process.env.AUTH_URL || "https://photoportugal.com";

    for (const c of silent7d) {
      try {
        const firstName = c.client_name.split(" ")[0];
        await queueNotification({
          channel: "email",
          recipient: c.client_email,
          subject: `Still thinking about your photoshoot in Portugal?`,
          body: emailLayout(`
            <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Still interested?</h2>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${firstName},</p>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">It's been about a week since <strong>${c.photographer_name}</strong> replied to your message and we haven't heard back.</p>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">No pressure — if your plans have changed, just ignore this email. But if you're still considering a photoshoot in Portugal, ${c.photographer_name} is still available and would love to hear from you.</p>
            ${emailButton(`${BASE_URL2}/dashboard/messages`, "Open chat")}
            <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#9B8E82;">Need help choosing a different photographer or have questions? Just reply to this email.</p>
          `),
          dedupKey: `client_followup_7d_email:${c.booking_id}`,
          recipientPhone: c.client_phone || undefined,
        }).catch(console.error);
        await query("UPDATE bookings SET client_followup_7d_sent = TRUE WHERE id = $1", [c.booking_id]);
        clientFollowUps7d++;
      } catch (err) {
        results.errors.push(`Client 7d follow-up for booking ${c.booking_id}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Client 7d follow-ups: ${err}`);
  }

  // === SILENT CLIENT 14-DAY ADMIN ALERT (client still silent — admin should reach out manually) ===
  let clientFollowUps14dAlerted = 0;
  try {
    const silent14d = await query<{
      booking_id: string;
      client_name: string;
      client_email: string;
      photographer_name: string;
      days_since_reply: number;
    }>(`
      SELECT
        b.id as booking_id,
        cu.name as client_name,
        cu.email as client_email,
        pu.name as photographer_name,
        EXTRACT(EPOCH FROM (NOW() - last_photographer_msg.created_at))/86400 as days_since_reply
      FROM bookings b
      JOIN users cu ON cu.id = b.client_id
      JOIN photographer_profiles pp ON pp.id = b.photographer_id
      JOIN users pu ON pu.id = pp.user_id
      JOIN LATERAL (
        SELECT m.created_at FROM messages m
        WHERE m.booking_id = b.id AND m.sender_id = pp.user_id AND m.is_system = FALSE
        ORDER BY m.created_at DESC LIMIT 1
      ) last_photographer_msg ON TRUE
      WHERE b.status = 'inquiry'
        AND COALESCE(b.client_followup_14d_alerted, FALSE) = FALSE
        AND EXTRACT(EPOCH FROM (NOW() - last_photographer_msg.created_at))/86400 >= 14
        AND NOT EXISTS (
          SELECT 1 FROM messages m2
          WHERE m2.booking_id = b.id
            AND m2.sender_id = b.client_id
            AND m2.is_system = FALSE
            AND m2.created_at > last_photographer_msg.created_at
        )
    `);

    for (const c of silent14d) {
      try {
        const { sendTelegram } = await import("@/lib/telegram");
        await sendTelegram(
          `👻 <b>Client silent ${Math.round(c.days_since_reply)}d after photographer reply</b>\n\n` +
          `Client: ${c.client_name} (${c.client_email})\n` +
          `Photographer: ${c.photographer_name}\n` +
          `Consider a personal reach-out.`,
          "clients"
        ).catch(console.error);
        await query("UPDATE bookings SET client_followup_14d_alerted = TRUE WHERE id = $1", [c.booking_id]);
        clientFollowUps14dAlerted++;
      } catch (err) {
        results.errors.push(`Client 14d admin alert for booking ${c.booking_id}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Client 14d alerts: ${err}`);
  }

  // === MATCH REQUEST CHOICE REMINDER (24h after matches sent, client hasn't chosen) ===
  let matchChoiceReminders = 0;
  try {
    const pendingChoices = await query<{
      id: string; name: string; email: string; phone: string | null;
      location_slug: string; shoot_type: string;
    }>(
      `SELECT id, name, email, phone, location_slug, shoot_type
       FROM match_requests
       WHERE status = 'matched'
         AND matched_at < NOW() - INTERVAL '24 hours'
         AND COALESCE(choice_reminder_sent, FALSE) = FALSE
         AND chosen_photographer_id IS NULL`
    );

    const BASE_URL = process.env.AUTH_URL || "https://photoportugal.com";

    for (const mr of pendingChoices) {
      try {
        const firstName = mr.name.split(" ")[0];
        await queueNotification({
          channel: "email",
          recipient: mr.email,
          subject: `${firstName}, your photographer matches are waiting!`,
          body: emailLayout(`
            <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1F1F1F;">Your matches are waiting!</h2>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">Hi ${firstName},</p>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4A4A;">We sent you hand-picked photographer recommendations yesterday. Our photographers are in high demand — don't miss out!</p>
            ${emailButton(`${BASE_URL}/dashboard/match-requests`, "View Your Matches")}
          `),
          dedupKey: `match_choice_reminder_email:${mr.id}`,
          recipientPhone: mr.phone || undefined,
        }).catch(console.error);
        if (mr.phone) {
          await queueNotification({
            channel: "sms",
            recipient: mr.phone,
            body: `Hi ${firstName}! Your photographer matches on Photo Portugal are waiting. Our photographers are in high demand — choose yours now: ${BASE_URL}/dashboard/match-requests`,
            dedupKey: `match_choice_reminder_sms:${mr.id}`,
          }).catch(console.error);
        }
        await query("UPDATE match_requests SET choice_reminder_sent = TRUE WHERE id = $1", [mr.id]);
        matchChoiceReminders++;
      } catch (err) {
        results.errors.push(`Match choice reminder for ${mr.id}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Match choice reminders: ${err}`);
  }

  // === Recalculate photographer avg response times ===
  try {
    await query(`
      UPDATE photographer_profiles pp SET avg_response_minutes = sub.avg_min FROM (
        SELECT pp2.id as profile_id,
               ROUND(AVG(EXTRACT(EPOCH FROM (first_reply.created_at - first_msg.created_at)) / 60))::int as avg_min
        FROM bookings b
        JOIN photographer_profiles pp2 ON pp2.id = b.photographer_id
        JOIN LATERAL (
          SELECT m.created_at FROM messages m
          WHERE m.booking_id = b.id AND m.sender_id = b.client_id AND m.is_system = FALSE
          ORDER BY m.created_at ASC LIMIT 1
        ) first_msg ON TRUE
        JOIN LATERAL (
          SELECT m.created_at FROM messages m
          WHERE m.booking_id = b.id AND m.sender_id = pp2.user_id AND m.is_system = FALSE AND m.created_at > first_msg.created_at
          ORDER BY m.created_at ASC LIMIT 1
        ) first_reply ON TRUE
        GROUP BY pp2.id
      ) sub WHERE sub.profile_id = pp.id
    `);
  } catch (err) {
    results.errors.push(`Avg response time update: ${err}`);
  }

  // === Process notification queue (timezone-aware deferred SMS/email) ===
  let queueProcessed = 0;
  try {
    queueProcessed = await processNotificationQueue();
  } catch (err) {
    results.errors.push(`Notification queue processing: ${err}`);
  }

  // === Calendar sync — refresh busy slots for every active connection ===
  // Cron fires every 15 min, which is also our calendar freshness target.
  // Errors per connection are stored on the row (last_sync_error) so they
  // surface in the dashboard; we just count outcomes here for the summary.
  let calendarSynced = 0;
  let calendarFailed = 0;
  try {
    const { syncConnection } = await import("@/lib/calendar-sync");
    type Conn = Parameters<typeof syncConnection>[0];
    const conns = await query<Conn>(
      `SELECT id, photographer_id, type, display_name, google_email, google_refresh_token,
              google_access_token, google_access_token_expires_at, selected_calendar_ids,
              ical_url, is_active, last_synced_at, last_sync_error, last_sync_event_count
         FROM calendar_connections WHERE is_active = TRUE`
    );
    for (const c of conns) {
      try {
        const r = await syncConnection(c);
        if (r.ok) calendarSynced++;
        else calendarFailed++;
      } catch (err) {
        calendarFailed++;
        console.error("[cron/reminders] calendar sync error:", err);
      }
    }
    // Cleanup: drop slots whose end is in the past — they can't conflict
    // with any future booking and just bloat the table.
    await query("DELETE FROM calendar_busy_slots WHERE ends_at < NOW() - INTERVAL '1 day'");
  } catch (err) {
    results.errors.push(`Calendar sync: ${err}`);
  }

  console.log("[cron/reminders]", results, { earlyBirdExpired, expiredDeliveriesCleaned, zipsBuilt, checklistDeadlineEmails, checklistDeactivated, deliveryReviewReminders, reviewReminders, smsReviewReminders, unverifiedCleaned, abandonedBookingEmails, noBookingNudges, newClientNotifications, paymentFinalReminders, unansweredReminders6h, unansweredReminders12h, unansweredAdminAlerts, clientFollowUps, queueProcessed, calendarSynced, calendarFailed });

  return NextResponse.json({
    success: true,
    ...results,
    earlyBirdExpired,
    expiredDeliveriesCleaned,
    zipsBuilt,
    checklistDeadlineEmails,
    checklistDeactivated,
    deliveryReviewReminders,
    reviewReminders,
    smsReviewReminders,
    abandonedBookingEmails,
    noBookingNudges,
    newClientNotifications,
    unansweredReminders6h,
    unansweredReminders12h,
    unansweredAdminAlerts,
    clientFollowUps,
    clientFollowUps7d,
    clientFollowUps14dAlerted,
    queueProcessed,
  });
}

// Release advisory lock in finally-like fashion is not needed —
// pg_try_advisory_lock is session-scoped and auto-releases when connection closes
