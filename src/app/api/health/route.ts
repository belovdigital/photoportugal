import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

export async function GET() {
  try {
    await queryOne("SELECT 1");
    return NextResponse.json({ status: "ok", db: "connected" });
  } catch {
    return NextResponse.json({ status: "degraded", db: "disconnected" }, { status: 503 });
  }
}
