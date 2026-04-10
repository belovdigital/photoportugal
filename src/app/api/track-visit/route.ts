import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { utm_source, utm_medium, utm_campaign, utm_term, gclid, landing_page } = await req.json();
    if (!utm_source && !gclid) return NextResponse.json({ ok: true });

    await queryOne(
      `INSERT INTO ad_visits (utm_source, utm_medium, utm_campaign, utm_term, gclid, landing_page, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [utm_source || (gclid ? "google" : null), utm_medium || (gclid ? "cpc" : null), utm_campaign || null, utm_term || null, gclid || null, landing_page || null, req.headers.get("user-agent")?.slice(0, 200) || null]
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
