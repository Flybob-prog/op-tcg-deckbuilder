"use client";

import { useMemo } from "react";
import CardFilters from "@/components/CardFilters";
import CardGrid from "@/components/CardGrid";
import CollectionPanel from "@/components/CollectionPanel";
import SpareListings from "@/components/SpareListings";
import { useCards } from "@/hooks/useCards";
import { useCardFilters } from "@/hooks/useCardFilters";
import { useCollection } from "@/hooks/useCollection";
import { useSavedDeck } from "@/hooks/useSavedDeck";
import { getListing, getOwnedCount } from "@/lib/collection";

// Your collection ("which cards you physically own, and how many") is
// saved to the browser's localStorage — see hooks/useCollection.js and
// lib/collection.js — the same approach the Deck Builder uses for the
// deck-in-progress (see the comment in app/deck-builder/page.js).
// There's no account system, so this only lives on this browser/device.
//
// "Spares" (see SpareListings + the /api/shopify/* routes) are worked
// out as owned-minus-reserved-in-your-current-deck, so listing a spare
// for sale is a one-off snapshot at the moment you click "List for
// sale" — it does NOT keep syncing with Shopify afterwards. If you
// later adjust owned/deck counts, the listing on Shopify stays exactly
// as you left it until you unlist it.

export default function CollectionPage() {
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

  const {
    collection,
    increment,
    decrement,
    clear,
    setListing,
    clearListing,
  } = useCollection();
  const { deck } = useSavedDeck();

  const collectionControls = {
    getCount: (card) => getOwnedCount(collection, card),
    onIncrement: increment,
    onDecrement: decrement,
  };

  // One representative card object per card_set_id (the base printing
  // sorts first — see the variantRank note in lib/optcg.js) so the
  // spares list can show a name/image without re-fetching anything.
  const cardById = useMemo(() => {
    const map = new Map();
    for (const card of allCards) {
      if (!map.has(card.card_set_id)) map.set(card.card_set_id, card);
    }
    return map;
  }, [allCards]);

  const spareEntries = useMemo(() => {
    const entries = [];
    for (const cardId of Object.keys(collection)) {
      const card = cardById.get(cardId);
      if (!card) continue; // shouldn't happen once cards have loaded

      const owned = getOwnedCount(collection, card);
      const reserved = deck.cards[cardId]?.count ?? 0;
      const spare = Math.max(0, owned - reserved);
      const listing = getListing(collection, card);

      if (spare > 0 || listing) {
        entries.push({ card, owned, reserved, spare, listing });
      }
    }
    return entries.sort((a, b) =>
      a.card.card_name.localeCompare(b.card.card_name)
    );
  }, [collection, cardById, deck]);

  async function handleList(card, { quantity, price }) {
    const res = await fetch("/api/shopify/list-card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card, quantity, price }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to list this card on Shopify.");
    }
    setListing(card, { ...data.listing, quantity, price });
  }

  async function handleUnlist(card, listing) {
    const res = await fetch("/api/shopify/unlist-card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: listing.productId }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to remove the Shopify listing.");
    }
    clearListing(card);
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold">My Collection</h1>
        <p className="text-neutral-500 dark:text-neutral-400">
          Work through your binder set by set and record how many of
          each card you physically own, using the +/- on every card.
          This saves automatically in this browser, and the Deck
          Builder uses it to show what you already have.
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
        <>
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
              <CardGrid cards={filteredCards} collection={collectionControls} />
            </div>

            <CollectionPanel collection={collection} onClear={clear} />
          </div>

          <SpareListings
            entries={spareEntries}
            onList={handleList}
            onUnlist={handleUnlist}
          />
        </>
      )}
    </main>
  );
}
