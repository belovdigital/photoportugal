import { cookies } from "next/headers";
import { query, queryOne } from "@/lib/db";
import { AdminLoginForm } from "./AdminControls";
import { AdminLogoutButton, AdminNotificationEmail, AdminNotificationPhone } from "./AdminControls";
import { AdminPhotographersList } from "./AdminPhotographersList";
import { AdminClientsList } from "./AdminClientsList";
import { AdminBookingsList } from "./AdminBookingsList";
import { LocationsManager } from "./LocationsManager";
import { PromoCodesManager } from "./PromoCodesManager";
import { BlogManager } from "./BlogManager";
import { AdminDashboard } from "./AdminDashboard";
import { DisputesManager } from "./DisputesManager";
import { ReviewsManager } from "./ReviewsManager";
import { AnalyticsDashboard } from "./AnalyticsDashboard";
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
  ] = await Promise.all([
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM users WHERE role = 'client'"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM photographer_profiles WHERE is_approved = TRUE"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM photographer_profiles pp WHERE pp.is_approved = FALSE AND COALESCE(pp.is_test, FALSE) = FALSE AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = pp.user_id AND u.is_banned = TRUE)"),
    queryOne<{ count: string }>(`SELECT COUNT(*) as count FROM photographer_profiles pp JOIN users u ON u.id = pp.user_id WHERE pp.is_approved = FALSE AND COALESCE(pp.is_test, FALSE) = FALSE AND COALESCE(u.is_banned, FALSE) = FALSE AND u.avatar_url IS NOT NULL AND pp.cover_url IS NOT NULL AND pp.bio IS NOT NULL AND LENGTH(pp.bio) > 10 AND (SELECT COUNT(*) FROM portfolio_items WHERE photographer_id = pp.id) >= 5 AND (SELECT COUNT(*) FROM packages WHERE photographer_id = pp.id) >= 1 AND (SELECT COUNT(*) FROM photographer_locations WHERE photographer_id = pp.id) >= 1 AND pp.stripe_account_id IS NOT NULL AND pp.stripe_onboarding_complete = TRUE AND u.phone IS NOT NULL`),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM bookings"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM bookings WHERE status = 'pending'"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM bookings WHERE status = 'confirmed'"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM bookings WHERE status IN ('completed', 'delivered')"),
    queryOne<{ total: string }>("SELECT COALESCE(SUM(total_price), 0) as total FROM bookings WHERE payment_status = 'paid'"),
    queryOne<{ total: string }>("SELECT COALESCE(SUM(total_price), 0) as total FROM bookings WHERE payment_status = 'paid' AND created_at >= date_trunc('month', CURRENT_DATE)"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM reviews"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM messages"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM blog_posts WHERE is_published = TRUE"),
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
      (SELECT COUNT(*) FROM bookings WHERE client_id = u.id)::int as booking_count,
      COALESCE((SELECT SUM(total_price) FROM bookings WHERE client_id = u.id AND payment_status = 'paid'), 0)::int as total_spent,
      (SELECT MAX(created_at) FROM bookings WHERE client_id = u.id)::text as last_booking_at,
      (SELECT json_agg(row_to_json(s) ORDER BY s.started_at DESC)::text
       FROM (SELECT vs.started_at, vs.referrer, vs.utm_source, vs.utm_medium, vs.utm_term,
                    vs.device_type, vs.country, vs.language, vs.screen_width,
                    vs.pageviews, vs.pageview_count
             FROM visitor_sessions vs WHERE vs.user_id = u.id
             ORDER BY vs.started_at DESC LIMIT 5) s
      ) as visitor_sessions
    FROM users u WHERE u.role = 'client' ORDER BY u.created_at DESC LIMIT 200`);

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
    WHERE b.client_id IN (SELECT id FROM users WHERE role = 'client')
    ORDER BY b.created_at DESC`);

  // Group bookings by client_id
  const bookingsByClient: Record<string, typeof clientBookings> = {};
  for (const b of clientBookings) {
    if (!bookingsByClient[b.client_id]) bookingsByClient[b.client_id] = [];
    bookingsByClient[b.client_id].push(b);
  }

  const photographers = await query<{
    id: string; display_name: string; slug: string; plan: string; rating: number;
    review_count: number; session_count: number; is_verified: boolean; is_featured: boolean;
    is_approved: boolean; is_banned: boolean; created_at: string; email: string;
    is_founding: boolean; early_bird_tier: string | null; early_bird_expires_at: string | null; registration_number: number | null;
    checklist_complete: boolean;
    days_until_deactivation: number | null;
    has_avatar: boolean; has_cover: boolean; has_bio: boolean; portfolio_count: number;
    package_count: number; location_count: number; stripe_ready: boolean; has_phone: boolean; phone: string | null;
  }>(
    `SELECT pp.id, u.name as display_name, pp.slug, pp.plan, pp.rating, pp.review_count,
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
            CASE WHEN pp.is_approved = FALSE AND COALESCE(u.is_banned, FALSE) = FALSE
              THEN GREATEST(0, 7 - EXTRACT(DAY FROM NOW() - pp.created_at)::int)
              ELSE NULL END as days_until_deactivation
     FROM photographer_profiles pp JOIN users u ON u.id = pp.user_id
     ORDER BY pp.is_approved DESC, COALESCE(u.is_banned, FALSE) ASC, pp.created_at DESC`
  );

  const bookings = await query<{
    id: string; client_name: string; photographer_name: string; status: string;
    shoot_date: string | null; total_price: number | null; created_at: string; payment_status: string | null;
    message: string | null; location_slug: string | null; occasion: string | null;
    group_size: number | null; shoot_time: string | null; package_name: string | null;
    package_duration: number | null; service_fee: number | null; payout_amount: number | null;
    flexible_date_from: string | null; flexible_date_to: string | null; date_note: string | null;
    delivery_accepted: boolean | null;
  }>(
    `SELECT b.id, cu.name as client_name, pu.name as photographer_name,
            b.status, b.shoot_date, b.total_price, b.created_at, b.payment_status,
            b.message, b.location_slug, b.occasion, b.group_size, b.shoot_time,
            pk.name as package_name, pk.duration_minutes as package_duration, b.service_fee, b.payout_amount,
            b.flexible_date_from, b.flexible_date_to, b.date_note,
            b.delivery_accepted
     FROM bookings b JOIN users cu ON cu.id = b.client_id
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users pu ON pu.id = pp.user_id
     LEFT JOIN packages pk ON pk.id = b.package_id
     ORDER BY b.created_at DESC LIMIT 200`
  );

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
    revenue: parseFloat(revenue?.total || "0"),
    revenueThisMonth: parseFloat(revenueThisMonth?.total || "0"),
    reviews: parseInt(reviewCount?.count || "0"),
    messages: parseInt(messageCount?.count || "0"),
    blogPosts: parseInt(blogCount?.count || "0"),
    disputesOpen: parseInt(disputeCount?.count || "0"),
    // Funnel data from DB
    funnelMessages: parseInt(messageCount?.count || "0"),
    funnelBookings: parseInt(bookingsTotal?.count || "0"),
    funnelPaid: parseInt((await queryOne<{ count: string }>("SELECT COUNT(*) as count FROM bookings WHERE payment_status = 'paid'").catch(() => null))?.count || "0"),
    funnelDelivered: parseInt((await queryOne<{ count: string }>("SELECT COUNT(*) as count FROM bookings WHERE status IN ('delivered', 'completed')").catch(() => null))?.count || "0"),
    funnelAccepted: parseInt((await queryOne<{ count: string }>("SELECT COUNT(*) as count FROM bookings WHERE delivery_accepted = TRUE").catch(() => null))?.count || "0"),
    funnelReviewed: parseInt(reviewCount?.count || "0"),
  };

  // Render sections as server components passed to client
  const photographersSection = (
    <AdminPhotographersList
      photographers={photographers}
      previewSecret={process.env.ADMIN_PREVIEW_SECRET || ""}
    />
  );

  const clientsSection = (
    <AdminClientsList clients={clients} bookingsByClient={bookingsByClient} />
  );

  const bookingsSection = (
    <AdminBookingsList bookings={bookings} />
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
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-3">Audit Log</h3>
        <AuditLog />
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
      disputesSection={<DisputesManager />}
      reviewsSection={<ReviewsManager initialReviews={allReviews} photographers={photographers.map(p => ({ id: p.id, name: p.display_name }))} />}
      blogSection={<BlogManager />}
      promosSection={<PromoCodesManager />}
      locationsSection={<LocationsManager />}
      settingsSection={settingsSection}
    />
  );
}
