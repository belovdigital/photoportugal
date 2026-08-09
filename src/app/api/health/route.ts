import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

// Deploy gate + monitor probe. Returns 200 only when the app can reach ITS
// database through its own pool — a static page serving 200 while the DB is
// gone is exactly how the 2026-08-09 stale-.env.local outage hid for hours.
// `db` echoes current_database() so the monitor can also catch a wrong-DB env.
export async function GET() {
  try {
    const row = await queryOne<{ db: string }>("SELECT current_database() AS db");
    return NextResponse.json({ status: "ok", db: row?.db ?? "unknown" });
  } catch {
    return NextResponse.json({ status: "degraded", db: "disconnected" }, { status: 503 });
  }
}
