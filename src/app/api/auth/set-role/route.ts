import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { applyUserRole } from "@/lib/apply-user-role";

// GET — the onboarding flow (choose-role screen redirects through here so
// the JWT picks the fresh role up from the DB sync on the next request).
// All provisioning lives in lib/apply-user-role.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    const base = process.env.AUTH_URL || "https://photoportugal.com";
    return NextResponse.redirect(`${base}/auth/signin`);
  }

  const role = request.nextUrl.searchParams.get("role");
  let redirectPath = request.nextUrl.searchParams.get("redirect") || "/dashboard";
  const base = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "https://photoportugal.com";

  // Validate redirect path to prevent open redirect attacks
  if (
    !redirectPath.startsWith("/") ||
    redirectPath.startsWith("//") ||
    redirectPath.includes("://") ||
    redirectPath.includes("\\")
  ) {
    redirectPath = "/dashboard";
  }

  try {
    if (role === "photographer" || role === "client") {
      await applyUserRole(session.user.email, role, session.user.name);
    }
  } catch (error) {
    console.error("[set-role] error:", error);
  }

  return NextResponse.redirect(`${base}${redirectPath}`);
}

// POST — self-serve conversion (e.g. an empty client account pressing
// "Become a photographer" on /for-photographers/join). JSON in/out.
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { role?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body.role !== "photographer" && body.role !== "client") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  try {
    const result = await applyUserRole(session.user.email, body.role, session.user.name);
    if (!result.ok) {
      return NextResponse.json({ error: result.reason || "not_allowed" }, { status: 403 });
    }
    return NextResponse.json({ success: true, role: body.role });
  } catch (error) {
    console.error("[set-role POST] error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
