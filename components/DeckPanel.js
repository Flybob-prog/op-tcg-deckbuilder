"use client";

import Image from "next/image";
import { useState } from "react";
import { DECK_SIZE, totalCardCount, validateDeck } from "@/lib/deck";
import { exportDeckList } from "@/lib/importDeck";
import BuyDeckPanel from "@/components/BuyDeckPanel";

/**
 * Side panel showing the deck currently being built: the Leader slot,
 * every added card with its quantity, a running total, and any rule
 * violations (see lib/deck.js's validateDeck). All state lives in the
 * parent page — this component just renders `deck` and calls back into
 * the passed-in handlers.
 *
 * Pass `getOwnedCount(card) => number` (see lib/collection.js) to flag,
 * per card, when the deck calls for more copies than you physically
 * own — so you can tell at a glance which cards you still need to
 * pick up before this deck is playable with your real cards. Omit it
 * to hide the check entirely (e.g. if the collection is empty/unused).
 */
export default function DeckPanel({
  deck,
  onRemoveCard,
  onClearDeck,
  getOwnedCount,
}) {
  // "idle" | "copied" | "failed". If the browser blocks clipboard
  // access, the list is shown in a box instead so it can be copied by hand.
  const [copyState, setCopyState] = useState("idle");
  const total = totalCardCount(deck);
  const deckText = exportDeckList(deck);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(deckText);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("failed");
    }
  }

  function handleDownload() {
    const blob = new Blob([deckText + "\n"], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const name = (deck.leader?.card_name ?? "deck")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
    a.href = url;
    a.download = `${deck.leader?.card_set_id ?? "deck"}-${name}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const { isComplete, issues } = validateDeck(deck);
  const cardEntries = Object.values(deck.cards).sort((a, b) =>
    a.card.card_name.localeCompare(b.card.card_name)
  );

  return (
    <aside className="flex w-full flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 lg:sticky lg:top-4 lg:w-80">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Your Deck</h2>
        <button
          type="button"
          onClick={onClearDeck}
          className="text-xs text-neutral-500 hover:text-red-600 dark:text-neutral-400 dark:hover:text-red-400"
        >
          Clear deck
        </button>
      </div>

      <div>
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Leader
        </p>
        {deck.leader ? (
          <div className="mt-1 flex items-center gap-2">
            {deck.leader.card_image ? (
              <div className="relative h-14 w-10 flex-shrink-0 overflow-hidden rounded border border-neutral-200 dark:border-neutral-700">
                <Image
                  src={deck.leader.card_image}
                  alt={deck.leader.card_name}
                  fill
                  sizes="40px"
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : null}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {deck.leader.card_name}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {deck.leader.card_color}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            None selected — pick one from the grid.
          </p>
        )}
      </div>

      <div>
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Cards ({total}/{DECK_SIZE})
        </p>
        {cardEntries.length === 0 ? (
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            No cards added yet.
          </p>
        ) : (
          <ul className="mt-1 flex max-h-96 flex-col gap-1 overflow-y-auto pr-1">
            {cardEntries.map(({ card, count }) => {
              const owned = getOwnedCount ? getOwnedCount(card) : null;
              const short = owned !== null && count > owned;

              return (
                <li
                  key={card.card_set_id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="truncate">
                    <span className="font-medium">{count}x</span>{" "}
                    {card.card_name}
                    {short && (
                      <span
                        className="ml-1 text-xs font-medium text-amber-600 dark:text-amber-400"
                        title="You need more physical copies of this card — update it on the Collection page once you pick them up."
                      >
                        (own {owned})
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveCard(card.card_set_id)}
                    className="flex-shrink-0 text-xs text-neutral-400 hover:text-red-600 dark:hover:text-red-400"
                    aria-label={`Remove one copy of ${card.card_name}`}
                  >
                    remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {deck.leader && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              {copyState === "copied" ? "Copied!" : "Copy deck list"}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              Download .txt
            </button>
          </div>
          {copyState === "failed" && (
            <>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Couldn&apos;t copy automatically. Select the list below and copy it.
              </p>
              <textarea
                readOnly
                value={deckText}
                rows={6}
                onFocus={(e) => e.target.select()}
                className="w-full rounded-md border border-neutral-300 px-2 py-1 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-800"
              />
            </>
          )}
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Paste it into &quot;Import a deck list&quot; on any device to load
            this deck again.
          </p>
        </div>
      )}

      <BuyDeckPanel deck={deck} getOwnedCount={getOwnedCount} />

      <div
        className={`rounded-md p-3 text-sm ${
          isComplete
            ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400"
            : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
        }`}
      >
        {isComplete ? (
          <p className="font-medium">Deck is complete and legal.</p>
        ) : (
          <ul className="list-inside list-disc space-y-0.5">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
