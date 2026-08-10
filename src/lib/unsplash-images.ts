// Curated Unsplash images for Photo Portugal
// All photos verified — real location-accurate photos
// Base URLs without params — use unsplashUrl() to get optimized version

const baseUrls: Record<string, string> = {
  // Greater Lisbon
  lisbon: "photo-1536663060084-a0d9eeeaf44b", // Lisbon tram
  sintra: "photo-1697394494123-c6c1323a14f7", // Pena Palace
  cascais: "photo-1748792753424-38cbb745508a", // Cascais coast
  caparica: "photo-1667155522672-abab34f534b4", // Costa da Caparica
  comporta: "photo-1636834843464-2133f4226f7c", // Comporta beach aerial
  setubal: "photo-1704658011867-1fef84ee619e", // Arrábida

  // Northern Portugal
  guimaraes: "photo-1697984431654-d234e3ca432b", // Guimarães castle
  porto: "photo-1756765786971-384a44daf35d", // Dom Luís I Bridge
  braga: "photo-1761071300593-901f8d4c6a98", // Bom Jesus
  "douro-valley": "photo-1693825208005-02563f6a95ce", // Douro vineyards
  aveiro: "photo-1758193465576-926a324b400a", // Moliceiro boats
  geres: "photo-1655476967861-7cf1eeb1a79f", // Gerês waterfall

  // Central Portugal
  tomar: "photo-1537025130223-dccf9faeff7f", // Convent of Christ
  peniche: "photo-1745594207432-6ba381dfba2e", // Baleal beach
  coimbra: "photo-1631053744868-8afbc4df3d4e", // Coimbra old town
  obidos: "photo-1557260465-1579873ad508", // Medieval town
  nazare: "photo-1607333618830-dc42123dc28d", // Giant waves

  // Alentejo
  evora: "photo-1651508820682-2d3e37e7183e", // Temple of Diana

  // Southern Portugal
  algarve: "photo-1560242374-7befcc667b39", // Benagil cave
  lagos: "photo-1593897810048-0195fd308ee6", // Ponta da Piedade
  tavira: "photo-1707862992563-ac8e01d606ec", // Tavira bridge

  // Islands
  madeira: "photo-1721241843813-c54b77496005", // São Lourenço coast
  azores: "photo-1542575749037-7ef4545e897d", // Sete Cidades
};

// Fallback aliases — slugs that borrow images from a nearby region until dedicated
// photos are added. Keeps /locations grid visually complete (no card-without-bg).
const aliasMap: Record<string, string> = {
  // ── Spain: temporary stand-ins ──────────────────────────────────────────
  // Photo Spain has no Spanish imagery yet, and `locationImage` returns an
  // empty string for an unmapped slug — so without these every Spanish
  // location card would render with no picture at all. Each Spanish slug is
  // pointed at the Portuguese photo whose *character* is closest (capital to
  // capital, coast to coast, mountain village to mountain village) so the
  // cards read as intended until real photos land.
  //
  // These are placeholders and must be replaced before any paid traffic:
  // the pictures show Portugal, so no caption or alt text anywhere may name a
  // Spanish landmark over them. See docs/SPAIN.md.
  barcelona: "porto",
  madrid: "lisbon",
  seville: "evora",
  granada: "guimaraes",
  malaga: "algarve",
  marbella: "algarve",
  ronda: "guimaraes",
  cordoba: "evora",
  cadiz: "peniche",
  valencia: "porto",
  "san-sebastian": "nazare",
  bilbao: "porto",
  "santiago-de-compostela": "braga",
  mallorca: "madeira",
  ibiza: "algarve",

  // ── Italy: temporary stand-ins, same rule as Spain above ────────────────
  // Every Italian slug borrows the Portuguese photo closest in character, so
  // no location card renders empty. Placeholders — replace before paid
  // traffic, and never caption them as an Italian landmark.
  rome: "lisbon",
  florence: "porto",
  siena: "guimaraes",
  "val-dorcia": "douro-valley",
  pisa: "coimbra",
  lucca: "obidos",
  venice: "aveiro",
  verona: "braga",
  "lake-garda": "geres",
  milan: "porto",
  "lake-como": "geres",
  naples: "lisbon",
  "amalfi-coast": "algarve",
  positano: "nazare",
  sorrento: "cascais",
  capri: "madeira",
  ravello: "sintra",
  taormina: "madeira",
  palermo: "evora",
  syracuse: "tavira",
  "cinque-terre": "azores",
  portofino: "cascais",
  lecce: "evora",
  alberobello: "obidos",
  menorca: "comporta",
  tenerife: "madeira",
  "gran-canaria": "madeira",
  lanzarote: "azores",
  toledo: "obidos",
  segovia: "guimaraes",
  sitges: "cascais",
  girona: "guimaraes",
  "costa-brava": "algarve",

  portimao: "algarve",
  albufeira: "algarve",
  faro: "algarve",
  vilamoura: "algarve",
  arrabida: "setubal",
  sesimbra: "setubal",
  // Ericeira aliases to Peniche (also a surf/coast town nearby) rather
  // than Nazaré (whose giant-waves photo is far too dramatic for
  // Ericeira's chill village vibe).
  ericeira: "peniche",
  // Almada sits across the Tagus from Lisbon — its iconic shot is the
  // bridge + Lisbon skyline, so the Lisbon photo carries the right vibe.
  almada: "lisbon",
  funchal: "madeira",
  "ponta-delgada": "azores",
  // Placeholder until a real Leiria cover is added — reuse Coimbra's
  // central-Portugal hilltop-city-over-a-river photo (Leiria has the same
  // castle-on-a-hill + riverside vibe) so the page hero isn't empty.
  leiria: "coimbra",
};

const HERO_ID = "photo-1765854638659-aa17a6b00543"; // Couple on beach

/**
 * Generate optimized Unsplash URL
 * Unsplash CDN handles: WebP/AVIF auto-negotiation, resizing, quality
 * This avoids Next.js Image Optimization overhead on our small server.
 *
 * Defaults bumped (q 80→85) since the site is on a fast pipeline now —
 * absolute file size stays modest because Unsplash auto-negotiates AVIF/WebP
 * and the dimensions below are still moderate for retina-quality cards.
 */
export function unsplashUrl(
  id: string,
  width: number = 600,
  quality: number = 85
): string {
  return `https://images.unsplash.com/${id}?w=${width}&q=${quality}&auto=format&fit=crop`;
}

// Pre-built sizes — actual pixel sizes served (no dpr multiplier).
// Bumped for crisper images on retina displays now that delivery is fast.
export const IMAGE_SIZES = {
  card: 600, // Location/shoot type cards (was 400 — fine for non-retina)
  cardLarge: 900, // Featured cards (was 600)
  hero: 1600, // Hero section (was 1200)
  profile: 1200, // Profile cover (was 800)
  thumbnail: 400, // Thumbnails (was 250)
} as const;

export function locationImage(slug: string, size: keyof typeof IMAGE_SIZES = "card"): string {
  const id = baseUrls[slug] || baseUrls[aliasMap[slug] || ""];
  if (!id) return "";
  return unsplashUrl(id, IMAGE_SIZES[size]);
}

/**
 * Width ladder for a responsive Unsplash image.
 *
 * One hardcoded width cannot serve both ends: `hero: 1600` sent 626 kB to a
 * 412 px phone (LCP 9.1 s on photospain.co/locations/madrid) while a 2560 px
 * desktop hero was being UPSCALED from 1600 — so the big screen was getting a
 * softer picture than it should, and the phone was paying for pixels it cannot
 * show. A srcset fixes both directions at once: fewer bytes on the phone, more
 * real pixels on a retina monitor.
 *
 * Unsplash resizes on their CDN, so every rung is free for us — no origin CPU
 * and no cold-cache penalty, which is why this is safe where the Cloudflare
 * Image Transformations experiment was not.
 */
const SRCSET_LADDER = [640, 828, 1080, 1440, 1920, 2560];

export function unsplashSrcSet(url: string, quality = 85): string | undefined {
  const match = url.match(/^https:\/\/images\.unsplash\.com\/([^?]+)/);
  if (!match) return undefined;
  return SRCSET_LADDER.map((w) => `${unsplashUrl(match[1], w, quality)} ${w}w`).join(", ");
}

// Compat: old API
export const locationImages: Record<string, string> = Object.fromEntries(
  Object.entries(baseUrls).map(([slug, id]) => [slug, unsplashUrl(id, IMAGE_SIZES.card)])
);

export const heroImage = unsplashUrl(HERO_ID, IMAGE_SIZES.hero);
