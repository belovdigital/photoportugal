import { query } from "@/lib/db";
import { expandLocationCoverageToLegacySlugs, normalizeCoverageNodeSlugs } from "@/lib/location-hierarchy";

function isMissingCoverageTable(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: string }).code === "42P01";
}

export async function getPhotographerCoverageNodeSlugs(
  photographerId: string,
  fallbackLegacySlugs: string[]
): Promise<string[]> {
  try {
    const rows = await query<{ node_slug: string }>(
      "SELECT node_slug FROM photographer_location_coverage WHERE photographer_id = $1 ORDER BY created_at, node_slug",
      [photographerId]
    );
    return rows.length > 0 ? rows.map((row) => row.node_slug) : fallbackLegacySlugs;
  } catch (error) {
    if (isMissingCoverageTable(error)) return fallbackLegacySlugs;
    throw error;
  }
}

export async function savePhotographerCoverageNodeSlugs(
  photographerId: string,
  nodeSlugs: string[]
): Promise<void> {
  const normalized = normalizeCoverageNodeSlugs(nodeSlugs);
  try {
    await query("DELETE FROM photographer_location_coverage WHERE photographer_id = $1", [photographerId]);
    for (const slug of normalized) {
      await query(
        "INSERT INTO photographer_location_coverage (photographer_id, node_slug) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [photographerId, slug]
      );
    }
  } catch (error) {
    if (isMissingCoverageTable(error)) return;
    throw error;
  }
}

export function expandCoverageForLegacyLocations(nodeSlugs: string[]): string[] {
  const normalized = normalizeCoverageNodeSlugs(nodeSlugs);
  return expandLocationCoverageToLegacySlugs(normalized);
}

export async function getCoverageNodeSlugsByPhotographerIds(
  photographerIds: string[]
): Promise<Record<string, string[]>> {
  if (photographerIds.length === 0) return {};
  try {
    const rows = await query<{ photographer_id: string; node_slug: string }>(
      "SELECT photographer_id, node_slug FROM photographer_location_coverage WHERE photographer_id = ANY($1::uuid[]) ORDER BY created_at, node_slug",
      [photographerIds]
    );
    return rows.reduce<Record<string, string[]>>((acc, row) => {
      (acc[row.photographer_id] ||= []).push(row.node_slug);
      return acc;
    }, {});
  } catch (error) {
    if (isMissingCoverageTable(error)) return {};
    throw error;
  }
}
