import { cookies } from "next/headers";
import { query, queryOne } from "@/lib/db";
import { AdminLoginForm } from "./AdminControls";
import { AdminLogoutButton, AdminNotificationEmail, AdminNotificationPhone } from "./AdminControls";
import { AdminPhotographersList } from "./AdminPhotographersList";
import { AdminPhotographerStatsTab } from "./AdminPhotographerStatsTab";
import { AdminClientsList } from "./AdminClientsList";
import { AdminBookingsList } from "./AdminBookingsList";
import { AdminInquiriesList } from "./AdminBookingsTab";
import { LocationsManager } from "./LocationsManager";
import { PromoCodesManager } from "./PromoCodesManager";
import { AdminGiftCardsTab, type AdminGiftCard } from "./AdminGiftCardsTab";
import { AdminMakeAlbumTab, type AdminMakeAlbumOrder } from "./AdminMakeAlbumTab";
import { BlogManager } from "./BlogManager";
import { AdminDashboard } from "./AdminDashboard";
import { DisputesManager } from "./DisputesManager";
import { ReviewsManager } from "./ReviewsManager";
import { AnalyticsDashboard, VisitorsTab } from "./AnalyticsDashboard";
import { AdminMatchRequestsTab } from "./AdminMatchRequestsTab";
import { isBelowMinimum } from "@/lib/package-pricing";
import { verifyToken } from "@/app/api/admin/login/route";
import { bookingStripePaymentSelect } from "@/lib/booking-stripe-payment-fields";
import { bookingGroupSizeEstimateSelect } from "@/lib/booking-group-size-fields";

export const dynamic = "force-dynamic";

async function verifyAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return false;

  const data = verifyToken(token);
  if (!data) return false;

  const user = await queryOne<{ role: string }>(
    "SELECT role FROM users WHERE email = $1",
    [data.email]
  );
  return user?.role === "admin";
}

export default async function AdminPage() {
  const isAdmin = await verifyAdmin();

  if (!isAdmin) {
    return <AdminLoginForm />;
  }

  // Enhanced stats
  const [
    clientCount,
    photographersApproved,
    photographersPending,
    photographersReady,
    bookingsTotal,
    bookingsPending,
    bookingsConfirmed,
    bookingsCompleted,
    bookingsPaid,
    bookingsPaidThisMonth,
    revenue,
    revenueThisMonth,
    reviewCount,
    messageCount,
    blogCount,
    matchRequestsNewCount,
    reviewsPendingCount,
  ] = await Promise.all([
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM users WHERE role = 'client' AND COALESCE(email_verified, FALSE) = TRUE"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM photographer_profiles pp JOIN users u ON u.id = pp.user_id WHERE pp.is_approved = TRUE AND COALESCE(u.email_verified, FALSE) = TRUE"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM photographer_profiles pp JOIN users u ON u.id = pp.user_id WHERE pp.is_approved = FALSE AND COALESCE(pp.is_test, FALSE) = FALSE AND COALESCE(u.email_verified, FALSE) = TRUE AND NOT EXISTS (SELECT 1 FROM users uu WHERE uu.id = pp.user_id AND uu.is_banned = TRUE)"),
    queryOne<{ count: string }>(`SELECT COUNT(*) as count FROM photographer_profiles pp JOIN users u ON u.id = pp.user_id WHERE pp.is_approved = FALSE AND COALESCE(pp.is_test, FALSE) = FALSE AND COALESCE(u.email_verified, FALSE) = TRUE AND COALESCE(u.is_banned, FALSE) = FALSE AND (pp.revision_status IS NULL OR pp.revision_status = 'submitted') AND u.avatar_url IS NOT NULL AND pp.cover_url IS NOT NULL AND pp.bio IS NOT NULL AND LENGTH(pp.bio) > 10 AND (SELECT COUNT(*) FROM portfolio_items WHERE photographer_id = pp.id) >= 15 AND (SELECT COUNT(*) FROM packages WHERE photographer_id = pp.id) >= 1 AND (SELECT COUNT(*) FROM photographer_locations WHERE photographer_id = pp.id) >= 1 AND pp.stripe_account_id IS NOT NULL AND pp.stripe_onboarding_complete = TRUE AND u.phone IS NOT NULL`),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM bookings WHERE status != 'inquiry'"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM bookings WHERE status = 'pending'"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM bookings WHERE status = 'confirmed'"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM bookings WHERE status IN ('completed', 'delivered')"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM bookings WHERE payment_status = 'paid'"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM bookings WHERE payment_status = 'paid' AND created_at >= date_trunc('month', CURRENT_DATE)"),
    queryOne<{ total: string }>("SELECT COALESCE(SUM(total_price), 0) as total FROM bookings WHERE payment_status = 'paid'"),
    queryOne<{ total: string }>("SELECT COALESCE(SUM(total_price), 0) as total FROM bookings WHERE payment_status = 'paid' AND created_at >= date_trunc('month', CURRENT_DATE)"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM reviews"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM messages"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM blog_posts WHERE is_published = TRUE"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM match_requests WHERE status = 'new'").catch(() => null),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM reviews WHERE COALESCE(is_approved, FALSE) = FALSE AND rejected_at IS NULL"),
  ]);

  // Platform settings
  let adminNotificationEmail = "";
  let adminNotificationPhone = "";
  try {
    const [emailSetting, phoneSetting] = await Promise.all([
      queryOne<{ value: string }>("SELECT value FROM platform_settings WHERE key = 'admin_notification_email'"),
      queryOne<{ value: string }>("SELECT value FROM platform_settings WHERE key = 'admin_notification_phone'"),
    ]);
    if (emailSetting?.value) adminNotificationEmail = emailSetting.value;
    if (phoneSetting?.value) adminNotificationPhone = phoneSetting.value;
  } catch (e) {
    console.error("[admin] Failed to load platform settings:", e);
  }

  const clients = await query<{
    id: string; email: string; name: string; created_at: string; avatar_url: string | null; is_banned: boolean;
    phone: string | null; booking_count: number; total_spent: number; last_booking_at: string | null;
    utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; utm_term: string | null;
    google_id: string | null;
    visitor_sessions: string | null;
  }>(`SELECT u.id, u.email, u.name, u.created_at, u.avatar_url, COALESCE(u.is_banned, FALSE) as is_banned,
      u.phone, u.utm_source, u.utm_medium, u.utm_campaign, u.utm_term, u.google_id,
      (SELECT COUNT(*) FROM bookings WHERE client_id = u.id AND status != 'inquiry')::int as booking_count,
      COALESCE((SELECT SUM(total_price) FROM bookings WHERE client_id = u.id AND payment_status = 'paid'), 0)::int as total_spent,
      (SELECT MAX(created_at) FROM bookings WHERE client_id = u.id AND status != 'inquiry')::text as last_booking_at,
      (SELECT json_agg(row_to_json(s) ORDER BY s.started_at DESC)::text
       FROM (SELECT vs.started_at, vs.referrer, vs.utm_source, vs.utm_medium, vs.utm_term,
                    vs.device_type, vs.country, vs.language, vs.screen_width,
                    vs.pageviews, vs.pageview_count
             FROM visitor_sessions vs WHERE vs.user_id = u.id
             ORDER BY vs.started_at DESC LIMIT 5) s
      ) as visitor_sessions
    FROM users u WHERE u.role = 'client' AND COALESCE(u.email_verified, FALSE) = TRUE ORDER BY u.created_at DESC LIMIT 200`);

  const clientBookings = await query<{
    client_id: string; booking_id: string; photographer_name: string; package_name: string | null;
    location_slug: string | null; shoot_date: string | null; total_price: number;
    status: string; payment_status: string; occasion: string | null; created_at: string;
    utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; utm_term: string | null;
  }>(`SELECT b.client_id, b.id as booking_id, pu.name as photographer_name,
      pk.name as package_name, b.location_slug, b.shoot_date, b.total_price,
      b.status, b.payment_status, b.occasion, b.created_at,
      b.utm_source, b.utm_medium, b.utm_campaign, b.utm_term
    FROM bookings b
    JOIN photographer_profiles pp ON pp.id = b.photographer_id
    JOIN users pu ON pu.id = pp.user_id
    LEFT JOIN packages pk ON pk.id = b.package_id
    WHERE b.client_id IN (SELECT id FROM users WHERE role = 'client') AND b.status != 'inquiry'
    ORDER BY b.created_at DESC`);

  // Group bookings by client_id
  const bookingsByClient: Record<string, typeof clientBookings> = {};
  for (const b of clientBookings) {
    if (!bookingsByClient[b.client_id]) bookingsByClient[b.client_id] = [];
    bookingsByClient[b.client_id].push(b);
  }

  const photographers = await query<{
    id: string; user_id: string; display_name: string; slug: string; plan: string; rating: number;
    review_count: number; session_count: number; is_verified: boolean; is_featured: boolean;
    is_approved: boolean; is_banned: boolean; created_at: string; email: string;
    is_founding: boolean; early_bird_tier: string | null; early_bird_expires_at: string | null; registration_number: number | null;
    checklist_complete: boolean;
    days_until_deactivation: number | null;
    has_avatar: boolean; has_cover: boolean; has_bio: boolean; portfolio_count: number;
    package_count: number; location_count: number; locations: string | null; stripe_ready: boolean; has_phone: boolean; phone: string | null;
    revision_status: string | null;
    warning_open_count: number | null;
    warning_critical_open_count: number | null;
  }>(
    `SELECT pp.id, u.id as user_id, u.name as display_name, pp.slug, pp.plan, pp.rating, pp.review_count,
            pp.session_count, pp.is_verified, pp.is_featured, pp.is_approved, COALESCE(u.is_banned, FALSE) as is_banned, pp.created_at, u.email,
            COALESCE(pp.is_founding, FALSE) as is_founding, pp.early_bird_tier, pp.early_bird_expires_at, pp.registration_number,
            (u.avatar_url IS NOT NULL) as has_avatar,
            (pp.cover_url IS NOT NULL) as has_cover,
            (pp.bio IS NOT NULL AND LENGTH(pp.bio) > 10) as has_bio,
            (SELECT COUNT(*) FROM portfolio_items WHERE photographer_id = pp.id)::int as portfolio_count,
            (SELECT COUNT(*) FROM packages WHERE photographer_id = pp.id)::int as package_count,
            (SELECT COUNT(*) FROM photographer_locations WHERE photographer_id = pp.id)::int as location_count,
            (SELECT string_agg(INITCAP(REPLACE(location_slug, '-', ' ')), ', ' ORDER BY location_slug)
               FROM photographer_locations WHERE photographer_id = pp.id) as locations,
            (pp.stripe_account_id IS NOT NULL AND pp.stripe_onboarding_complete = TRUE) as stripe_ready,
            (u.phone IS NOT NULL) as has_phone, u.phone,
            (u.avatar_url IS NOT NULL AND pp.cover_url IS NOT NULL AND pp.bio IS NOT NULL AND LENGTH(pp.bio) > 10
             AND (SELECT COUNT(*) FROM portfolio_items WHERE photographer_id = pp.id) >= 15
             AND (SELECT COUNT(*) FROM packages WHERE photographer_id = pp.id) >= 1
             AND (SELECT COUNT(*) FROM photographer_locations WHERE photographer_id = pp.id) >= 1
             AND pp.stripe_account_id IS NOT NULL AND pp.stripe_onboarding_complete = TRUE
             AND u.phone IS NOT NULL) as checklist_complete,
            pp.revision_status,
            CASE WHEN pp.is_approved = FALSE AND COALESCE(u.is_banned, FALSE) = FALSE
              THEN GREATEST(0, 7 - EXTRACT(DAY FROM NOW() - pp.created_at)::int)
              ELSE NULL END as days_until_deactivation,
            COALESCE(wc.open_count, 0)::int as warning_open_count,
            COALESCE(wc.critical_open_count, 0)::int as warning_critical_open_count
     FROM photographer_profiles pp JOIN users u ON u.id = pp.user_id
     LEFT JOIN v_photographer_warning_counts wc ON wc.photographer_id = pp.id
     WHERE COALESCE(u.email_verified, FALSE) = TRUE
     ORDER BY pp.is_approved DESC, COALESCE(u.is_banned, FALSE) ASC, LOWER(u.name) ASC`
  );

  const stripePaymentSelect = await bookingStripePaymentSelect("b");
  const groupSizeEstimateSelect = await bookingGroupSizeEstimateSelect("b");

  const bookings = await query<{
    id: string; client_name: string; photographer_name: string; status: string;
    client_id: string; photographer_slug: string;
    shoot_date: string | null; total_price: number | null; created_at: string; payment_status: string | null;
    message: string | null; location_slug: string | null; occasion: string | null;
    group_size: number | null; group_size_is_estimate: boolean; shoot_time: string | null; package_name: string | null;
    package_duration: number | null; service_fee: number | null; payout_amount: number | null;
    stripe_amount_subtotal_cents: number | null; stripe_amount_paid_cents: number | null;
    stripe_amount_discount_cents: number | null; stripe_currency: string | null;
    stripe_promo_code: string | null; stripe_coupon_name: string | null; stripe_coupon_percent_off: number | null;
    flexible_date_from: string | null; flexible_date_to: string | null; date_note: string | null;
    delivery_accepted: boolean | null; delivery_accepted_at: string | null; location_detail: string | null;
    client_country: string | null;
    client_phone: string | null; client_email: string | null;
    photographer_phone: string | null; photographer_email: string | null;
    confirmed_at: string | null;
    // Blind-booking fields. blind_booking=TRUE + photographer_name IS NULL =
    // "Quick Booking authorised, waiting for admin assignment".
    blind_booking: boolean | null;
    auto_refund_at: string | null;
    admin_notes: string | null;
    gift_card_id: string | null;
    gift_card_tier: "express" | "full" | null;
    // ── Attribution (admin-only) ──────────────────────────────
    // Best signals for "where did this customer come from + what did
    // they want." Three layers, ranked by reliability:
    //   1. Booking row's own utm_*/gclid — captured at booking submit.
    //   2. Earliest visitor_session for this user — first-touch source.
    //   3. Their latest Lens (concierge) chat — verbatim first question.
    booking_utm_source: string | null; booking_utm_medium: string | null;
    booking_utm_campaign: string | null; booking_utm_term: string | null; booking_gclid: string | null;
    first_utm_source: string | null; first_utm_medium: string | null;
    first_utm_campaign: string | null; first_utm_term: string | null; first_gclid: string | null;
    first_referrer: string | null; first_landing_page: string | null;
    first_session_at: string | null;
    tip_amount_cents: number | null; tip_transferred: boolean | null;
    concierge_first_msg: string | null; concierge_user_msgs: string | null; concierge_match_count: number | null;
    concierge_outcome: string | null; concierge_dialogue: string | null;
    visitor_landing_page: string | null; visitor_referrer: string | null;
    visitor_pageviews: number | null; visitor_device: string | null;
  }>(
    `SELECT b.id, b.client_id, cu.name as client_name, pu.name as photographer_name, pp.slug as photographer_slug,
            b.status, b.shoot_date, b.total_price, b.created_at, b.confirmed_at, b.payment_status,
            b.message, b.location_slug, b.occasion, b.group_size, ${groupSizeEstimateSelect}, b.shoot_time,
            pk.name as package_name, pk.duration_minutes as package_duration, b.service_fee, b.payout_amount,
            ${stripePaymentSelect},
            b.flexible_date_from, b.flexible_date_to, b.date_note,
            b.delivery_accepted, b.delivery_accepted_at, b.location_detail,
            COALESCE(
              (SELECT vs.country FROM visitor_sessions vs WHERE vs.user_id = b.client_id AND vs.country IS NOT NULL ORDER BY vs.started_at DESC LIMIT 1),
              (SELECT vs.country FROM visitor_sessions vs WHERE vs.visitor_id = lens.visitor_id AND vs.country IS NOT NULL ORDER BY vs.started_at DESC LIMIT 1),
              lens.country
            ) as client_country,
            cu.phone as client_phone, cu.email as client_email,
            pu.phone as photographer_phone, pu.email as photographer_email,
            b.blind_booking, b.auto_refund_at::text as auto_refund_at, b.admin_notes,
            b.gift_card_id,
            gc.tier::text as gift_card_tier,
            b.utm_source as booking_utm_source, b.utm_medium as booking_utm_medium,
            b.utm_campaign as booking_utm_campaign, b.utm_term as booking_utm_term, b.gclid as booking_gclid,
            first_sess.utm_source as first_utm_source, first_sess.utm_medium as first_utm_medium,
            first_sess.utm_campaign as first_utm_campaign, first_sess.utm_term as first_utm_term,
            first_sess.gclid as first_gclid, first_sess.referrer as first_referrer,
            first_sess.landing_page as first_landing_page, first_sess.started_at::text as first_session_at,
            (SELECT t.amount_cents FROM tips t WHERE t.booking_id = b.id AND t.status = 'paid' LIMIT 1) as tip_amount_cents,
            (SELECT t.transferred FROM tips t WHERE t.booking_id = b.id AND t.status = 'paid' LIMIT 1) as tip_transferred,
            lens.first_msg as concierge_first_msg,
            lens.user_msgs as concierge_user_msgs,
            lens.full_dialogue as concierge_dialogue,
            lens.match_count as concierge_match_count,
            lens.outcome as concierge_outcome,
            bsess.landing_page as visitor_landing_page,
            bsess.referrer as visitor_referrer,
            bsess.pageview_count as visitor_pageviews,
            bsess.device_type as visitor_device
     FROM bookings b JOIN users cu ON cu.id = b.client_id
     LEFT JOIN photographer_profiles pp ON pp.id = b.photographer_id
     LEFT JOIN users pu ON pu.id = pp.user_id
     LEFT JOIN packages pk ON pk.id = b.package_id
     LEFT JOIN gift_cards gc ON gc.id = b.gift_card_id
     -- Earliest visitor session for this user — first-touch attribution.
     LEFT JOIN LATERAL (
       SELECT vs.utm_source, vs.utm_medium, vs.utm_campaign, vs.utm_term,
              vs.gclid, vs.referrer, vs.landing_page, vs.started_at
       FROM visitor_sessions vs
       WHERE vs.user_id = b.client_id
       ORDER BY vs.started_at ASC
       LIMIT 1
     ) first_sess ON TRUE
     -- Latest Lens (concierge) chat for this user. Prefer the HARD link
     -- (b.concierge_chat_id, stored at blind-accept) over the soft
     -- user_id match — guarantees the admin sees the exact conversation
     -- that produced the booking, not just the most recent one.
     LEFT JOIN LATERAL (
       SELECT
         -- WITH ORDINALITY preserves the array index so we grab the FIRST
         -- user message in conversation order, not alphabetically.
         (SELECT m.value->>'content'
            FROM jsonb_array_elements(cc.messages) WITH ORDINALITY AS m(value, idx)
           WHERE m.value->>'role' = 'user' AND length(m.value->>'content') > 0
           ORDER BY m.idx LIMIT 1) as first_msg,
         -- ALL user turns concatenated — the full "what they asked for" so the
         -- admin can pick the right photographer for a blind booking.
         (SELECT string_agg(m.value->>'content', '  •  ' ORDER BY m.idx)
            FROM jsonb_array_elements(cc.messages) WITH ORDINALITY AS m(value, idx)
           WHERE m.value->>'role' = 'user' AND length(m.value->>'content') > 0) as user_msgs,
         -- FULL dialogue (user + bot, role-tagged) — expandable block on
         -- the booking card so the admin never hunts for what the client
         -- discussed. Turns capped at 600 chars, transcript at 15k.
         LEFT(
           (SELECT string_agg(
                     (CASE WHEN m.value->>'role' = 'user' THEN '👤 ' ELSE '🤖 ' END)
                       || LEFT(m.value->>'content', 600),
                     E'\n\n' ORDER BY m.idx)
              FROM jsonb_array_elements(cc.messages) WITH ORDINALITY AS m(value, idx)
             WHERE m.value->>'role' IN ('user', 'assistant')
               AND length(COALESCE(m.value->>'content', '')) > 0),
           15000) as full_dialogue,
         COALESCE(array_length(cc.matched_photographer_ids, 1), 0) as match_count,
         cc.outcome,
         cc.country,
         cc.visitor_id
       FROM concierge_chats cc
       WHERE cc.id = b.concierge_chat_id
          OR (b.concierge_chat_id IS NULL AND cc.user_id = b.client_id)
       ORDER BY (cc.id = b.concierge_chat_id) DESC, cc.created_at DESC
       LIMIT 1
     ) lens ON TRUE
     -- Anonymous browsing session behind the booking (tracking cookie
     -- "vid", stored at blind-accept). Journey context when there was
     -- no concierge chat (Quick Booking form path).
     LEFT JOIN LATERAL (
       SELECT vs.landing_page, vs.referrer, vs.pageview_count, vs.device_type
       FROM visitor_sessions vs
       WHERE b.visitor_id IS NOT NULL AND vs.visitor_id = b.visitor_id
       ORDER BY vs.started_at DESC
       LIMIT 1
     ) bsess ON TRUE
     WHERE b.status != 'inquiry'
     ORDER BY b.created_at DESC LIMIT 200`
  );

  // Approved photographer roster — drives the assign-photographer
  // dropdown on unmatched (blind) bookings inside AdminBookingsList.
  const adminPhotographerRoster = await query<{
    id: string;
    user_id: string;
    name: string;
    slug: string;
    plan: string;
    last_seen_at: string | null;
    locations: string[];
  }>(
    `SELECT pp.id, pp.user_id, u.name, pp.slug, pp.plan,
            u.last_seen_at::text,
            COALESCE(
              (SELECT array_agg(location_slug ORDER BY location_slug)
                 FROM photographer_locations
                WHERE photographer_id = pp.id),
              ARRAY[]::varchar[]
            ) AS locations
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
      WHERE pp.is_approved = TRUE
        AND COALESCE(u.is_banned, FALSE) = FALSE
        AND COALESCE(pp.is_test, FALSE) = FALSE
      ORDER BY u.last_seen_at DESC NULLS LAST, u.name`
  );

  const inquiries = await query<{
    id: string; client_id: string; client_name: string; client_email: string;
    photographer_name: string; photographer_slug: string;
    created_at: string; first_message: string | null; message_count: number;
    last_message_at: string | null; has_reply: boolean; client_country: string | null;
    converted_to_booking_id: string | null;
    archived: boolean;
  }>(
    `SELECT b.id, b.client_id, cu.name as client_name, cu.email as client_email,
            pu.name as photographer_name, pp.slug as photographer_slug,
            b.created_at,
            (SELECT m.text FROM messages m WHERE m.booking_id = b.id ORDER BY m.created_at ASC LIMIT 1) as first_message,
            (SELECT COUNT(*)::int FROM messages m WHERE m.booking_id = b.id) as message_count,
            (SELECT MAX(m.created_at) FROM messages m WHERE m.booking_id = b.id) as last_message_at,
            EXISTS(SELECT 1 FROM messages m WHERE m.booking_id = b.id AND m.sender_id != b.client_id) as has_reply,
            (SELECT vs.country FROM visitor_sessions vs WHERE vs.user_id = b.client_id AND vs.country IS NOT NULL ORDER BY vs.started_at DESC LIMIT 1) as client_country,
            b.converted_to_booking_id,
            COALESCE(b.archived, FALSE) as archived
     FROM bookings b JOIN users cu ON cu.id = b.client_id
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users pu ON pu.id = pp.user_id
     WHERE b.status = 'inquiry'
     ORDER BY b.created_at DESC LIMIT 100`
  );

  // Match requests
  const matchRequests = await query<{
    id: string; name: string; email: string; phone: string | null;
    location_slug: string; shoot_date: string | null; date_flexible: boolean;
    flexible_date_from: string | null; flexible_date_to: string | null;
    shoot_type: string; group_size: number; budget_range: string;
    message: string | null; status: string; admin_note: string | null;
    created_at: string; matched_at: string | null;
    photographers: { id: string; name: string; slug: string; avatar_url: string | null; rating: number; review_count: number; min_price: number | null; price: number | null }[];
  }>(
    `SELECT mr.*,
      COALESCE(
        (SELECT json_agg(json_build_object(
          'id', pp.id, 'name', u.name, 'slug', pp.slug,
          'avatar_url', u.avatar_url,
          'rating', COALESCE(pp.rating, 0),
          'review_count', COALESCE(pp.review_count, 0),
          'min_price', (SELECT MIN(price) FROM packages WHERE photographer_id = pp.id AND is_public = TRUE),
          'price', mrp.price
        ))
        FROM match_request_photographers mrp
        JOIN photographer_profiles pp ON pp.id = mrp.photographer_id
        JOIN users u ON u.id = pp.user_id
        WHERE mrp.match_request_id = mr.id),
        '[]'::json
      ) as photographers
    FROM match_requests mr
    ORDER BY mr.created_at DESC
    LIMIT 200`
  ).catch(() => []);

  // Disputes count
  const disputeCount = await queryOne<{ count: string }>("SELECT COUNT(*) as count FROM disputes WHERE status IN ('open', 'under_review')").catch(() => null);

  // Reviews for admin moderation
  const allReviews = await query<{
    id: string; rating: number; title: string | null; text: string | null; video_url: string | null; created_at: string;
    client_name: string; photographer_name: string; photographer_slug: string; is_approved: boolean; rejected_at: string | null;
  }>(
    `SELECT r.id, r.rating, r.title, r.text, r.video_url, r.created_at, COALESCE(r.is_approved, true) as is_approved,
            r.rejected_at::text as rejected_at,
            COALESCE(r.client_name_override, u.name, 'Manual review') as client_name,
            pu.name as photographer_name, pp.slug as photographer_slug, pp.id as photographer_id
     FROM reviews r
     LEFT JOIN users u ON u.id = r.client_id
     JOIN photographer_profiles pp ON pp.id = r.photographer_id
     JOIN users pu ON pu.id = pp.user_id
     ORDER BY r.is_approved ASC, r.created_at DESC`
  ).catch(() => []);

  const stats = {
    clients: parseInt(clientCount?.count || "0"),
    photographersApproved: parseInt(photographersApproved?.count || "0"),
    photographersPending: parseInt(photographersPending?.count || "0"),
    photographersReady: parseInt(photographersReady?.count || "0"),
    bookingsTotal: parseInt(bookingsTotal?.count || "0"),
    bookingsPending: parseInt(bookingsPending?.count || "0"),
    bookingsConfirmed: parseInt(bookingsConfirmed?.count || "0"),
    bookingsCompleted: parseInt(bookingsCompleted?.count || "0"),
    bookingsPaid: parseInt(bookingsPaid?.count || "0"),
    bookingsPaidThisMonth: parseInt(bookingsPaidThisMonth?.count || "0"),
    turnover: parseFloat(revenue?.total || "0"),
    turnoverThisMonth: parseFloat(revenueThisMonth?.total || "0"),
    // Revenue = service_fee on every paid booking (locked at payment) +
    // platform_fee on delivered+accepted bookings (released at payout).
    // Same accounting as /api/admin/revenue-chart so the top KPI matches the chart total.
    revenue: parseFloat((await queryOne<{ total: string }>("SELECT COALESCE(SUM(service_fee) + SUM(CASE WHEN delivery_accepted = TRUE THEN platform_fee ELSE 0 END), 0) as total FROM bookings WHERE payment_status = 'paid'").catch(() => null))?.total || "0"),
    revenueThisMonth: parseFloat((await queryOne<{ total: string }>("SELECT COALESCE(SUM(service_fee) + SUM(CASE WHEN delivery_accepted = TRUE THEN platform_fee ELSE 0 END), 0) as total FROM bookings WHERE payment_status = 'paid' AND created_at >= date_trunc('month', CURRENT_DATE)").catch(() => null))?.total || "0"),
    reviews: parseInt(reviewCount?.count || "0"),
    messages: parseInt(messageCount?.count || "0"),
    blogPosts: parseInt(blogCount?.count || "0"),
    disputesOpen: parseInt(disputeCount?.count || "0"),
    inquiriesCount: inquiries.filter(i => !i.has_reply && !i.converted_to_booking_id && !i.archived).length,
    matchRequestsNew: parseInt(matchRequestsNewCount?.count || "0"),
    reviewsPending: parseInt(reviewsPendingCount?.count || "0"),
    // Funnel: unique clients at each stage
    funnelMessages: parseInt((await queryOne<{ count: string }>("SELECT COUNT(DISTINCT sender_id) as count FROM messages WHERE is_system = FALSE").catch(() => null))?.count || "0"),
    funnelBookings: parseInt((await queryOne<{ count: string }>("SELECT COUNT(DISTINCT client_id) as count FROM bookings WHERE status != 'inquiry'").catch(() => null))?.count || "0"),
    funnelPaid: parseInt((await queryOne<{ count: string }>("SELECT COUNT(DISTINCT client_id) as count FROM bookings WHERE payment_status = 'paid'").catch(() => null))?.count || "0"),
    funnelDelivered: parseInt((await queryOne<{ count: string }>("SELECT COUNT(DISTINCT client_id) as count FROM bookings WHERE status IN ('delivered', 'completed')").catch(() => null))?.count || "0"),
    funnelAccepted: parseInt((await queryOne<{ count: string }>("SELECT COUNT(DISTINCT client_id) as count FROM bookings WHERE delivery_accepted = TRUE").catch(() => null))?.count || "0"),
    funnelReviewed: parseInt((await queryOne<{ count: string }>("SELECT COUNT(DISTINCT client_id) as count FROM reviews").catch(() => null))?.count || "0"),
  };

  // Check for below-minimum packages per photographer
  const allPkgs = await query<{ photographer_id: string; duration_minutes: number; price: number; name: string }>(
    "SELECT photographer_id, duration_minutes, price, name FROM packages"
  ).catch(() => []);

  const belowMinByPhotographer: Record<string, { name: string; duration_minutes: number; price: number }[]> = {};
  for (const pkg of allPkgs) {
    if (isBelowMinimum(pkg.duration_minutes, pkg.price)) {
      if (!belowMinByPhotographer[pkg.photographer_id]) belowMinByPhotographer[pkg.photographer_id] = [];
      belowMinByPhotographer[pkg.photographer_id].push({ name: pkg.name, duration_minutes: pkg.duration_minutes, price: pkg.price });
    }
  }

  // Booking aggregates per photographer — drives the leaderboard at the
  // top of the Photographers tab. Counts only photographers who have at
  // least one booking; "paid" = bookings with payment_status='paid'.
  // Bookings from is_test_account=TRUE users are excluded so the founder's
  // QA bookings don't inflate the numbers.
  const photographerBookingStats = await query<{
    photographer_id: string;
    total_bookings: number;
    paid_bookings: number;
    cancelled_bookings: number;
    total_revenue: number;
    total_payout: number;
    last_booking_at: string | null;
    first_booking_at: string | null;
  }>(
    `SELECT b.photographer_id,
            COUNT(*)::int as total_bookings,
            COUNT(*) FILTER (WHERE b.payment_status = 'paid')::int as paid_bookings,
            COUNT(*) FILTER (WHERE b.status = 'cancelled')::int as cancelled_bookings,
            COALESCE(SUM(b.total_price) FILTER (WHERE b.payment_status = 'paid'), 0)::float as total_revenue,
            COALESCE(SUM(b.payout_amount) FILTER (WHERE b.payment_status = 'paid'), 0)::float as total_payout,
            MAX(b.created_at)::text as last_booking_at,
            MIN(b.created_at)::text as first_booking_at
       FROM bookings b
       JOIN users cu ON cu.id = b.client_id
      WHERE COALESCE(cu.is_test_account, FALSE) = FALSE
      GROUP BY b.photographer_id`
  ).catch(() => []);

  const statsByPhotographer: Record<string, typeof photographerBookingStats[number]> = {};
  for (const s of photographerBookingStats) statsByPhotographer[s.photographer_id] = s;

  // Render sections as server components passed to client
  const photographersSection = (
    <AdminPhotographersList
      photographers={photographers}
      previewSecret={process.env.ADMIN_PREVIEW_SECRET || ""}
      belowMinPackages={belowMinByPhotographer}
      bookingStatsByPhotographer={statsByPhotographer}
    />
  );

  const clientsSection = (
    <AdminClientsList clients={clients} bookingsByClient={bookingsByClient} />
  );

  const bookingsSection = (
    <AdminBookingsList bookings={bookings} photographerRoster={adminPhotographerRoster} />
  );

  const inquiriesSection = (
    <AdminInquiriesList inquiries={inquiries} />
  );

  const matchRequestsSection = (
    <AdminMatchRequestsTab requests={matchRequests} />
  );

  // Gift cards — full list with admin actions (re-send, expire, refund).
  const giftCards = await query<AdminGiftCard>(
    `SELECT gc.id, gc.code, gc.tier::text as tier,
            gc.amount::float as amount,
            gc.photographer_payout::float as photographer_payout,
            gc.status,
            gc.buyer_name, gc.buyer_email,
            gc.recipient_name, gc.recipient_email, gc.recipient_phone,
            gc.recipient_user_id,
            gc.personal_message,
            gc.booking_id,
            pu.name as photographer_name,
            gc.created_at::text,
            gc.sent_at::text,
            gc.claimed_at::text,
            gc.redeemed_at::text,
            gc.expires_at::text
       FROM gift_cards gc
       LEFT JOIN bookings b ON b.id = gc.booking_id
       LEFT JOIN photographer_profiles pp ON pp.id = b.photographer_id
       LEFT JOIN users pu ON pu.id = pp.user_id
      ORDER BY gc.created_at DESC LIMIT 500`
  ).catch(() => [] as AdminGiftCard[]);

  const giftCardsSection = <AdminGiftCardsTab cards={giftCards} />;

  // MakeAlbum orders — checkouts proxied through us from makealbum.co.
  // Table may not exist on older deploys; coalesce to [] so the tab is
  // simply empty rather than crashing the dashboard.
  const makealbumOrders = await query<AdminMakeAlbumOrder>(
    `SELECT id,
            makealbum_order_id, makealbum_album_id,
            title, page_count,
            amount_cents, currency,
            customer_email, customer_name,
            webhook_url,
            status,
            stripe_session_id, stripe_payment_intent_id,
            shipping_address,
            webhook_delivered_at::text,
            webhook_attempts, webhook_last_error,
            created_at::text,
            paid_at::text
       FROM makealbum_orders
      ORDER BY created_at DESC
      LIMIT 500`
  ).catch(() => [] as AdminMakeAlbumOrder[]);

  const makealbumSection = <AdminMakeAlbumTab orders={makealbumOrders} />;

  const settingsSection = (
    <div className="space-y-6">
      <div className="max-w-xl rounded-xl border border-warm-200 bg-white p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Admin notification email</label>
        <p className="text-xs text-gray-400 mb-3">Support requests and notifications will be sent here.</p>
        <AdminNotificationEmail initialValue={adminNotificationEmail} />
      </div>
      <div className="max-w-xl rounded-xl border border-warm-200 bg-white p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Admin notification phones</label>
        <p className="text-xs text-gray-400 mb-3">SMS notifications for critical events (new bookings, disputes).</p>
        <AdminNotificationPhone initialValue={adminNotificationPhone} />
      </div>
    </div>
  );

  return (
    <AdminDashboard
      stats={stats}
      logoutButton={<AdminLogoutButton />}
      analyticsSection={<AnalyticsDashboard />}
      photographerStatsSection={<AdminPhotographerStatsTab />}
      photographersSection={photographersSection}
      clientsSection={clientsSection}
      bookingsSection={bookingsSection}
      inquiriesSection={inquiriesSection}
      matchRequestsSection={matchRequestsSection}
      visitorsSection={<VisitorsTab recentOnly />}
      disputesSection={<DisputesManager />}
      reviewsSection={<ReviewsManager initialReviews={allReviews} photographers={photographers.map(p => ({ id: p.id, name: p.display_name }))} />}
      blogSection={<BlogManager />}
      promosSection={<PromoCodesManager />}
      giftCardsSection={giftCardsSection}
      makealbumSection={makealbumSection}
      locationsSection={<LocationsManager />}
      settingsSection={settingsSection}
      warningsPhotographerRoster={adminPhotographerRoster.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        plan: p.plan,
      }))}
    />
  );
}
