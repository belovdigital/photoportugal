import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

// Free quota WITHOUT email; quota WITH email; absolute hard cap per session+ip per day.
const FREE_NO_EMAIL = 1;
const FREE_WITH_EMAIL = 3;

interface UsageRow {
  total_count: string;
  has_email_count: string;
  email: string | null;
}

/**
 * Returns how many generations remain for the current session+ip combo,
 * and which email is on file (if any). Used by the client to decide
 * whether to show the email-capture step before the next generation.
 */
export async function GET(req: NextRequest) {
  const sessionId = req.cookies.get("ai_session")?.value || null;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

  if (!sessionId) {
    return NextResponse.json({
      used: 0,
      free_no_email: FREE_NO_EMAIL,
      free_with_email: FREE_WITH_EMAIL,
      remaining: FREE_NO_EMAIL,
      email: null,
      requires_email: false,
      blocked: false,
    });
  }

  const row = await queryOne<UsageRow>(
    `SELECT
       COUNT(*)::text AS total_count,
       COUNT(*) FILTER (WHERE email IS NOT NULL)::text AS has_email_count,
       MAX(email) AS email
     FROM ai_generations
     WHERE (session_id = $1 OR (ip = $2 AND $2 IS NOT NULL))
       AND status = 'success'
       AND created_at > NOW() - INTERVAL '24 hours'`,
    [sessionId, ip]
  );

  const used = Number(row?.total_count || 0);
  const email = row?.email || null;
  const cap = email ? FREE_WITH_EMAIL : FREE_NO_EMAIL;
  const remaining = Math.max(0, cap - used);
  const requires_email = used >= FREE_NO_EMAIL && !email;
  const blocked = used >= FREE_WITH_EMAIL;

  return NextResponse.json({
    used,
    free_no_email: FREE_NO_EMAIL,
    free_with_email: FREE_WITH_EMAIL,
    remaining,
    email,
    requires_email,
    blocked,
  });
}
