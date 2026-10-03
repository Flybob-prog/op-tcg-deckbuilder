"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearCollection as clearCollectionValue,
  createEmptyCollection,
  decrementOwned,
  incrementOwned,
  setListing as setListingInCollection,
  setOwnedCount as setOwnedCountInCollection,
  STORAGE_KEY,
} from "@/lib/collection";

/**
 * Loads/saves the "cards I own" collection to localStorage — the same
 * load-on-mount / save-on-change pattern app/deck-builder/page.js uses
 * for the deck-in-progress (see the comment there). Pulled into a
 * shared hook because both the Collection page and the Deck Builder
 * page need to read (and the Collection page needs to update) it.
 *
 * setListing/clearListing only update the LOCAL record of a Shopify
 * listing (id/handle/quantity/price) — they don't talk to Shopify
 * themselves. The actual create/delete API calls live in
 * app/collection/page.js (via the /api/shopify/* routes), since those
 * are real network requests with their own loading/error state per
 * card, not a plain local state update.
 */
export function useCollection() {
  const [collection, setCollection] = useState(createEmptyCollection());
  const [loaded, setLoaded] = useState(false);

  // Client-only load, once on mount — localStorage doesn't exist during
  // server rendering. See the matching comment in
  // app/deck-builder/page.js for why the lint rule gets suppressed here.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setCollection(JSON.parse(saved));
    } catch (err) {
      console.error("Failed to load saved collection:", err);
    } finally {
      setLoaded(true);
    }
  }, []);

  // Save on every change, but only after the initial load above has run
  // — otherwise we'd briefly overwrite the saved collection with the
  // empty starting state before it's had a chance to load.
  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
  }, [collection, loaded]);

  const increment = useCallback((card) => {
    setCollection((current) => incrementOwned(current, card));
  }, []);

  const decrement = useCallback((card) => {
    setCollection((current) => decrementOwned(current, card));
  }, []);

  const setCount = useCallback((card, count) => {
    setCollection((current) =>
      setOwnedCountInCollection(current, card.card_set_id, count)
    );
  }, []);

  const setListing = useCallback((card, listing) => {
    setCollection((current) =>
      setListingInCollection(current, card.card_set_id, listing)
    );
  }, []);

  const clearListing = useCallback((card) => {
    setCollection((current) =>
      setListingInCollection(current, card.card_set_id, null)
    );
  }, []);

  const clear = useCallback(() => {
    setCollection(clearCollectionValue());
  }, []);

  return {
    collection,
    loaded,
    increment,
    decrement,
    setCount,
    setListing,
    clearListing,
    clear,
  };
}
