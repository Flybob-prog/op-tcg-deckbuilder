"use client";

import { useMemo } from "react";
import CardFilters from "@/components/CardFilters";
import CardGrid from "@/components/CardGrid";
import { useCards } from "@/hooks/useCards";
import { useCardFilters } from "@/hooks/useCardFilters";
import { sortCardsNewestFirst } from "@/lib/optcg";

export default function Home() {
  const { allCards: rawCards, status } = useCards();
  // Newest sets first, same as the Deck Builder (see lib/optcg.js).
  const allCards = useMemo(() => sortCardsNewestFirst(rawCards), [rawCards]);
  const {
    filters,
    setFilters,
    filteredCards,
    colorOptions,
    typeOptions,
    costOptions,
    printTagOptions,
    rarityOptions,
    blockOptions,
  } = useCardFilters(allCards);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold">OP TCG Card Database</h1>
        <p className="text-neutral-500 dark:text-neutral-400">
          Search and filter every card, powered by the OPTCG API.
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
          <CardFilters
            filters={filters}
            onChange={setFilters}
            colorOptions={colorOptions}
            typeOptions={typeOptions}
            costOptions={costOptions}
            printTagOptions={printTagOptions}
            rarityOptions={rarityOptions}
              blockOptions={blockOptions}
            resultCount={filteredCards.length}
          />
          <CardGrid cards={filteredCards} />
        </>
      )}
    </main>
  );
}
