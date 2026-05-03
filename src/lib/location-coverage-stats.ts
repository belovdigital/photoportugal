import { flattenLocationNodes, LOCATION_TREE } from "@/lib/location-hierarchy";

const allCoverageNodes = flattenLocationNodes();
const topRegionSlugs = new Set(LOCATION_TREE.map((node) => node.slug));
const placeNodes = allCoverageNodes.filter((node) => !topRegionSlugs.has(node.slug));

function roundedDownPlus(count: number) {
  return Math.max(1, Math.floor(count / 10) * 10);
}

export const portugalCoverageStats = {
  regions: LOCATION_TREE.length,
  places: placeNodes.length,
  displayPlaces: roundedDownPlus(placeNodes.length),
  displayPlacesLabel: `${roundedDownPlus(placeNodes.length)}+`,
};
