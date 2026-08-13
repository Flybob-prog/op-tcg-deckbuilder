"use client";

import Image from "next/image";
import { hasUnlimitedCopies } from "@/lib/deck";

/**
 * Renders a grid of card images. Kept dumb on purpose — it just takes
 * an array of card objects (the shape documented in lib/optcg.js) and
 * renders them. No fetching or filtering logic here.
 *
 * Hovering a card scales it up (via CSS transform, not layout — the
 * card overlaps its neighbors on top instead of pushing them around)
 * so the printed card text becomes readable. `relative` + `hover:z-20`
 * makes sure the hovered card paints above every other card regardless
 * of grid order; without that, cards later in the grid would render on
 * top of an earlier hovered card and cut it off. Cards right at the
 * edge of the grid can visually clip against the viewport edge since
 * the zoom is centered — acceptable for now, easy to special-case later
 * if it's annoying in practice.
 *
 * Pass a `builder` prop to turn on deck-building controls (used by the
 * deck builder page, left undefined on the plain card database page):
 *
 * builder = {
 *   getCount(card) => number of copies already in the deck,
 *   isLeader(card) => whether this card is the deck's current Leader,
 *   canAdd(card) => { ok, reason } — see lib/deck.js's canAddCard,
 *   onAdd(card), onRemove(card), onSetLeader(card),
 * }
 */
export default function CardGrid({ cards, builder }) {
  if (cards.length === 0) {
    return (
      <p className="py-12 text-center text-neutral-500 dark:text-neutral-400">
        No cards match those filters.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {cards.map((card, index) => {
        const count = builder?.getCount(card) ?? 0;
        const isLeader = builder?.isLeader(card) ?? false;
        const { ok: canAdd, reason: addBlockedReason } = builder
          ? builder.canAdd(card)
          : { ok: false, reason: null };

        return (
          <div
            // Ideally card_set_id + card_image_id would be unique, but the
            // OPTCG dataset has real duplicate rows (e.g. "OP03-070" appears
            // under two different sets/reprints with the same card_image_id
            // but a different image file). Falling back to array index
            // guarantees uniqueness; safe here since this grid has no
            // per-card state or animation that depends on stable identity.
            key={`${card.card_set_id}-${card.card_image_id ?? card.card_name}-${index}`}
            className="relative flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm transition-transform duration-200 ease-out hover:z-20 hover:scale-[2.15] hover:shadow-2xl dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div className="relative aspect-[7/10] w-full bg-neutral-100 dark:bg-neutral-800">
              {card.card_image ? (
                <Image
                  src={card.card_image}
                  alt={card.card_name}
                  fill
                  sizes="(max-width: 768px) 50vw, 20vw"
                  className="object-cover"
                  unoptimized
                />
              ) : null}

              {builder && count > 0 && (
                <span className="absolute right-1 top-1 rounded-full bg-black/80 px-2 py-0.5 text-xs font-semibold text-white">
                  x{count}
                </span>
              )}

              {builder && isLeader && (
                <span className="absolute left-1 top-1 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white">
                  Leader
                </span>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-1 p-2 text-xs">
              <p className="font-medium leading-tight">{card.card_name}</p>
              <p className="text-neutral-500 dark:text-neutral-400">
                {card.card_set_id} &middot; {card.card_color}
                {card.card_type ? ` · ${card.card_type}` : ""}
              </p>
              {hasUnlimitedCopies(card) && (
                <p className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
                  No 4-copy limit
                </p>
              )}

              {builder && card.card_type === "Leader" && (
                <button
                  type="button"
                  onClick={() => builder.onSetLeader(card)}
                  disabled={isLeader}
                  className="mt-1 rounded-md border border-amber-500 px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50 disabled:cursor-default disabled:border-neutral-300 disabled:text-neutral-400 disabled:hover:bg-transparent dark:hover:bg-amber-950 dark:disabled:border-neutral-700 dark:disabled:text-neutral-600"
                >
                  {isLeader ? "Current Leader" : "Set as Leader"}
                </button>
              )}

              {builder && card.card_type !== "Leader" && (
                <div className="mt-1 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => builder.onRemove(card)}
                    disabled={count === 0}
                    className="flex-1 rounded-md border border-neutral-300 py-1 text-xs font-medium hover:bg-neutral-100 disabled:cursor-default disabled:text-neutral-300 disabled:hover:bg-transparent dark:border-neutral-700 dark:hover:bg-neutral-800 dark:disabled:text-neutral-700"
                  >
                    &minus;
                  </button>
                  <button
                    type="button"
                    onClick={() => builder.onAdd(card)}
                    disabled={!canAdd}
                    title={canAdd ? undefined : addBlockedReason}
                    className="flex-1 rounded-md border border-neutral-300 py-1 text-xs font-medium hover:bg-neutral-100 disabled:cursor-default disabled:text-neutral-300 disabled:hover:bg-transparent dark:border-neutral-700 dark:hover:bg-neutral-800 dark:disabled:text-neutral-700"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
