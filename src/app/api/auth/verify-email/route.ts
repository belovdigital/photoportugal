import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { sendWelcomeEmail, sendAdminNewPhotographerNotification, sendAdminNewClientNotification } from "@/lib/email";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const base = process.env.AUTH_URL || "https://photoportugal.com";

  if (!token) {
    return NextResponse.redirect(`${base}/auth/signin?error=invalid-token`);
  }

  try {
    const user = await queryOne<{ id: string; email: string; name: string; role: string; email_verified: boolean }>(
      `SELECT id, email, name, role, COALESCE(email_verified, FALSE) as email_verified
       FROM users
       WHERE email_verification_token = $1
         AND email_verification_expires > NOW()`,
      [token]
    );

    if (!user) {
      return NextResponse.redirect(`${base}/auth/signin?error=expired-token`);
    }

    if (user.email_verified) {
      return NextResponse.redirect(`${base}/auth/signin?verified=already`);
    }

    await queryOne(
      `UPDATE users
       SET email_verified = TRUE,
           email_verification_token = NULL,
           email_verification_expires = NULL
       WHERE id = $1 RETURNING id`,
      [user.id]
    );

    // Send welcome email + admin notification for email sign ups
    // (Google sign ups are handled in set-role endpoint)
    if (!user.email_verified) {
      sendWelcomeEmail(user.email, user.name, user.role as "client" | "photographer").catch((err) =>
        console.error("[verify-email] Failed to send welcome email:", err)
      );
      if (user.role === "photographer") {
        sendAdminNewPhotographerNotification(user.name, user.email).catch((err) =>
          console.error("[verify-email] Failed to send admin notification:", err)
        );
        import("@/lib/telegram").then(({ sendTelegram }) => {
          sendTelegram(`👤 <b>New Photographer!</b>\n\n<b>Name:</b> ${user.name}\n<b>Email:</b> ${user.email}\n\n<a href="https://photoportugal.com/admin">Open Admin Panel →</a>`);
        }).catch((err) => console.error("[verify-email] telegram error:", err));
      } else {
        sendAdminNewClientNotification(user.name, user.email).catch((err) =>
          console.error("[verify-email] Failed to send admin notification:", err)
        );
        import("@/lib/telegram").then(({ sendTelegram }) => {
          sendTelegram(`👤 <b>New Client!</b>\n\n<b>Name:</b> ${user.name}\n<b>Email:</b> ${user.email}`);
        }).catch((err) => console.error("[verify-email] telegram error:", err));
      }
      query("UPDATE users SET admin_notified = TRUE WHERE id = $1", [user.id]).catch(() => {});
    }

    // If from mobile app, redirect to deep link
    const source = req.nextUrl.searchParams.get("source");
    if (source === "mobile") {
      return NextResponse.redirect("photoportugal://email-verified");
    }

    return NextResponse.redirect(`${base}/auth/signin?verified=true`);
  } catch (error) {
    console.error("[verify-email] error:", error);
    return NextResponse.redirect(`${base}/auth/signin?error=verification-failed`);
  }
}
