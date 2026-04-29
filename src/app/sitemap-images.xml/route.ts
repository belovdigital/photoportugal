import { query } from "@/lib/db";
import { locations } from "@/lib/locations-data";
import { locationImage } from "@/lib/unsplash-images";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

const BASE = "https://photoportugal.com";

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// Resolve image URL for sitemap — strip s3:// prefix and use our /api/img for local uploads.
import { resolveAbsoluteImageUrl } from "@/lib/image-url";

function resolveImageUrl(raw: string): string {
  if (!raw) return "";
  if (raw.startsWith("s3://")) {
    // s3://bucket/key → our public R2 bucket URL
    const parts = raw.slice(5).split("/");
    parts.shift(); // drop bucket name
    return `https://files.photoportugal.com/${parts.join("/")}`;
  }
  return resolveAbsoluteImageUrl(raw, BASE) || "";
}

export async function GET() {
  const urls: string[] = [];

  // 1. Photographer profile pages — each with their top portfolio images (up to 10)
  try {
    const profiles = await query<{
      slug: string;
      name: string;
      tagline: string | null;
      cover_url: string | null;
      avatar_url: string | null;
    }>(
      `SELECT pp.slug, u.name, pp.tagline, pp.cover_url, u.avatar_url
       FROM photographer_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE pp.is_approved = TRUE AND COALESCE(pp.is_test, FALSE) = FALSE`
    );

    const allPortfolio = await query<{ photographer_slug: string; url: string; caption: string | null }>(
      `SELECT pp.slug as photographer_slug, pi.url, pi.caption
       FROM portfolio_items pi
       JOIN photographer_profiles pp ON pp.id = pi.photographer_id
       WHERE pp.is_approved = TRUE AND COALESCE(pp.is_test, FALSE) = FALSE AND pi.type = 'photo'
       ORDER BY pi.sort_order NULLS LAST, pi.created_at ASC`
    );

    for (const p of profiles) {
      const photos = allPortfolio.filter(x => x.photographer_slug === p.slug).slice(0, 10);
      const images: string[] = [];

      if (p.cover_url) {
        images.push(`<image:image>
    <image:loc>${escape(resolveImageUrl(p.cover_url))}</image:loc>
    <image:title>${escape(`${p.name} — ${p.tagline || "Professional photographer in Portugal"}`)}</image:title>
  </image:image>`);
      }

      for (const photo of photos) {
        const url = resolveImageUrl(photo.url);
        if (!url) continue;
        const caption = photo.caption || `Photo by ${p.name} — vacation photography in Portugal`;
        images.push(`<image:image>
    <image:loc>${escape(url)}</image:loc>
    <image:title>${escape(`${p.name} — Photo Portugal`)}</image:title>
    <image:caption>${escape(caption)}</image:caption>
  </image:image>`);
      }

      if (images.length > 0) {
        urls.push(`<url>
  <loc>${BASE}/photographers/${escape(p.slug)}</loc>
  ${images.join("\n  ")}
</url>`);
      }
    }
  } catch (err) {
    console.error("[sitemap-images] photographer error:", err);
  }

  // 2. Location pages — each with their curated cover image from unsplash-images.ts
  for (const loc of locations) {
    const imgUrl = locationImage(loc.slug, "hero");
    if (!imgUrl) continue;
    urls.push(`<url>
  <loc>${BASE}/locations/${escape(loc.slug)}</loc>
  <image:image>
    <image:loc>${escape(imgUrl)}</image:loc>
    <image:title>${escape(`Vacation photography in ${loc.name}, Portugal`)}</image:title>
    <image:caption>${escape(`${loc.name} — ${loc.description || "professional photoshoot location in Portugal"}`)}</image:caption>
  </image:image>
</url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
