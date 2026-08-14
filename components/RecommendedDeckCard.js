"use client";

import Image from "next/image";
import { DECK_SIZE } from "@/lib/deck";

/**
 * One recommended deck, shown as a card in the gallery on
 * app/recommended-decks/page.js. Takes an already-`resolveDeck`d deck
 * (see lib/recommendedDecks.js) — this component only renders, it
 * doesn't fetch or resolve anything itself.
 */
export default function RecommendedDeckCard({ deck, onLoad }) {
  const { name, archetype, description, leaderCard, cardEntries, totalCount } =
    deck;

  const sortedEntries = [...cardEntries].sort((a, b) =>
    a.card.card_name.localeCompare(b.card.card_name)
  );

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-start gap-3">
        {leaderCard?.card_image ? (
          <div className="relative h-24 w-16 flex-shrink-0 overflow-hidden rounded border border-neutral-200 dark:border-neutral-700">
            <Image
              src={leaderCard.card_image}
              alt={leaderCard.card_name}
              fill
              sizes="64px"
              className="object-cover"
              unoptimized
            />
          </div>
        ) : null}
        <div className="min-w-0">
          <h3 className="font-semibold leading-tight">{name}</h3>
          {archetype ? (
            <span className="mt-1 inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              {archetype}
            </span>
          ) : null}
          {leaderCard ? (
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {leaderCard.card_name}
            </p>
          ) : null}
        </div>
      </div>

      {description ? (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-400">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Strategy
          </p>
          <p>{description}</p>
        </div>
      ) : null}

      <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {totalCount}/{DECK_SIZE} cards
        {totalCount !== DECK_SIZE ? " (incomplete listing)" : ""}
      </p>

      <ul className="max-h-48 overflow-y-auto text-xs text-neutral-600 dark:text-neutral-400">
        {sortedEntries.map(({ card, count }) => (
          <li key={card.card_set_id} className="truncate py-0.5">
            <span className="font-medium">{count}x</span> {card.card_name}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => onLoad(deck)}
        disabled={!leaderCard}
        className="mt-1 rounded-md border border-amber-500 px-3 py-1.5 text-sm font-medium text-amber-600 hover:bg-amber-50 disabled:cursor-default disabled:border-neutral-300 disabled:text-neutral-400 disabled:hover:bg-transparent dark:hover:bg-amber-950 dark:disabled:border-neutral-700 dark:disabled:text-neutral-600"
      >
        Load into Deck Builder
      </button>
    </div>
  );
}
