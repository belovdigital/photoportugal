import { cookies } from "next/headers";
import { queryOne } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";
import { ZonePrototype } from "./ZonePrototype";

/**
 * Admin-only sandbox for the photographer zone-drawing UX. Lives at
 * /admin/zone-prototype, gated by the existing admin token check
 * (same one /admin uses). The page itself reads no data and writes
 * nothing — it's a sandbox to validate the polygon-draw → resolve-to-
 * cities flow before we wire it into the real photographer onboarding.
 */
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

export const dynamic = "force-dynamic";

export default async function ZonePrototypePage() {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <p className="text-gray-500">Admin only.</p>
      </div>
    );
  }
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.MAPBOX_TOKEN || "";
  return <ZonePrototype mapboxToken={token} />;
}
