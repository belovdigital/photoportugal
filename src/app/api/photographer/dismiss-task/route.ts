import { NextRequest, NextResponse } from "next/server";
import { authFromRequest } from "@/lib/mobile-auth";
import { query, queryOne } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/photographer/dismiss-task
// Body: { task_key: string, state_snapshot?: string }
//
// Records that the authenticated photographer no longer wants this
// specific Action-Needed task on the dashboard. `state_snapshot` is
// the underlying state value at dismiss time (e.g. the last_message_at
// for a "respond" task). If new activity later changes that value
// the task surfaces again — so dismissing today's "respond to X" still
// re-triggers if X writes another message tomorrow.
export async function POST(req: NextRequest) {
  const user = await authFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { task_key, state_snapshot } = await req.json().catch(() => ({}));
  if (typeof task_key !== "string" || task_key.length === 0 || task_key.length > 100) {
    return NextResponse.json({ error: "task_key required" }, { status: 400 });
  }
  const snapshot = typeof state_snapshot === "string" ? state_snapshot.slice(0, 100) : null;

  // Resolve the photographer profile for the current user. Tasks are
  // scoped per profile so only the owner of the dashboard can dismiss.
  const profile = await queryOne<{ id: string }>(
    "SELECT id FROM photographer_profiles WHERE user_id = $1",
    [user.id]
  );
  if (!profile) return NextResponse.json({ error: "Not a photographer" }, { status: 403 });

  await query(
    `INSERT INTO dismissed_photographer_tasks (photographer_id, task_key, state_snapshot)
     VALUES ($1, $2, $3)
     ON CONFLICT (photographer_id, task_key) DO UPDATE
        SET state_snapshot = EXCLUDED.state_snapshot,
            dismissed_at   = NOW()`,
    [profile.id, task_key, snapshot]
  );

  return NextResponse.json({ ok: true });
}
