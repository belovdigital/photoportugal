import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { path, utm_source, session_id } = await req.json();
    if (!path || !utm_source) return NextResponse.json({ ok: true });

    await queryOne(
      `INSERT INTO ad_pageviews (session_id, path, utm_source) VALUES ($1, $2, $3)`,
      [session_id || null, path, utm_source]
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
