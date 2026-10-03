"use client";

import { totalCardsOwned, totalListed, totalUniqueOwned } from "@/lib/collection";

/**
 * Side panel summarizing the collection: how many distinct cards
 * you've recorded at least one copy of, the total physical card count
 * across all of them, and how many currently have a Shopify listing
 * (see SpareListings). Mirrors DeckPanel's layout/pattern — see that
 * component for the deck-in-progress equivalent.
 */
export default function CollectionPanel({ collection, onClear }) {
  const uniqueCount = totalUniqueOwned(collection);
  const totalCount = totalCardsOwned(collection);
  const listedCount = totalListed(collection);

  return (
    <aside className="flex w-full flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 lg:sticky lg:top-4 lg:w-72">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Your Collection</h2>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-neutral-500 hover:text-red-600 dark:text-neutral-400 dark:hover:text-red-400"
        >
          Clear collection
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md bg-neutral-50 p-3 text-center dark:bg-neutral-800">
          <p className="text-2xl font-semibold">{uniqueCount}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            distinct cards
          </p>
        </div>
        <div className="rounded-md bg-neutral-50 p-3 text-center dark:bg-neutral-800">
          <p className="text-2xl font-semibold">{totalCount}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            physical cards
          </p>
        </div>
      </div>

      {listedCount > 0 && (
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          <span className="font-semibold">{listedCount}</span> listed for
          sale on Shopify right now.
        </p>
      )}

      {uniqueCount === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Nothing recorded yet — use the +/- steppers on each card below
          to log what you own. Filter down to one set at a time to work
          through your binder without getting overwhelmed.
        </p>
      ) : (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Saved automatically in this browser. Head to the Deck Builder
          to see owned counts while you build, or filter to just the
          cards you own.
        </p>
      )}
    </aside>
  );
}
