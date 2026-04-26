import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryOne } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";

export const dynamic = "force-dynamic";

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return false;
  const data = verifyToken(token);
  if (!data) return false;
  const user = await queryOne<{ role: string }>("SELECT role FROM users WHERE email = $1", [data.email]);
  return user?.role === "admin";
}

// Clarity's Data Export API only supports numOfDays = 1, 2 or 3.
// We map our global period selector to the closest allowed value.
function resolveNumOfDays(period: string): number {
  switch (period) {
    case "today": return 1;
    case "yesterday": return 2;
    default: return 3;
  }
}

interface ClarityMetric {
  metricName: string;
  information: Array<Record<string, string | number | null>>;
}

export async function GET(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const token = process.env.CLARITY_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "CLARITY_API_TOKEN not configured" }, { status: 500 });
  }

  const url = new URL(req.url);
  const period = url.searchParams.get("period") || "30d";
  const numOfDays = resolveNumOfDays(period);

  try {
    const res = await fetch(
      `https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=${numOfDays}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ error: `Clarity API error ${res.status}`, detail: txt }, { status: 502 });
    }
    const metrics: ClarityMetric[] = await res.json();

    // Convert array-of-metrics into a keyed object for easier consumption on the client
    const byName: Record<string, ClarityMetric["information"]> = {};
    for (const m of metrics) byName[m.metricName] = m.information;

    return NextResponse.json({
      numOfDays,
      period,
      note: "Clarity Data Export API supports only 1/2/3 day windows. Longer periods are approximated to 3 days.",
      metrics: byName,
      // Also return the friendly "clarity dashboard" URL so admin can jump to session recordings there
      dashboardUrl: "https://clarity.microsoft.com/projects/view/" + (process.env.NEXT_PUBLIC_CLARITY_ID || "we7hzvxpom"),
    });
  } catch (err) {
    console.error("[admin/clarity] error:", err);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(err, { path: "/api/admin/clarity", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Failed to fetch Clarity data", detail: (err as Error).message }, { status: 500 });
  }
}
