import { ImageResponse } from "next/og";
import fs from "node:fs";
import path from "node:path";
import { country, byCountry } from "@/lib/country";

export const runtime = "nodejs";

/**
 * Social share card, generated per market.
 *
 * Portugal keeps its designed `/og-image.png` — this route exists because
 * Spain was serving that same file, which says "Photo Portugal" and lists
 * Lisbon, Porto and the Algarve in 200px type. Every share of a Spanish page
 * on WhatsApp, Telegram or Facebook showed a Portuguese ad, including the
 * invitation links we are about to send photographers.
 *
 * The photo is a Portuguese portfolio shot, used as a placeholder until Spanish
 * work exists — same temporary-imagery decision as the rest of the site.
 */

// Placeholder hero shot. Same file the Portuguese homepage collage uses, served
// from the public R2 host so ImageResponse can fetch it at render time.
// Italy serves its copy from its own bucket, so a shared card does not fetch —
// or advertise — another market's infrastructure.
const HERO_PHOTO = byCountry({
  pt: "https://files.photoportugal.com/portfolio/33becad3-d2b3-4641-a62b-147e354e9a40/22f6704a-e0db-48fe-8d2a-8644ca4e6714.jpeg",
  es: "https://files.photoportugal.com/portfolio/33becad3-d2b3-4641-a62b-147e354e9a40/22f6704a-e0db-48fe-8d2a-8644ca4e6714.jpeg",
  it: "https://files.photoitaly.co/hero/4bb6595f-04b8-4989-af65-8cf2e0dadb78.jpg",
});

// Keyed by the pack rather than a lookup with a Portuguese default: Italy
// inherited "Lisbon · Porto · Algarve" on every share until this changed.
const CITIES = byCountry({
  pt: "Lisbon · Porto · Algarve · Sintra · Madeira · 30+ locations.",
  es: "Barcelona · Madrid · Seville · Granada · Mallorca · 24 locations.",
  it: "Rome · Florence · Venice · Amalfi · 24 locations.",
});

/**
 * The brand faces, read from disk for the same reason as the wordmark below.
 *
 * Without them `ImageResponse` falls back to whatever sans-serif the renderer
 * has, so the headline of every shared card was set in a system font while the
 * site's own display face is Playfair Display. Vendored (both are OFL) so the
 * card never depends on Google Fonts being reachable at render time.
 */
function loadFont(file: string): Buffer | null {
  try {
    return fs.readFileSync(path.join(process.cwd(), "public", "fonts", file));
  } catch {
    return null;
  }
}
const playfairBold = loadFont("PlayfairDisplay-Bold.ttf");
const interRegular = loadFont("Inter-Regular.ttf");

/**
 * The real wordmark, inlined as a data URI.
 *
 * This card used to draw its own lockup: the Unicode glyph "⛶" centred in a red
 * circle, with the brand name beside it in whatever sans-serif the renderer
 * picked. It read as a rough imitation of the logo rather than the logo — the
 * corner marks sat off-centre and the type was the wrong face entirely.
 *
 * Read from disk at module load (this route is `runtime = "nodejs"`) rather than
 * fetched, so the card cannot render logo-less if the network hiccups.
 */
const logoDataUri = (() => {
  if (!country.logoPath.endsWith(".png")) return null;
  try {
    const file = path.join(process.cwd(), "public", country.logoPath.replace(/^\//, ""));
    return `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;
  } catch {
    return null;
  }
})();

export async function GET() {
  const cities = CITIES;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          padding: "72px 80px",
          background: "#FAF8F5",
          fontFamily: "Inter",
          position: "relative",
        }}
      >
        {/* Corner brackets — the camera-frame motif from the logo mark. */}
        <div style={{ position: "absolute", top: 40, left: 40, width: 120, height: 120, borderTop: "10px solid #C94536", borderLeft: "10px solid #C94536", display: "flex" }} />
        <div style={{ position: "absolute", bottom: 40, right: 40, width: 120, height: 120, borderBottom: "10px solid #C94536", borderRight: "10px solid #C94536", display: "flex" }} />

        <div style={{ display: "flex", flexDirection: "column", flex: 1, paddingRight: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 36 }}>
          {logoDataUri ? (
            // Wordmark already contains the mark AND the brand name — drawing
            // the name again beside it would duplicate it.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoDataUri} alt={country.brand} height={84} style={{ height: 84 }} />
          ) : (
            <div style={{ display: "flex", fontSize: 46, fontWeight: 700, color: "#C94536" }}>
              {country.brand}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", fontFamily: "Playfair Display", fontSize: 68, fontWeight: 700, color: "#1F1F1F", lineHeight: 1.1 }}>
          <div style={{ display: "flex" }}>Hand-picked photographers</div>
          <div style={{ display: "flex", color: "#C94536" }}>across {country.areaServed}</div>
        </div>

        <div style={{ display: "flex", marginTop: 32, fontSize: 27, color: "#6B6B6B" }}>{cities}</div>
        <div style={{ display: "flex", marginTop: 10, fontSize: 27, color: "#6B6B6B" }}>
          Every photographer personally vetted.
        </div>
        </div>

        <img
          src={HERO_PHOTO}
          width={460}
          height={460}
          style={{ width: 460, height: 460, borderRadius: 230, objectFit: "cover" }}
        />
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        ...(playfairBold ? [{ name: "Playfair Display", data: playfairBold, weight: 700 as const, style: "normal" as const }] : []),
        ...(interRegular ? [{ name: "Inter", data: interRegular, weight: 400 as const, style: "normal" as const }] : []),
      ],
    }
  );
}
