import { cookies } from "next/headers";
import { query, queryOne } from "@/lib/db";
import Link from "next/link";
import { AdminLoginForm } from "./AdminControls";
import { AdminToggleClient, AdminPlanSelectClient, AdminLogoutButton, AdminDeactivatePhotographer, AdminNotificationEmail, AdminBanToggle } from "./AdminControls";
import { Avatar } from "@/components/ui/Avatar";
import { LocationsManager } from "./LocationsManager";
import { PromoCodesManager } from "./PromoCodesManager";
import { BlogManager } from "./BlogManager";
import { AdminDashboard } from "./AdminDashboard";
import { DisputesManager } from "./DisputesManager";
import { ReviewsManager } from "./ReviewsManager";
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
    bookingsTotal,
    bookingsPending,
    bookingsConfirmed,
    bookingsCompleted,
    revenue,
    revenueThisMonth,
    reviewCount,
    messageCount,
  ] = await Promise.all([
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM users WHERE role = 'client'"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM photographer_profiles WHERE is_approved = TRUE"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM photographer_profiles pp WHERE pp.is_approved = FALSE AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = pp.user_id AND u.is_banned = TRUE)"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM bookings"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM bookings WHERE status = 'pending'"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM bookings WHERE status = 'confirmed'"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM bookings WHERE status IN ('completed', 'delivered')"),
    queryOne<{ total: string }>("SELECT COALESCE(SUM(total_price), 0) as total FROM bookings WHERE payment_status = 'paid'"),
    queryOne<{ total: string }>("SELECT COALESCE(SUM(total_price), 0) as total FROM bookings WHERE payment_status = 'paid' AND created_at >= date_trunc('month', CURRENT_DATE)"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM reviews"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM messages"),
  ]);

  // Platform settings
  let adminNotificationEmail = "";
  try {
    const setting = await queryOne<{ value: string }>(
      "SELECT value FROM platform_settings WHERE key = 'admin_notification_email'"
    );
    if (setting?.value) adminNotificationEmail = setting.value;
  } catch (e) {
    console.error("[admin] Failed to load platform settings:", e);
  }

  const clients = await query<{
    id: string; email: string; name: string; created_at: string; avatar_url: string | null; is_banned: boolean;
  }>("SELECT id, email, name, created_at, avatar_url, COALESCE(is_banned, FALSE) as is_banned FROM users WHERE role = 'client' ORDER BY created_at DESC LIMIT 50");

  const photographers = await query<{
    id: string; display_name: string; slug: string; plan: string; rating: number;
    review_count: number; session_count: number; is_verified: boolean; is_featured: boolean;
    is_approved: boolean; created_at: string; email: string;
    is_founding: boolean; early_bird_tier: string | null; early_bird_expires_at: string | null; registration_number: number | null;
  }>(
    `SELECT pp.id, pp.display_name, pp.slug, pp.plan, pp.rating, pp.review_count,
            pp.session_count, pp.is_verified, pp.is_featured, pp.is_approved, pp.created_at, u.email,
            COALESCE(pp.is_founding, FALSE) as is_founding, pp.early_bird_tier, pp.early_bird_expires_at, pp.registration_number
     FROM photographer_profiles pp JOIN users u ON u.id = pp.user_id
     ORDER BY pp.is_approved DESC, COALESCE(u.is_banned, FALSE) ASC, pp.created_at DESC`
  );

  const bookings = await query<{
    id: string; client_name: string; photographer_name: string; status: string;
    shoot_date: string | null; total_price: number | null; created_at: string; payment_status: string | null;
  }>(
    `SELECT b.id, cu.name as client_name, pp.display_name as photographer_name,
            b.status, b.shoot_date, b.total_price, b.created_at, b.payment_status
     FROM bookings b JOIN users cu ON cu.id = b.client_id
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     ORDER BY b.created_at DESC LIMIT 30`
  );

  // Disputes count
  const disputeCount = await queryOne<{ count: string }>("SELECT COUNT(*) as count FROM disputes WHERE status IN ('open', 'under_review')").catch(() => null);

  // Reviews for admin moderation
  const allReviews = await query<{
    id: string; rating: number; title: string | null; text: string | null; created_at: string;
    client_name: string; photographer_name: string; photographer_slug: string;
  }>(
    `SELECT r.id, r.rating, r.title, r.text, r.created_at,
            u.name as client_name, pp.display_name as photographer_name, pp.slug as photographer_slug
     FROM reviews r
     JOIN users u ON u.id = r.client_id
     JOIN photographer_profiles pp ON pp.id = r.photographer_id
     ORDER BY r.created_at DESC`
  ).catch(() => []);

  const stats = {
    clients: parseInt(clientCount?.count || "0"),
    photographersApproved: parseInt(photographersApproved?.count || "0"),
    photographersPending: parseInt(photographersPending?.count || "0"),
    bookingsTotal: parseInt(bookingsTotal?.count || "0"),
    bookingsPending: parseInt(bookingsPending?.count || "0"),
    bookingsConfirmed: parseInt(bookingsConfirmed?.count || "0"),
    bookingsCompleted: parseInt(bookingsCompleted?.count || "0"),
    revenue: parseFloat(revenue?.total || "0"),
    revenueThisMonth: parseFloat(revenueThisMonth?.total || "0"),
    reviews: parseInt(reviewCount?.count || "0"),
    messages: parseInt(messageCount?.count || "0"),
    disputesOpen: parseInt(disputeCount?.count || "0"),
  };

  // Render sections as server components passed to client
  const photographersSection = (
    <div className="overflow-x-auto rounded-xl border border-warm-200 bg-white">
      <table className="w-full min-w-[700px] text-sm">
        <thead className="border-b border-warm-200 bg-warm-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Early Bird</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Rating</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Approved</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Verified</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Featured</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Plan</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-warm-100">
          {photographers.map((p) => (
            <tr key={p.id} className={!p.is_approved ? "bg-red-50/30" : ""}>
              <td className="px-4 py-3">
                <Link href={`/photographers/${p.slug}`} target="_blank" className="font-medium text-gray-900 hover:text-primary-600">{p.display_name}</Link>
                <p className="text-xs text-gray-400">{p.email}</p>
              </td>
              <td className="px-4 py-3">
                {p.registration_number && p.registration_number > 0 ? (
                  <div>
                    <span className="text-xs font-bold text-gray-900">#{p.registration_number}</span>
                    {p.early_bird_tier && (
                      <span className={`ml-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        p.is_founding ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white" :
                        p.early_bird_tier === "early50" ? "bg-primary-100 text-primary-700" :
                        "bg-accent-50 text-accent-700"
                      }`}>
                        {p.is_founding ? "Founding" : p.early_bird_tier === "early50" ? "Early 50" : "First 100"}
                      </span>
                    )}
                    {p.early_bird_expires_at && (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        expires {new Date(p.early_bird_expires_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      </p>
                    )}
                    {p.is_founding && <p className="text-[10px] text-amber-600 mt-0.5">Forever</p>}
                  </div>
                ) : (
                  <span className="text-xs text-gray-300">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-gray-700">
                {p.rating ? `${p.rating}` : "—"}
                <span className="text-xs text-gray-400 ml-1">({p.review_count})</span>
              </td>
              <td className="px-4 py-3"><AdminToggleClient id={p.id} field="is_approved" value={p.is_approved} /></td>
              <td className="px-4 py-3"><AdminToggleClient id={p.id} field="is_verified" value={p.is_verified} /></td>
              <td className="px-4 py-3"><AdminToggleClient id={p.id} field="is_featured" value={p.is_featured} /></td>
              <td className="px-4 py-3"><AdminPlanSelectClient id={p.id} currentPlan={p.plan} /></td>
              <td className="px-4 py-3"><AdminDeactivatePhotographer id={p.id} name={p.display_name} isActive={p.is_approved} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const clientsSection = (
    <div className="overflow-x-auto rounded-xl border border-warm-200 bg-white">
      <table className="w-full min-w-[500px] text-sm">
        <thead className="border-b border-warm-200 bg-warm-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Joined</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-warm-100">
          {clients.map((u) => (
            <tr key={u.id} className={u.is_banned ? "bg-red-50/30" : ""}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Avatar src={u.avatar_url} fallback={u.name} size="xs" />
                  <span className="font-medium text-gray-900">{u.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-gray-500">{u.email}</td>
              <td className="px-4 py-3 text-gray-500">{new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
              <td className="px-4 py-3"><AdminBanToggle id={u.id} value={u.is_banned} /></td>
            </tr>
          ))}
          {clients.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No clients yet</td></tr>}
        </tbody>
      </table>
    </div>
  );

  const bookingsSection = (
    <div className="overflow-x-auto rounded-xl border border-warm-200 bg-white">
      <table className="w-full min-w-[700px] text-sm">
        <thead className="border-b border-warm-200 bg-warm-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Client</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Photographer</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Payment</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Price</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-warm-100">
          {bookings.map((b) => (
            <tr key={b.id}>
              <td className="px-4 py-3 text-gray-900">{b.client_name}</td>
              <td className="px-4 py-3 text-gray-900">{b.photographer_name}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  b.status === "confirmed" ? "bg-green-100 text-green-700" :
                  b.status === "completed" || b.status === "delivered" ? "bg-blue-100 text-blue-700" :
                  b.status === "cancelled" ? "bg-gray-100 text-gray-500" :
                  "bg-yellow-100 text-yellow-700"
                }`}>{b.status}</span>
              </td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  b.payment_status === "paid" ? "bg-green-100 text-green-700" :
                  b.payment_status === "refunded" ? "bg-red-100 text-red-600" :
                  "bg-gray-100 text-gray-500"
                }`}>{b.payment_status || "—"}</span>
              </td>
              <td className="px-4 py-3 text-gray-500">{b.shoot_date ? new Date(b.shoot_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</td>
              <td className="px-4 py-3 text-gray-700 font-medium">{b.total_price ? `\u20ac${b.total_price}` : "—"}</td>
            </tr>
          ))}
          {bookings.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No bookings yet</td></tr>}
        </tbody>
      </table>
    </div>
  );

  const settingsSection = (
    <div className="max-w-xl rounded-xl border border-warm-200 bg-white p-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">Admin notification email</label>
      <p className="text-xs text-gray-400 mb-3">Support requests and notifications will be sent here. Use commas for multiple emails.</p>
      <AdminNotificationEmail initialValue={adminNotificationEmail} />
    </div>
  );

  return (
    <AdminDashboard
      stats={stats}
      logoutButton={<AdminLogoutButton />}
      photographersSection={photographersSection}
      clientsSection={clientsSection}
      bookingsSection={bookingsSection}
      disputesSection={<DisputesManager />}
      reviewsSection={<ReviewsManager initialReviews={allReviews} />}
      blogSection={<BlogManager />}
      promosSection={<PromoCodesManager />}
      locationsSection={<LocationsManager />}
      settingsSection={settingsSection}
    />
  );
}
