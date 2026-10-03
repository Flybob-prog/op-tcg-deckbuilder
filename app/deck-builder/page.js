"use client";

import { useCallback, useEffect, useState } from "react";
import CardFilters from "@/components/CardFilters";
import CardGrid from "@/components/CardGrid";
import DeckPanel from "@/components/DeckPanel";
import DeckImport from "@/components/DeckImport";
import { useCards } from "@/hooks/useCards";
import { useCardFilters } from "@/hooks/useCardFilters";
import { useCollection } from "@/hooks/useCollection";
import {
  addCard,
  canAddCard,
  clearDeck,
  createEmptyDeck,
  isPlayableWithLeader,
  removeCard,
  setLeader,
  STORAGE_KEY,
} from "@/lib/deck";
import { getOwnedCount } from "@/lib/collection";
import { filterCards } from "@/lib/optcg";

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
  const { collection } = useCollection();
  const [onlyOwned, setOnlyOwned] = useState(false);
  // The builder runs in two steps:
  //   1. "leader": only Leader cards are shown; pick one.
  //   2. "cards": only cards playable with that Leader are shown.
  // The step is derived from whether a Leader is set, plus this flag for
  // when someone with a Leader clicks "Change Leader" to go back to 1.
  const [changingLeader, setChangingLeader] = useState(false);
  const step = deck.leader && !changingLeader ? "cards" : "leader";

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
    setChangingLeader(false);
  }, []);

  const handleImport = useCallback((importedDeck) => {
    setDeck(importedDeck);
    setChangingLeader(false);
  }, []);

  const handleClear = useCallback(() => {
    setDeck(clearDeck());
    setChangingLeader(false);
  }, []);

  const builder = {
    getCount: (card) => deck.cards[card.card_set_id]?.count ?? 0,
    isLeader: (card) => deck.leader?.card_set_id === card.card_set_id,
    canAdd: (card) => canAddCard(deck, card),
    onAdd: handleAdd,
    onRemove: handleRemove,
    onSetLeader: handleSetLeader,
  };

  // Read-only here (no onIncrement/onDecrement) — editing what you own
  // happens on the Collection page (/collection). This just shows the
  // count so you can see what you physically have while building.
  const collectionDisplay = {
    getCount: (card) => getOwnedCount(collection, card),
  };

  const ownedOk = (card) =>
    !onlyOwned || getOwnedCount(collection, card) > 0;

  // Step 1 ignores the Type dropdown (it's always Leaders here), so a
  // leftover "Character" type filter can't leave the list empty.
  const gridCards =
    step === "leader"
      ? filterCards(allCards, { ...filters, type: "" }).filter(
          (card) => card.card_type === "Leader" && ownedOk(card)
        )
      : filteredCards.filter(
          (card) => isPlayableWithLeader(deck.leader, card) && ownedOk(card)
        );

  const deckCardCount = Object.values(deck.cards).reduce(
    (sum, entry) => sum + entry.count,
    0
  );

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold">Deck Builder</h1>
        <p className="text-neutral-500 dark:text-neutral-400">
          Step 1: pick a Leader. Step 2: add 50 cards that share its
          color. Your deck saves automatically in this browser. Each card shows
          how many copies you own (from{" "}
          <span className="underline">My Collection</span>), so you can
          build with cards you actually have.
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
            <DeckImport
              allCards={allCards}
              hasExistingDeck={Boolean(deck.leader) || deckCardCount > 0}
              onImport={handleImport}
            />

            <ol className="flex flex-wrap items-center gap-2 text-sm">
              <li
                className={`rounded-full px-3 py-1 font-medium ${
                  step === "leader"
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
                }`}
              >
                1. Choose a Leader
              </li>
              <li aria-hidden="true" className="text-neutral-400">
                &rarr;
              </li>
              <li
                className={`rounded-full px-3 py-1 font-medium ${
                  step === "cards"
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
                }`}
              >
                2. Add cards
              </li>
            </ol>

            {step === "leader" ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900">
                <p className="text-neutral-700 dark:text-neutral-300">
                  {deck.leader
                    ? "Pick a new Leader. Cards in your deck that don't share its color will be removed."
                    : "Start by picking the Leader for your deck. Click \"Set as Leader\" on any card below."}
                </p>
                {deck.leader && (
                  <button
                    type="button"
                    onClick={() => setChangingLeader(false)}
                    className="rounded-md border border-neutral-300 px-3 py-2 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  >
                    Keep {deck.leader.card_name}
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900">
                <p className="text-neutral-700 dark:text-neutral-300">
                  Leader:{" "}
                  <span className="font-semibold">{deck.leader.card_name}</span>{" "}
                  ({deck.leader.card_color}). Showing only cards you can
                  use with this Leader. {deckCardCount}/50 cards added.
                </p>
                <button
                  type="button"
                  onClick={() => setChangingLeader(true)}
                  className="rounded-md border border-neutral-300 px-3 py-2 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  Change Leader
                </button>
              </div>
            )}

            <CardFilters
              filters={filters}
              onChange={setFilters}
              colorOptions={colorOptions}
              typeOptions={typeOptions}
              costOptions={costOptions}
              printTagOptions={printTagOptions}
              rarityOptions={rarityOptions}
              resultCount={gridCards.length}
            />
            <label className="flex w-fit items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={onlyOwned}
                onChange={(e) => setOnlyOwned(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-700"
              />
              Only show cards I own (from{" "}
              <span className="underline">My Collection</span>)
            </label>
            <CardGrid
              cards={gridCards}
              builder={builder}
              collection={collectionDisplay}
            />
          </div>

          <DeckPanel
            deck={deck}
            onRemoveCard={handleRemoveById}
            onClearDeck={handleClear}
            getOwnedCount={(card) => getOwnedCount(collection, card)}
          />
        </div>
      )}
    </main>
  );
}
