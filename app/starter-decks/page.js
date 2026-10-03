"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import StarterDeckCard from "@/components/StarterDeckCard";
import { useCards } from "@/hooks/useCards";
import { getStarterDecks } from "@/lib/starterDecks";
import { STORAGE_KEY } from "@/lib/deck";

export default function StarterDecksPage() {
  const { allCards, status } = useCards();
  const router = useRouter();

  const decks = useMemo(() => {
    if (status !== "ready") return [];
    return getStarterDecks(allCards);
  }, [status, allCards]);

  // Same pattern as app/recommended-decks/page.js's handleLoad: writes
  // into the shared deck-builder localStorage slot, confirming first if
  // there's already progress there. The difference is what gets written
  // — 1 copy of each unique card, not real quantities (see the note in
  // lib/starterDecks.js and StarterDeckCard.js for why those aren't
  // available). This is a starting point, not a claimed 51-card build.
  const handleLoad = useCallback(
    (deck) => {
      if (typeof window === "undefined" || !deck.leader) return;

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
        leader: deck.leader,
        cards: Object.fromEntries(
          deck.cards.map((card) => [card.card_set_id, { card, count: 1 }])
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
        <h1 className="text-2xl font-semibold">Starter Decks</h1>
        <p className="text-neutral-500 dark:text-neutral-400">
          Every official pre-constructed Starter Deck (ST-01 onward), with
          the unique cards that come in the box. Copy counts aren&apos;t
          published anywhere we could verify, so they&apos;re left out
          rather than guessed — &quot;Load as Starting Point&quot; adds 1
          of each card into the Deck Builder for you to fill out to the
          real box (or your own build) from there.
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
          No Starter Deck cards found in the current data.
        </p>
      )}

      {status === "ready" && decks.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <StarterDeckCard key={deck.setId} deck={deck} onLoad={handleLoad} />
          ))}
        </div>
      )}
    </main>
  );
}
