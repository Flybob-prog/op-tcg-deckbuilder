"use client";

import { useEffect, useState } from "react";
import { createEmptyDeck, STORAGE_KEY } from "@/lib/deck";

/**
 * Read-only view of the deck-in-progress (see lib/deck.js and
 * app/deck-builder/page.js, which is what actually writes it). Used by
 * the Collection page to work out how many of your owned copies are
 * "reserved" for the deck you're currently building, so it doesn't
 * suggest listing cards you're actually using for spare sale.
 */
export function useSavedDeck() {
  const [deck, setDeck] = useState(createEmptyDeck());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setDeck(JSON.parse(saved));
    } catch (err) {
      console.error("Failed to load saved deck:", err);
    } finally {
      setLoaded(true);
    }
  }, []);

  return { deck, loaded };
}
