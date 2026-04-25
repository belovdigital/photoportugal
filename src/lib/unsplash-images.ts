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
// photos are added. Keeps /locations grid visually complete.
const aliasMap: Record<string, string> = {
  portimao: "algarve",
  albufeira: "algarve",
  faro: "algarve",
  vilamoura: "algarve",
  arrabida: "setubal",
  sesimbra: "setubal",
  ericeira: "nazare",
  funchal: "madeira",
  "ponta-delgada": "azores",
};

const HERO_ID = "photo-1765854638659-aa17a6b00543"; // Couple on beach

/**
 * Generate optimized Unsplash URL
 * Unsplash CDN handles: WebP/AVIF auto-negotiation, resizing, quality
 * This avoids Next.js Image Optimization overhead on our small server
 */
export function unsplashUrl(
  id: string,
  width: number = 400,
  quality: number = 80
): string {
  return `https://images.unsplash.com/${id}?w=${width}&q=${quality}&auto=format&fit=crop`;
}

// Pre-built sizes — actual pixel sizes served (no dpr multiplier)
export const IMAGE_SIZES = {
  card: 400, // Location/shoot type cards
  cardLarge: 600, // Featured cards
  hero: 1200, // Hero section
  profile: 800, // Profile cover
  thumbnail: 250, // Thumbnails
} as const;

export function locationImage(slug: string, size: keyof typeof IMAGE_SIZES = "card"): string {
  const id = baseUrls[slug] || baseUrls[aliasMap[slug] || ""];
  if (!id) return "";
  return unsplashUrl(id, IMAGE_SIZES[size]);
}

// Compat: old API
export const locationImages: Record<string, string> = Object.fromEntries(
  Object.entries(baseUrls).map(([slug, id]) => [slug, unsplashUrl(id, IMAGE_SIZES.card)])
);

export const heroImage = unsplashUrl(HERO_ID, IMAGE_SIZES.hero);
