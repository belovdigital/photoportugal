import { locations } from "@/lib/locations-data";
import { shootTypes } from "@/lib/shoot-types-data";
import type { Location } from "@/types";
import type { ShootType } from "@/lib/shoot-types-data";

export type BlogTopicInput = {
  slug: string;
  title: string;
  targetKeywords?: string | null;
  target_keywords?: string | null;
  excerpt?: string | null;
  content?: string | null;
};

export type BlogTopic = {
  primaryLocation: Location | null;
  locations: Location[];
  primaryShootType: ShootType | null;
  shootTypes: ShootType[];
};

type MatchableLocation = {
  location: Location;
  aliases: string[];
};

type MatchableShootType = {
  shootType: ShootType;
  aliases: string[];
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&amp;/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const normalized = normalizeText(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function containsPhrase(haystack: string, phrase: string): boolean {
  if (!haystack || !phrase) return false;
  return new RegExp(`(^|\\s)${escapeRegExp(phrase)}(\\s|$)`).test(haystack);
}

function countPhrase(haystack: string, phrase: string): number {
  if (!haystack || !phrase) return 0;
  const matches = haystack.match(new RegExp(`(^|\\s)${escapeRegExp(phrase)}(\\s|$)`, "g"));
  return matches?.length || 0;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const LOCATION_ALIASES: MatchableLocation[] = locations.map((location) => ({
  location,
  aliases: unique([
    location.slug,
    location.slug.replace(/-/g, " "),
    location.name,
    location.name_pt,
    location.name_de,
    location.name_es,
    location.name_fr,
  ]),
}));

const SHOOT_TYPE_ALIASES: MatchableShootType[] = shootTypes.map((shootType) => ({
  shootType,
  aliases: unique([
    shootType.slug,
    shootType.slug.replace(/-/g, " "),
    shootType.name,
    shootType.name_pt,
    shootType.name_de,
    shootType.name_es,
    shootType.name_fr,
    ...(shootType.photographerShootTypeNames || []),
  ]),
}));

function scoreAliases(aliases: string[], fields: { slug: string; title: string; keywords: string; excerpt: string; content: string }) {
  let score = 0;
  let slugHit = false;
  let strongHit = false;
  let contentHits = 0;

  for (const alias of aliases) {
    if (containsPhrase(fields.slug, alias)) {
      score += 100;
      slugHit = true;
      strongHit = true;
    }
    if (containsPhrase(fields.title, alias)) {
      score += 70;
      strongHit = true;
    }
    if (containsPhrase(fields.keywords, alias)) {
      score += 55;
      strongHit = true;
    }
    if (containsPhrase(fields.excerpt, alias)) {
      score += 20;
    }
    const hits = countPhrase(fields.content, alias);
    if (hits > 0) {
      contentHits += hits;
      score += Math.min(hits, 8);
    }
  }

  return { score, slugHit, strongHit, contentHits };
}

function rankLocations(input: BlogTopicInput): Location[] {
  const targetKeywords = input.targetKeywords ?? input.target_keywords ?? "";
  const fields = {
    slug: normalizeText(input.slug.replace(/-/g, " ")),
    title: normalizeText(input.title),
    keywords: normalizeText(targetKeywords),
    excerpt: normalizeText(input.excerpt || ""),
    content: normalizeText(input.content || ""),
  };

  return LOCATION_ALIASES
    .map(({ location, aliases }, order) => ({
      location,
      order,
      ...scoreAliases(aliases, fields),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.slugHit !== a.slugHit) return Number(b.slugHit) - Number(a.slugHit);
      if (b.strongHit !== a.strongHit) return Number(b.strongHit) - Number(a.strongHit);
      return b.score - a.score || b.contentHits - a.contentHits || a.order - b.order;
    })
    .map((item) => item.location);
}

function rankShootTypes(input: BlogTopicInput): ShootType[] {
  const targetKeywords = input.targetKeywords ?? input.target_keywords ?? "";
  // Shoot-type words like "couples" and "family" often appear as generic
  // examples inside broad location guides, so keep the detector anchored to
  // slug/title/keywords/excerpt and ignore body frequency for ranking.
  const fields = {
    slug: normalizeText(input.slug.replace(/-/g, " ")),
    title: normalizeText(input.title),
    keywords: normalizeText(targetKeywords),
    excerpt: normalizeText(input.excerpt || ""),
    content: "",
  };

  return SHOOT_TYPE_ALIASES
    .map(({ shootType, aliases }, order) => ({
      shootType,
      order,
      ...scoreAliases(aliases, fields),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.slugHit !== a.slugHit) return Number(b.slugHit) - Number(a.slugHit);
      if (b.strongHit !== a.strongHit) return Number(b.strongHit) - Number(a.strongHit);
      return b.score - a.score || a.order - b.order;
    })
    .map((item) => item.shootType);
}

export function deriveBlogTopic(input: BlogTopicInput): BlogTopic {
  const rankedLocations = rankLocations(input);
  const rankedShootTypes = rankShootTypes(input);

  return {
    primaryLocation: rankedLocations[0] || null,
    locations: rankedLocations.slice(0, 4),
    primaryShootType: rankedShootTypes[0] || null,
    shootTypes: rankedShootTypes.slice(0, 3),
  };
}
