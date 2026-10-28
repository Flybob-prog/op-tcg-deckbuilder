"use client";

import { useMemo, useState } from "react";
import {
  filterCards,
  getPrintTags,
  KNOWN_COLORS,
  KNOWN_PRINT_TAGS,
  KNOWN_RARITIES,
} from "@/lib/optcg";
import { blockOptions as getBlockOptions, blockSortValue, powerValue } from "@/lib/blocks";

export const EMPTY_FILTERS = {
  name: "",
  color: "",
  cost: "",
  type: "",
  trait: "",
  printTag: "",
  rarity: "",
  block: "",
  sort: "",
};

// "Sort by" choices. "" keeps the page's own order (newest set first).
export const SORT_OPTIONS = [
  { value: "", label: "Newest set" },
  { value: "block-desc", label: "Block (newest first)" },
  { value: "block-asc", label: "Block (oldest first)" },
  { value: "power-desc", label: "Power (high to low)" },
  { value: "power-asc", label: "Power (low to high)" },
];

// Cards without a value (no block known, or no power, e.g. Events) always
// go last, whichever direction is chosen. Array.prototype.sort is stable,
// so ties keep the page's newest-set-first order.
export function sortCardList(cards, sort) {
  if (!sort) return cards;
  const [field, dir] = sort.split("-");
  const value =
    field === "block"
      ? (c) => (blockSortValue(c) === Infinity ? null : blockSortValue(c))
      : powerValue;
  const sign = dir === "asc" ? 1 : -1;
  return [...cards].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return (va - vb) * sign;
  });
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

/**
 * Filter state + the filtered list + every dropdown's options, derived
 * from `allCards`. Pulled out of app/page.js so the deck builder page
 * can reuse the exact same search/filter behavior instead of
 * duplicating it.
 */
export function useCardFilters(allCards) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  // Filtering happens client-side against the already-loaded dataset —
  // see the note in lib/optcg.js about why we don't hit a "filtered"
  // endpoint per keystroke.
  const filteredCards = useMemo(
    () => sortCardList(filterCards(allCards, filters), filters.sort),
    [allCards, filters]
  );

  const blockOptions = useMemo(() => getBlockOptions(allCards), [allCards]);

  const colorOptions = useMemo(() => {
    const found = new Set(
      allCards.flatMap((c) => c.card_color?.split(/\s+/) ?? [])
    );
    // Only offer colors that are actually real OPTCG colors — the API's
    // scraped data has a few malformed card_color values, and we don't
    // want stray tokens from those showing up as filter options.
    return KNOWN_COLORS.filter((color) => found.has(color));
  }, [allCards]);

  const typeOptions = useMemo(
    () => uniqueSorted(allCards.map((c) => c.card_type)),
    [allCards]
  );

  const costOptions = useMemo(() => {
    // Only keep values that are actually numbers — the API's scraped
    // data has a few malformed card_cost values (e.g. a sub-type name
    // ending up in this field instead), which we don't want showing up
    // as a selectable "cost" in the dropdown.
    const numericCosts = uniqueSorted(allCards.map((c) => c.card_cost)).filter(
      (cost) => /^\d+$/.test(cost)
    );
    return numericCosts.sort((a, b) => Number(a) - Number(b));
  }, [allCards]);

  const printTagOptions = useMemo(() => {
    const found = new Set(allCards.flatMap((c) => getPrintTags(c)));
    const hasBasePrint = allCards.some((c) => getPrintTags(c).length === 0);
    return [
      ...(hasBasePrint ? ["Base"] : []),
      ...KNOWN_PRINT_TAGS.filter((tag) => found.has(tag)),
    ];
  }, [allCards]);

  const rarityOptions = useMemo(() => {
    const found = new Set(allCards.map((c) => c.rarity));
    return KNOWN_RARITIES.filter((r) => found.has(r));
  }, [allCards]);

  return {
    filters,
    setFilters,
    filteredCards,
    colorOptions,
    typeOptions,
    costOptions,
    printTagOptions,
    rarityOptions,
    blockOptions,
  };
}
