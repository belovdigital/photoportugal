import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { utm_source, utm_medium, utm_campaign, utm_term, landing_page } = await req.json();
    if (!utm_source) return NextResponse.json({ ok: true });

    await queryOne(
      `INSERT INTO ad_visits (utm_source, utm_medium, utm_campaign, utm_term, landing_page, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [utm_source, utm_medium || null, utm_campaign || null, utm_term || null, landing_page || null, req.headers.get("user-agent")?.slice(0, 200) || null]
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
