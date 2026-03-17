import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryOne, query } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/var/www/photoportugal/uploads";

async function verifyAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return false;
  const data = verifyToken(token);
  if (!data) return false;
  const user = await queryOne<{ role: string }>("SELECT role FROM users WHERE email = $1", [data.email]);
  return user?.role === "admin";
}

// Get all locations
export async function GET() {
  if (!(await verifyAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const locations = await query(
      "SELECT * FROM managed_locations ORDER BY sort_order, name"
    );
    return NextResponse.json(locations);
  } catch (error) {
    console.error("[admin/locations] GET error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// Create location
export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const formData = await req.formData();
    const name = formData.get("name") as string;
    const slug = formData.get("slug") as string;
    const region = formData.get("region") as string;
    const description = formData.get("description") as string;
    const long_description = formData.get("long_description") as string;
    const lat = formData.get("lat") as string;
    const lng = formData.get("lng") as string;
    const seo_title = formData.get("seo_title") as string;
    const seo_description = formData.get("seo_description") as string;
    const file = formData.get("cover_image") as File | null;

    if (!name || !slug || !region) {
      return NextResponse.json({ error: "Name, slug, and region required" }, { status: 400 });
    }

    let coverUrl: string | null = null;
    if (file && file.size > 0) {
      const ext = file.name.split(".").pop() || "jpg";
      const filename = `${crypto.randomUUID()}.${ext}`;
      const dir = path.join(UPLOAD_DIR, "locations");
      await mkdir(dir, { recursive: true });
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(path.join(dir, filename), buffer);
      coverUrl = `/uploads/locations/${filename}`;
    }

    const location = await queryOne(
      `INSERT INTO managed_locations (slug, name, region, description, long_description, cover_image_url, lat, lng, seo_title, seo_description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [slug, name, region, description || null, long_description || null, coverUrl,
       lat ? parseFloat(lat) : null, lng ? parseFloat(lng) : null,
       seo_title || null, seo_description || null]
    );

    return NextResponse.json({ success: true, id: location });
  } catch (error) {
    console.error("[admin/locations] POST error:", error);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}

// Update location
export async function PUT(req: NextRequest) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const formData = await req.formData();
    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const slug = formData.get("slug") as string;
    const region = formData.get("region") as string;
    const description = formData.get("description") as string;
    const long_description = formData.get("long_description") as string;
    const lat = formData.get("lat") as string;
    const lng = formData.get("lng") as string;
    const seo_title = formData.get("seo_title") as string;
    const seo_description = formData.get("seo_description") as string;
    const is_active = formData.get("is_active") as string;
    const file = formData.get("cover_image") as File | null;

    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    let coverUpdate = "";
    const params: unknown[] = [name, slug, region, description || null, long_description || null,
      lat ? parseFloat(lat) : null, lng ? parseFloat(lng) : null,
      seo_title || null, seo_description || null, is_active !== "false"];

    if (file && file.size > 0) {
      const ext = file.name.split(".").pop() || "jpg";
      const filename = `${crypto.randomUUID()}.${ext}`;
      const dir = path.join(UPLOAD_DIR, "locations");
      await mkdir(dir, { recursive: true });
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(path.join(dir, filename), buffer);
      coverUpdate = `, cover_image_url = $12`;
      params.push(`/uploads/locations/${filename}`);
    }

    params.push(id);
    const paramIdx = params.length;

    await queryOne(
      `UPDATE managed_locations SET name = $1, slug = $2, region = $3, description = $4, long_description = $5,
       lat = $6, lng = $7, seo_title = $8, seo_description = $9, is_active = $10${coverUpdate}
       WHERE id = $${paramIdx} RETURNING id`,
      params
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/locations] PUT error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

// Delete location
export async function DELETE(req: NextRequest) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  try {
    await queryOne("DELETE FROM managed_locations WHERE id = $1 RETURNING id", [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/locations] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
