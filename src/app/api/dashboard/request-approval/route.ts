import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { MIN_PORTFOLIO_PHOTOS } from "@/lib/portfolio-requirements";
import { stageOneCompleteSql } from "@/lib/onboarding-stage";
import { country } from "@/lib/country";

export const dynamic = "force-dynamic";

/**
 * POST /api/dashboard/request-approval
 *
 * Ends stage one. Re-checks the checklist server-side rather than trusting
 * the button: the client decides when to *show* it, never whether it counts.
 *
 * Idempotent — pressing twice does not re-notify the admins, because the
 * UPDATE only matches rows where the stamp is still null.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional in shape but the attestation below is not.
  }

  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || user.role !== "photographer") {
    return NextResponse.json({ error: "Not signed in as a photographer" }, { status: 401 });
  }

  const profile = await queryOne<{
    id: string;
    name: string;
    email: string;
    slug: string;
    locale: string | null;
    is_approved: boolean;
    revision_status: string | null;
    already_requested: boolean;
    checklist_complete: boolean;
  }>(
    `SELECT pp.id, u.name, u.email, pp.slug, u.locale, pp.is_approved, pp.revision_status,
            (pp.approval_requested_at IS NOT NULL) AS already_requested,
            (${stageOneCompleteSql("pp", "u", MIN_PORTFOLIO_PHOTOS)}) AS checklist_complete
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
      WHERE pp.user_id = $1`,
    [user.id]
  );

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (profile.is_approved) {
    return NextResponse.json({ error: "Your profile is already approved" }, { status: 400 });
  }
  if (profile.revision_status === "pending") {
    return NextResponse.json(
      { error: "Please resolve the requested changes first" },
      { status: 400 }
    );
  }
  if (!profile.checklist_complete) {
    return NextResponse.json(
      { error: "Some checklist steps are still incomplete" },
      { status: 400 }
    );
  }
  // The attestation is required, and re-checked here rather than trusted
  // from the UI: it is the record of what the photographer told us about
  // being payable at all.
  if (body.bank_country_confirmed !== true) {
    return NextResponse.json(
      { error: "Please confirm you hold a local bank account in your own name" },
      { status: 400 }
    );
  }

  if (profile.already_requested) {
    return NextResponse.json({ ok: true, already: true });
  }

  const claimed = await queryOne<{ id: string }>(
    `UPDATE photographer_profiles
        SET approval_requested_at = NOW(),
            bank_country_confirmed_at = NOW()
      WHERE id = $1 AND approval_requested_at IS NULL
      RETURNING id`,
    [profile.id]
  );

  // Someone else (a double-click, a second tab) got there first — success
  // for the caller, but do not notify the admins twice.
  if (!claimed) return NextResponse.json({ ok: true, already: true });

  // Notifications are best-effort: the photographer's submission must not
  // fail because Telegram or SMTP is down. Errors are logged, never silent.
  import("@/lib/telegram")
    .then(({ sendTelegram }) =>
      sendTelegram(
        `📋 <b>Заявка на одобрение</b>\n\n` +
          `${profile.name} (${profile.email})\n` +
          `${country.baseUrl}/photographers/${profile.slug}\n\n` +
          `Чеклист закрыт, ждёт проверки. Stripe откроется после одобрения.`,
        "photographers"
      )
    )
    .catch((e) => console.error("[request-approval] telegram failed:", e));

  import("@/lib/email")
    .then(({ sendAdminApprovalRequestNotification }) =>
      sendAdminApprovalRequestNotification(profile.name, profile.email, profile.slug)
    )
    .catch((e) => console.error("[request-approval] admin email failed:", e));

  import("@/lib/email-locale")
    .then(async ({ normalizeLocale }) => {
      const { sendApprovalRequestedToPhotographer } = await import("@/lib/email");
      return sendApprovalRequestedToPhotographer(
        profile.email, profile.name, normalizeLocale(profile.locale)
      );
    })
    .catch((e) => console.error("[request-approval] photographer email failed:", e));

  return NextResponse.json({ ok: true });
}
