import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryOne, query } from "@/lib/db";
import { verifyToken } from "@/app/api/admin/login/route";
import { revalidatePath } from "next/cache";

async function isAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  return token ? verifyToken(token) : false;
}

export async function POST(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { photographer_id, client_name, rating, title, text, source_locale } = await req.json();

    if (!photographer_id || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "photographer_id and rating (1-5) required" }, { status: 400 });
    }

    const ALLOWED_LOCALES = ["en", "pt", "de", "es", "fr"];
    const sourceLocale = ALLOWED_LOCALES.includes(source_locale) ? source_locale : "en";

    const clientName = (client_name || "").trim() || null;
    const review = await queryOne<{ id: string }>(
      `INSERT INTO reviews (photographer_id, client_id, rating, title, text, is_approved, booking_id, client_name_override, source_locale, translations_dirty)
       VALUES ($1, NULL, $2, $3, $4, true, NULL, $5, $6, TRUE)
       RETURNING id`,
      [photographer_id, rating, title || null, text || null, clientName, sourceLocale]
    );

    // Fire-and-forget translation. Translates source → other 4 locales. If source != en,
    // English translation overwrites canonical text/title and the source is preserved in text_<source>.
    if (review && (title || text)) {
      import("@/lib/translate-content").then(({ translateReview }) =>
        translateReview(review.id, title || null, text || null, sourceLocale),
      ).catch((e) => console.error("[admin/reviews] translate error:", e));
    }

    // Update photographer rating
    await query(
      `UPDATE photographer_profiles SET
        rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE photographer_id = $1 AND is_approved = TRUE), 0),
        review_count = (SELECT COUNT(*) FROM reviews WHERE photographer_id = $1 AND is_approved = TRUE)
       WHERE id = $1`,
      [photographer_id]
    );

    const slugRow = await queryOne<{ slug: string }>("SELECT slug FROM photographer_profiles WHERE id = $1", [photographer_id]);
    if (slugRow) revalidatePath(`/photographers/${slugRow.slug}`);
    revalidatePath("/");

    return NextResponse.json({ success: true, id: review?.id });
  } catch (error) {
    console.error("[admin/reviews] create error:", error);
    try { const { logServerError } = await import("@/lib/error-logger"); await logServerError(error, { path: "/api/admin/reviews", method: req.method, statusCode: 500 }); } catch {}
    return NextResponse.json({ error: "Failed to create review" }, { status: 500 });
  }
}
