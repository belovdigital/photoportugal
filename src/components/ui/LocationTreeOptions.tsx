"use client";

import { Fragment, useMemo } from "react";
import type { ReactNode } from "react";
import {
  LOCATION_TREE,
  expandLocationCoverageToLegacySlugs,
  getCompatibleCoverageNodeSlugs,
  getLocationDisplayName,
  type LocationNode,
} from "@/lib/location-hierarchy";

type SelectionMode = "single" | "multiple";

interface LocationTreeOptionsProps {
  selectedSlugs: string[];
  onSelect: (slug: string) => void;
  mode?: SelectionMode;
  searchQuery?: string;
  availableLegacySlugs?: string[];
  allLabel?: string;
  onClear?: () => void;
  noMatchLabel?: string;
  className?: string;
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function nodeHasAvailableLegacy(node: LocationNode, availableLegacySet: Set<string> | null): boolean {
  if (!availableLegacySet) return true;
  return expandLocationCoverageToLegacySlugs([node.slug]).some((slug) => availableLegacySet.has(slug));
}

function nodeMatchesSearch(node: LocationNode, query: string): boolean {
  if (!query) return true;
  const q = normalize(query);
  return normalize(node.name).includes(q) || (node.children || []).some((child) => nodeMatchesSearch(child, query));
}

function filterTree(nodes: LocationNode[], query: string, availableLegacySet: Set<string> | null): LocationNode[] {
  return nodes
    .filter((node) => nodeHasAvailableLegacy(node, availableLegacySet) && nodeMatchesSearch(node, query))
    .map((node) => ({
      ...node,
      children: filterTree(node.children || [], query, availableLegacySet),
    }));
}

export function locationMatchesSelection(
  legacyLocationSlugs: string[],
  coverageNodeSlugs: string[] | undefined,
  selectedSlugs: string[]
): boolean {
  if (selectedSlugs.length === 0) return true;

  const legacyMatches = new Set(expandLocationCoverageToLegacySlugs(selectedSlugs));
  const compatibleCoverageNodes = new Set(getCompatibleCoverageNodeSlugs(selectedSlugs));
  const selectedSet = new Set(selectedSlugs);

  return (
    legacyLocationSlugs.some((slug) => legacyMatches.has(slug) || selectedSet.has(slug)) ||
    (coverageNodeSlugs || []).some((slug) => compatibleCoverageNodes.has(slug) || selectedSet.has(slug))
  );
}

export function getLocationTreeLabel(slug: string): string {
  return getLocationDisplayName(slug);
}

export function LocationTreeOptions({
  selectedSlugs,
  onSelect,
  mode = "single",
  searchQuery = "",
  availableLegacySlugs,
  allLabel,
  onClear,
  noMatchLabel = "No locations found",
  className = "",
}: LocationTreeOptionsProps) {
  const selectedSet = useMemo(() => new Set(selectedSlugs), [selectedSlugs]);
  const availableLegacySet = useMemo(
    () => availableLegacySlugs ? new Set(availableLegacySlugs) : null,
    [availableLegacySlugs]
  );
  const visibleTree = useMemo(
    () => filterTree(LOCATION_TREE, searchQuery.trim(), availableLegacySet),
    [availableLegacySet, searchQuery]
  );

  function renderNode(node: LocationNode, depth = 0): ReactNode {
    const selected = selectedSet.has(node.slug);
    const isMulti = mode === "multiple";

    return (
      <Fragment key={node.slug}>
        <button
          type="button"
          onClick={() => onSelect(node.slug)}
          className={`flex w-full items-center gap-2 rounded-lg py-2 text-left text-sm transition hover:bg-warm-50 ${
            selected ? "font-semibold text-primary-700" : node.type === "region" ? "font-semibold text-gray-800" : "text-gray-600"
          }`}
          style={{ paddingLeft: `${12 + depth * 16}px`, paddingRight: 12 }}
        >
          <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
            selected ? "border-primary-500 bg-primary-500" : "border-gray-300 bg-white"
          }`}>
            {selected && (
              <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </span>
          <span className="min-w-0 flex-1 truncate">{node.name}</span>
          {node.type !== "city" && node.type !== "spot" && (
            <span className="shrink-0 rounded-full bg-warm-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-gray-400">
              {node.type}
            </span>
          )}
          {!isMulti && selected && (
            <span className="sr-only">selected</span>
          )}
        </button>
        {(node.children || []).map((child) => renderNode(child, depth + 1))}
      </Fragment>
    );
  }

  const hasNodes = visibleTree.length > 0;

  return (
    <div className={className}>
      {allLabel && onClear && (
        <button
          type="button"
          onClick={onClear}
          className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-warm-50 ${
            selectedSlugs.length === 0 ? "font-semibold text-primary-700" : "text-gray-600"
          }`}
        >
          <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
            selectedSlugs.length === 0 ? "border-primary-500 bg-primary-500" : "border-gray-300 bg-white"
          }`}>
            {selectedSlugs.length === 0 && (
              <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </span>
          {allLabel}
        </button>
      )}
      {hasNodes ? visibleTree.map((node) => renderNode(node)) : (
        <p className="px-3 py-2 text-xs text-gray-400">{noMatchLabel}</p>
      )}
    </div>
  );
}
