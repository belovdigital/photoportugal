import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getLocationDisplayName } from "@/lib/location-hierarchy";
import { MatchRequestsList } from "./MatchRequestsList";

export const dynamic = "force-dynamic";

interface MatchRequestRow {
  id: string;
  location_slug: string;
  shoot_date: string | null;
  date_flexible: boolean;
  flexible_date_from: string | null;
  flexible_date_to: string | null;
  shoot_type: string;
  shoot_time: string | null;
  group_size: number;
  budget_range: string;
  message: string | null;
  admin_note: string | null;
  status: string;
  chosen_photographer_id: string | null;
  created_at: string;
  photographers: {
    id: string;
    name: string;
    slug: string;
    avatar_url: string | null;
    rating: number;
    review_count: number;
    price: number | null;
    bio: string | null;
    last_seen_at: string | null;
  }[];
}

function getLocationName(slug: string): string {
  return getLocationDisplayName(slug);
}

export default async function MatchRequestsPage() {
  const session = await auth();
  if (!session?.user) return redirect("/auth/signin");

  const userId = (session.user as { id?: string }).id;
  if (!userId) return redirect("/auth/signin");

  // Match Requests is a client-side feature (browse photographer suggestions for
  // your own request). Photographers shouldn't see other clients' requests here.
  const userRow = await queryOne<{ role: string }>("SELECT role FROM users WHERE id = $1", [userId]);
  if (userRow?.role === "photographer") return redirect("/dashboard");

  const rows = await query<MatchRequestRow>(
    `SELECT mr.*,
      COALESCE(
        (SELECT json_agg(json_build_object(
          'id', pp.id, 'name', u.name, 'slug', pp.slug,
          'avatar_url', u.avatar_url,
          'rating', COALESCE(pp.rating, 0),
          'review_count', COALESCE(pp.review_count, 0),
          'price', COALESCE(mrp.price, (SELECT MIN(price) FROM packages WHERE photographer_id = pp.id AND is_public = TRUE)),
          'bio', LEFT(pp.bio, 150),
          'last_seen_at', u.last_seen_at
        ))
        FROM match_request_photographers mrp
        JOIN photographer_profiles pp ON pp.id = mrp.photographer_id
        JOIN users u ON u.id = pp.user_id
        WHERE mrp.match_request_id = mr.id
      ), '[]'::json) as photographers
    FROM match_requests mr
    WHERE mr.user_id = $1
    ORDER BY mr.created_at DESC`,
    [userId]
  );

  // Enrich with location names
  const matchRequests = rows.map((r) => ({
    ...r,
    location_name: getLocationName(r.location_slug),
  }));

  const t = await getTranslations("matchRequests");

  return (
    <div className="p-6 sm:p-8">
      <h1 className="font-display text-2xl font-bold text-gray-900">{t("title")}</h1>
      <p className="mt-1 text-gray-500">{t("subtitle")}</p>
      <div className="mt-6">
        <MatchRequestsList matchRequests={matchRequests} />
      </div>
    </div>
  );
}
