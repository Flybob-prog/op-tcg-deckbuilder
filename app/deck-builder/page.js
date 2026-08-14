"use client";

import { useCallback, useEffect, useState } from "react";
import CardFilters from "@/components/CardFilters";
import CardGrid from "@/components/CardGrid";
import DeckPanel from "@/components/DeckPanel";
import { useCards } from "@/hooks/useCards";
import { useCardFilters } from "@/hooks/useCardFilters";
import {
  addCard,
  canAddCard,
  clearDeck,
  createEmptyDeck,
  removeCard,
  setLeader,
  STORAGE_KEY,
} from "@/lib/deck";

// Deck-in-progress is saved to the browser's localStorage under
// STORAGE_KEY (see lib/deck.js) so it survives page refreshes. There's
// no backend/account system yet, so this is the simplest thing that
// works for a single person building a deck on their own machine — see
// lib/deck.js for the deck shape.

export default function DeckBuilder() {
  const { allCards, status } = useCards();
  const {
    filters,
    setFilters,
    filteredCards,
    colorOptions,
    typeOptions,
    costOptions,
    printTagOptions,
    rarityOptions,
  } = useCardFilters(allCards);

  const [deck, setDeck] = useState(createEmptyDeck());
  const [deckLoaded, setDeckLoaded] = useState(false);

  // Load any previously-saved deck once, on mount (client-only —
  // localStorage doesn't exist during server rendering). This is exactly
  // the "sync from an external system on mount" case the
  // set-state-in-effect lint rule's own message calls out as fine; it
  // still flags it because it can't tell this only runs once (empty
  // dependency array) rather than on every render.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setDeck(JSON.parse(saved));
    } catch (err) {
      console.error("Failed to load saved deck:", err);
    } finally {
      setDeckLoaded(true);
    }
  }, []);

  // Save on every change, but only after the initial load above has run
  // — otherwise we'd briefly overwrite the saved deck with the empty
  // starting state before it's had a chance to load.
  useEffect(() => {
    if (!deckLoaded) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(deck));
  }, [deck, deckLoaded]);

  const handleAdd = useCallback((card) => {
    setDeck((current) => addCard(current, card));
  }, []);

  const handleRemove = useCallback((card) => {
    setDeck((current) => removeCard(current, card.card_set_id));
  }, []);

  const handleRemoveById = useCallback((cardSetId) => {
    setDeck((current) => removeCard(current, cardSetId));
  }, []);

  const handleSetLeader = useCallback((card) => {
    setDeck((current) => setLeader(current, card));
  }, []);

  const handleClear = useCallback(() => {
    setDeck(clearDeck());
  }, []);

  const builder = {
    getCount: (card) => deck.cards[card.card_set_id]?.count ?? 0,
    isLeader: (card) => deck.leader?.card_set_id === card.card_set_id,
    canAdd: (card) => canAddCard(deck, card),
    onAdd: handleAdd,
    onRemove: handleRemove,
    onSetLeader: handleSetLeader,
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold">Deck Builder</h1>
        <p className="text-neutral-500 dark:text-neutral-400">
          Pick a Leader, then add up to 50 cards that share its color.
          Your deck saves automatically in this browser.
        </p>
      </header>

      {status === "loading" && (
        <p className="py-12 text-center text-neutral-500 dark:text-neutral-400">
          Loading cards&hellip;
        </p>
      )}

      {status === "error" && (
        <p className="py-12 text-center text-red-600 dark:text-red-400">
          Couldn&apos;t load card data. Try refreshing the page.
        </p>
      )}

      {status === "ready" && (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex flex-1 flex-col gap-6">
            <CardFilters
              filters={filters}
              onChange={setFilters}
              colorOptions={colorOptions}
              typeOptions={typeOptions}
              costOptions={costOptions}
              printTagOptions={printTagOptions}
              rarityOptions={rarityOptions}
              resultCount={filteredCards.length}
            />
            <CardGrid cards={filteredCards} builder={builder} />
          </div>

          <DeckPanel
            deck={deck}
            onRemoveCard={handleRemoveById}
            onClearDeck={handleClear}
          />
        </div>
      )}
    </main>
  );
}
