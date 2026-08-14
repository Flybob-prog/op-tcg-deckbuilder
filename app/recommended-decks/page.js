"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import RecommendedDeckCard from "@/components/RecommendedDeckCard";
import { useCards } from "@/hooks/useCards";
import { RECOMMENDED_DECKS, resolveDeck } from "@/lib/recommendedDecks";
import { STORAGE_KEY } from "@/lib/deck";

export default function RecommendedDecksPage() {
  const { allCards, status } = useCards();
  const router = useRouter();

  const decks = useMemo(() => {
    if (status !== "ready") return [];
    return RECOMMENDED_DECKS.map((deckDef) => resolveDeck(deckDef, allCards));
  }, [status, allCards]);

  // Writes the chosen deck into the same localStorage slot the deck
  // builder reads from (see lib/deck.js's STORAGE_KEY), then navigates
  // there. If there's already a deck in progress, confirm first — this
  // would otherwise silently overwrite someone's in-progress work.
  const handleLoad = useCallback(
    (deck) => {
      if (typeof window === "undefined") return;

      const existingRaw = window.localStorage.getItem(STORAGE_KEY);
      if (existingRaw) {
        try {
          const existing = JSON.parse(existingRaw);
          const hasProgress =
            Boolean(existing.leader) ||
            Object.keys(existing.cards ?? {}).length > 0;
          if (
            hasProgress &&
            !window.confirm(
              "Loading this deck will replace your current deck in the Deck Builder. Continue?"
            )
          ) {
            return;
          }
        } catch {
          // Malformed saved state — fine to just overwrite it below.
        }
      }

      const deckToSave = {
        leader: deck.leaderCard,
        cards: Object.fromEntries(
          deck.cardEntries.map(({ card, count }) => [
            card.card_set_id,
            { card, count },
          ])
        ),
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(deckToSave));
      router.push("/deck-builder");
    },
    [router]
  );

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold">Recommended Decks</h1>
        <p className="text-neutral-500 dark:text-neutral-400">
          A few decks worth trying. Load one straight into the Deck Builder
          to tweak it further.
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

      {status === "ready" && decks.length === 0 && (
        <p className="py-12 text-center text-neutral-500 dark:text-neutral-400">
          No recommended decks yet — check back soon.
        </p>
      )}

      {status === "ready" && decks.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <RecommendedDeckCard key={deck.id} deck={deck} onLoad={handleLoad} />
          ))}
        </div>
      )}
    </main>
  );
}
