import { cookies } from "next/headers";
import { query, queryOne } from "@/lib/db";
import { AdminLoginForm } from "./AdminControls";
import { AdminLogoutButton, AdminNotificationEmail, AdminNotificationPhone } from "./AdminControls";
import { AdminPhotographersList } from "./AdminPhotographersList";
import { AdminClientsList } from "./AdminClientsList";
import { AdminBookingsList } from "./AdminBookingsList";
import { AdminInquiriesList } from "./AdminBookingsTab";
import { LocationsManager } from "./LocationsManager";
import { PromoCodesManager } from "./PromoCodesManager";
import { BlogManager } from "./BlogManager";
import { AdminDashboard } from "./AdminDashboard";
import { DisputesManager } from "./DisputesManager";
import { ReviewsManager } from "./ReviewsManager";
import { AnalyticsDashboard, VisitorsTab } from "./AnalyticsDashboard";
import { AdminMatchRequestsTab } from "./AdminMatchRequestsTab";
import { isBelowMinimum } from "@/lib/package-pricing";
import { AuditLog } from "./AuditLog";
import { verifyToken } from "@/app/api/admin/login/route";

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
    revenue,
    revenueThisMonth,
    reviewCount,
    messageCount,
    blogCount,
    matchRequestsNewCount,
  ] = await Promise.all([
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM users WHERE role = 'client' AND COALESCE(email_verified, FALSE) = TRUE"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM photographer_profiles pp JOIN users u ON u.id = pp.user_id WHERE pp.is_approved = TRUE AND COALESCE(u.email_verified, FALSE) = TRUE"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM photographer_profiles pp JOIN users u ON u.id = pp.user_id WHERE pp.is_approved = FALSE AND COALESCE(pp.is_test, FALSE) = FALSE AND COALESCE(u.email_verified, FALSE) = TRUE AND NOT EXISTS (SELECT 1 FROM users uu WHERE uu.id = pp.user_id AND uu.is_banned = TRUE)"),
    queryOne<{ count: string }>(`SELECT COUNT(*) as count FROM photographer_profiles pp JOIN users u ON u.id = pp.user_id WHERE pp.is_approved = FALSE AND COALESCE(pp.is_test, FALSE) = FALSE AND COALESCE(u.email_verified, FALSE) = TRUE AND COALESCE(u.is_banned, FALSE) = FALSE AND u.avatar_url IS NOT NULL AND pp.cover_url IS NOT NULL AND pp.bio IS NOT NULL AND LENGTH(pp.bio) > 10 AND (SELECT COUNT(*) FROM portfolio_items WHERE photographer_id = pp.id) >= 5 AND (SELECT COUNT(*) FROM packages WHERE photographer_id = pp.id) >= 1 AND (SELECT COUNT(*) FROM photographer_locations WHERE photographer_id = pp.id) >= 1 AND pp.stripe_account_id IS NOT NULL AND pp.stripe_onboarding_complete = TRUE AND u.phone IS NOT NULL`),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM bookings WHERE status != 'inquiry'"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM bookings WHERE status = 'pending'"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM bookings WHERE status = 'confirmed'"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM bookings WHERE status IN ('completed', 'delivered')"),
    queryOne<{ total: string }>("SELECT COALESCE(SUM(total_price), 0) as total FROM bookings WHERE payment_status = 'paid'"),
    queryOne<{ total: string }>("SELECT COALESCE(SUM(total_price), 0) as total FROM bookings WHERE payment_status = 'paid' AND created_at >= date_trunc('month', CURRENT_DATE)"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM reviews"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM messages"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM blog_posts WHERE is_published = TRUE"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM match_requests WHERE status = 'new'").catch(() => null),
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
    package_count: number; location_count: number; stripe_ready: boolean; has_phone: boolean; phone: string | null;
    revision_status: string | null;
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
            (pp.stripe_account_id IS NOT NULL AND pp.stripe_onboarding_complete = TRUE) as stripe_ready,
            (u.phone IS NOT NULL) as has_phone, u.phone,
            (u.avatar_url IS NOT NULL AND pp.cover_url IS NOT NULL AND pp.bio IS NOT NULL AND LENGTH(pp.bio) > 10
             AND (SELECT COUNT(*) FROM portfolio_items WHERE photographer_id = pp.id) >= 5
             AND (SELECT COUNT(*) FROM packages WHERE photographer_id = pp.id) >= 1
             AND (SELECT COUNT(*) FROM photographer_locations WHERE photographer_id = pp.id) >= 1
             AND pp.stripe_account_id IS NOT NULL AND pp.stripe_onboarding_complete = TRUE
             AND u.phone IS NOT NULL) as checklist_complete,
            pp.revision_status,
            CASE WHEN pp.is_approved = FALSE AND COALESCE(u.is_banned, FALSE) = FALSE
              THEN GREATEST(0, 7 - EXTRACT(DAY FROM NOW() - pp.created_at)::int)
              ELSE NULL END as days_until_deactivation
     FROM photographer_profiles pp JOIN users u ON u.id = pp.user_id
     WHERE COALESCE(u.email_verified, FALSE) = TRUE
     ORDER BY pp.is_approved DESC, COALESCE(u.is_banned, FALSE) ASC, pp.created_at DESC`
  );

  const bookings = await query<{
    id: string; client_name: string; photographer_name: string; status: string;
    shoot_date: string | null; total_price: number | null; created_at: string; payment_status: string | null;
    message: string | null; location_slug: string | null; occasion: string | null;
    group_size: number | null; shoot_time: string | null; package_name: string | null;
    package_duration: number | null; service_fee: number | null; payout_amount: number | null;
    flexible_date_from: string | null; flexible_date_to: string | null; date_note: string | null;
    delivery_accepted: boolean | null; location_detail: string | null;
    client_country: string | null;
    client_phone: string | null; client_email: string | null;
    photographer_phone: string | null; photographer_email: string | null;
  }>(
    `SELECT b.id, cu.name as client_name, pu.name as photographer_name,
            b.status, b.shoot_date, b.total_price, b.created_at, b.payment_status,
            b.message, b.location_slug, b.occasion, b.group_size, b.shoot_time,
            pk.name as package_name, pk.duration_minutes as package_duration, b.service_fee, b.payout_amount,
            b.flexible_date_from, b.flexible_date_to, b.date_note,
            b.delivery_accepted, b.location_detail,
            (SELECT vs.country FROM visitor_sessions vs WHERE vs.user_id = b.client_id AND vs.country IS NOT NULL ORDER BY vs.started_at DESC LIMIT 1) as client_country,
            cu.phone as client_phone, cu.email as client_email,
            pu.phone as photographer_phone, pu.email as photographer_email
     FROM bookings b JOIN users cu ON cu.id = b.client_id
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users pu ON pu.id = pp.user_id
     LEFT JOIN packages pk ON pk.id = b.package_id
     WHERE b.status != 'inquiry'
     ORDER BY b.created_at DESC LIMIT 200`
  );

  const inquiries = await query<{
    id: string; client_name: string; client_email: string; photographer_name: string;
    created_at: string; first_message: string | null; message_count: number;
    last_message_at: string | null; has_reply: boolean; client_country: string | null;
    converted_to_booking_id: string | null;
    archived: boolean;
  }>(
    `SELECT b.id, cu.name as client_name, cu.email as client_email, pu.name as photographer_name,
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
    client_name: string; photographer_name: string; photographer_slug: string; is_approved: boolean;
  }>(
    `SELECT r.id, r.rating, r.title, r.text, r.video_url, r.created_at, COALESCE(r.is_approved, true) as is_approved,
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
    turnover: parseFloat(revenue?.total || "0"),
    turnoverThisMonth: parseFloat(revenueThisMonth?.total || "0"),
    revenue: parseFloat((await queryOne<{ total: string }>("SELECT COALESCE(SUM(platform_fee + service_fee), 0) as total FROM bookings WHERE payment_status = 'paid' AND delivery_accepted = TRUE").catch(() => null))?.total || "0"),
    revenueThisMonth: parseFloat((await queryOne<{ total: string }>("SELECT COALESCE(SUM(platform_fee + service_fee), 0) as total FROM bookings WHERE payment_status = 'paid' AND delivery_accepted = TRUE AND created_at >= date_trunc('month', CURRENT_DATE)").catch(() => null))?.total || "0"),
    reviews: parseInt(reviewCount?.count || "0"),
    messages: parseInt(messageCount?.count || "0"),
    blogPosts: parseInt(blogCount?.count || "0"),
    disputesOpen: parseInt(disputeCount?.count || "0"),
    inquiriesCount: inquiries.filter(i => !i.has_reply && !i.converted_to_booking_id && !i.archived).length,
    matchRequestsNew: parseInt(matchRequestsNewCount?.count || "0"),
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

  // Render sections as server components passed to client
  const photographersSection = (
    <AdminPhotographersList
      photographers={photographers}
      previewSecret={process.env.ADMIN_PREVIEW_SECRET || ""}
      belowMinPackages={belowMinByPhotographer}
    />
  );

  const clientsSection = (
    <AdminClientsList clients={clients} bookingsByClient={bookingsByClient} />
  );

  const bookingsSection = (
    <AdminBookingsList bookings={bookings} />
  );

  const inquiriesSection = (
    <AdminInquiriesList inquiries={inquiries} />
  );

  const matchRequestsSection = (
    <AdminMatchRequestsTab requests={matchRequests} />
  );

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
      locationsSection={<LocationsManager />}
      settingsSection={settingsSection}
    />
  );
}
