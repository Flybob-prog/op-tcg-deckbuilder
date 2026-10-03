"use client";

import Image from "next/image";

/**
 * One official Starter Deck, shown in the gallery on
 * app/starter-decks/page.js. Takes a deck object from
 * lib/starterDecks.js's getStarterDecks() — this component only
 * renders, it doesn't derive or fetch anything itself.
 *
 * There are no real copy counts here (see the file note in
 * lib/starterDecks.js for why), so "Load as Starting Point" seeds the
 * Deck Builder with exactly 1 copy of each unique card rather than a
 * claimed 51-card decklist. It's clearly labeled as a starting point,
 * not the official build — the player fills it out to match the real
 * box (or their own preference) from there.
 */
export default function StarterDeckCard({ deck, onLoad }) {
  const { setId, setName, leader, cards } = deck;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-start gap-3">
        {leader?.card_image ? (
          <div className="relative h-24 w-16 flex-shrink-0 overflow-hidden rounded border border-neutral-200 dark:border-neutral-700">
            <Image
              src={leader.card_image}
              alt={leader.card_name}
              fill
              sizes="64px"
              className="object-cover"
              unoptimized
            />
          </div>
        ) : null}
        <div className="min-w-0">
          <h3 className="font-semibold leading-tight">{setName}</h3>
          <span className="mt-1 inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            {setId}
          </span>
          {leader ? (
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {leader.card_name}
            </p>
          ) : null}
        </div>
      </div>

      <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {cards.length} unique card{cards.length === 1 ? "" : "s"} in this deck
        (copy counts not shown — check the decklist card in the box for
        exact quantities)
      </p>

      <ul className="max-h-48 overflow-y-auto text-xs text-neutral-600 dark:text-neutral-400">
        {cards.map((card) => (
          <li key={card.card_set_id} className="truncate py-0.5">
            <span className="font-medium">{card.card_set_id}</span>{" "}
            {card.card_name}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => onLoad(deck)}
        disabled={!leader}
        title="Loads 1 copy of each card shown above — not the real box quantities, just a starting point to build from."
        className="mt-1 rounded-md border border-amber-500 px-3 py-1.5 text-sm font-medium text-amber-600 hover:bg-amber-50 disabled:cursor-default disabled:border-neutral-300 disabled:text-neutral-400 disabled:hover:bg-transparent dark:hover:bg-amber-950 dark:disabled:border-neutral-700 dark:disabled:text-neutral-600"
      >
        Load as Starting Point (1x each)
      </button>
    </div>
  );
}
