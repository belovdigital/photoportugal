import { cookies } from "next/headers";
import { query, queryOne } from "@/lib/db";
import Link from "next/link";
import { AdminLoginForm } from "./AdminControls";
import { AdminToggleClient, AdminPlanSelectClient, AdminLogoutButton, AdminDeletePhotographer, AdminNotificationEmail } from "./AdminControls";
import { LocationsManager } from "./LocationsManager";
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

  // Stats
  const [userCount, photographerCount, bookingCount, reviewCount, messageCount] = await Promise.all([
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM users"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM photographer_profiles"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM bookings"),
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
  } catch {}

  const clients = await query<{
    id: string; email: string; name: string; created_at: string; avatar_url: string | null;
  }>("SELECT id, email, name, created_at, avatar_url FROM users WHERE role = 'client' ORDER BY created_at DESC LIMIT 50");

  const photographers = await query<{
    id: string; display_name: string; slug: string; plan: string; rating: number;
    review_count: number; session_count: number; is_verified: boolean; is_featured: boolean;
    is_approved: boolean; created_at: string; email: string;
  }>(
    `SELECT pp.id, pp.display_name, pp.slug, pp.plan, pp.rating, pp.review_count,
            pp.session_count, pp.is_verified, pp.is_featured, pp.is_approved, pp.created_at, u.email
     FROM photographer_profiles pp JOIN users u ON u.id = pp.user_id
     ORDER BY pp.is_approved ASC, pp.created_at DESC`
  );

  const bookings = await query<{
    id: string; client_name: string; photographer_name: string; status: string;
    shoot_date: string | null; total_price: number | null; created_at: string;
  }>(
    `SELECT b.id, cu.name as client_name, pp.display_name as photographer_name,
            b.status, b.shoot_date, b.total_price, b.created_at
     FROM bookings b JOIN users cu ON cu.id = b.client_id
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     ORDER BY b.created_at DESC LIMIT 20`
  );

  const stats = [
    { label: "Total Users", value: userCount?.count || "0" },
    { label: "Photographers", value: photographerCount?.count || "0" },
    { label: "Bookings", value: bookingCount?.count || "0" },
    { label: "Reviews", value: reviewCount?.count || "0" },
    { label: "Messages", value: messageCount?.count || "0" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-900">Admin Panel</h1>
          <p className="mt-1 text-gray-500">Platform overview and management</p>
        </div>
        <AdminLogoutButton />
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-warm-200 bg-white p-4 text-center">
            <p className="text-2xl font-bold text-primary-600">{stat.value}</p>
            <p className="text-xs text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Settings */}
      <section className="mt-8">
        <h2 className="text-xl font-bold text-gray-900">Platform Settings</h2>
        <div className="mt-4 rounded-xl border border-warm-200 bg-white p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Admin notification email</label>
          <p className="text-xs text-gray-400 mb-3">Support requests from photographers will be sent to this address.</p>
          <AdminNotificationEmail initialValue={adminNotificationEmail} />
        </div>
      </section>

      {/* Photographers */}
      <section className="mt-10">
        <h2 className="text-xl font-bold text-gray-900">Photographers ({photographers.length})</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-warm-200 bg-white">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="border-b border-warm-200 bg-warm-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
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
                  <td className="px-4 py-3 text-gray-500">{p.email}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {p.rating ? `${p.rating}` : "—"}
                    <span className="text-xs text-gray-400 ml-1">({p.review_count})</span>
                  </td>
                  <td className="px-4 py-3"><AdminToggleClient id={p.id} field="is_approved" value={p.is_approved} /></td>
                  <td className="px-4 py-3"><AdminToggleClient id={p.id} field="is_verified" value={p.is_verified} /></td>
                  <td className="px-4 py-3"><AdminToggleClient id={p.id} field="is_featured" value={p.is_featured} /></td>
                  <td className="px-4 py-3"><AdminPlanSelectClient id={p.id} currentPlan={p.plan} /></td>
                  <td className="px-4 py-3"><AdminDeletePhotographer id={p.id} name={p.display_name} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bookings */}
      <section className="mt-10">
        <h2 className="text-xl font-bold text-gray-900">Recent Bookings</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-warm-200 bg-white">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="border-b border-warm-200 bg-warm-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Client</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Photographer</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
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
                      b.status === "completed" ? "bg-blue-100 text-blue-700" :
                      b.status === "cancelled" ? "bg-gray-100 text-gray-500" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>{b.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{b.shoot_date ? new Date(b.shoot_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</td>
                  <td className="px-4 py-3 text-gray-700">{b.total_price ? `€${b.total_price}` : "—"}</td>
                </tr>
              ))}
              {bookings.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No bookings yet</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* Clients */}
      <section className="mt-10 mb-12">
        <h2 className="text-xl font-bold text-gray-900">Clients ({clients.length})</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-warm-200 bg-white">
          <table className="w-full min-w-[500px] text-sm">
            <thead className="border-b border-warm-200 bg-warm-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-100">
              {clients.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-600">{u.name.charAt(0)}</div>
                      )}
                      <span className="font-medium text-gray-900">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                </tr>
              ))}
              {clients.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">No clients yet</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* Locations Management */}
      <LocationsManager />
    </div>
  );
}
