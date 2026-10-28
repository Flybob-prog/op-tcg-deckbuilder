"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { getDeckHealth, getSuggestions } from "@/lib/suggestions";

const PAGE_SIZE = 12;

/**
 * "Suggested cards" and "Deck health" for the deck builder's step 2.
 * All the logic lives in lib/suggestions.js; this just renders it.
 *
 * Props:
 *  - deck: the deck being built (see lib/deck.js)
 *  - cardIndex: buildCardIndex(allCards) from lib/suggestions.js,
 *    built once by the page so it isn't redone on every render
 *  - canAdd(card) => { ok, reason }, onAdd(card): same as CardGrid's builder
 *  - getOwnedCount(card) => number: copies owned (My Collection)
 *  - filter(card) => boolean: optional, e.g. the "only cards I own" toggle
 */
export default function SuggestionsPanel({
  deck,
  cardIndex,
  canAdd,
  onAdd,
  getOwnedCount,
  filter,
}) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState("suggestions");
  const [shown, setShown] = useState(PAGE_SIZE);

  const suggestions = useMemo(
    () => getSuggestions(deck, cardIndex, { filter }),
    [deck, cardIndex, filter]
  );
  const health = useMemo(() => getDeckHealth(deck, cardIndex), [deck, cardIndex]);

  if (!deck.leader) return null;

  const tipCount = health.tips.filter((t) => t.kind === "tip").length;
  const tabClass = (active) =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${
      active
        ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
        : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
    }`;

  return (
    <section className="rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 p-3 dark:border-neutral-800">
        <div className="flex flex-wrap items-center gap-1" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "suggestions"}
            onClick={() => {
              setTab("suggestions");
              setOpen(true);
            }}
            className={tabClass(open && tab === "suggestions")}
          >
            Suggested cards ({suggestions.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "health"}
            onClick={() => {
              setTab("health");
              setOpen(true);
            }}
            className={tabClass(open && tab === "health")}
          >
            Deck health
            {tipCount > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 text-xs text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                {tipCount}
              </span>
            )}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-xs text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
          aria-expanded={open}
        >
          {open ? "Hide" : "Show"}
        </button>
      </div>

      {open && tab === "suggestions" && (
        <div className="flex flex-col gap-3 p-3">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Picked for {deck.leader.card_name} from its card text and our
            recommended decks, not from tournament results. Cards already in
            your deck are left out.
          </p>

          {suggestions.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
              No strong matches found for this Leader
              {filter ? " with the current filter" : ""}. Browse the cards
              below instead.
            </p>
          ) : (
            <>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {suggestions.slice(0, shown).map(({ card, reasons }) => {
                  const { ok, reason } = canAdd(card);
                  const owned = getOwnedCount ? getOwnedCount(card) : 0;
                  return (
                    <li
                      key={card.card_set_id}
                      className="flex gap-3 rounded-md border border-neutral-200 p-2 dark:border-neutral-800"
                    >
                      <div className="relative h-[84px] w-[60px] flex-shrink-0 overflow-hidden rounded bg-neutral-100 transition-transform duration-200 ease-out hover:z-20 hover:scale-[3] hover:shadow-2xl dark:bg-neutral-800">
                        {card.card_image ? (
                          <Image
                            src={card.card_image}
                            alt={card.card_name}
                            fill
                            sizes="180px"
                            className="object-cover"
                            unoptimized
                          />
                        ) : null}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <p className="truncate text-sm font-medium" title={card.card_name}>
                          {card.card_name}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          {card.card_set_id}
                          {card.card_cost != null && card.card_cost !== "" && ` · Cost ${card.card_cost}`}
                          {Number(card.counter_amount) > 0 && ` · +${card.counter_amount} counter`}
                          {owned > 0 && ` · Own ${owned}`}
                        </p>
                        <ul className="flex flex-col gap-0.5">
                          {reasons.slice(0, 2).map((r) => (
                            <li
                              key={r}
                              className="text-xs leading-snug text-emerald-700 dark:text-emerald-400"
                            >
                              {r}
                            </li>
                          ))}
                          {reasons.length > 2 && (
                            <li
                              className="text-xs text-neutral-500 dark:text-neutral-400"
                              title={reasons.slice(2).join("\n")}
                            >
                              +{reasons.length - 2} more reason
                              {reasons.length - 2 === 1 ? "" : "s"}
                            </li>
                          )}
                        </ul>
                        <button
                          type="button"
                          onClick={() => onAdd(card)}
                          disabled={!ok}
                          title={ok ? undefined : reason}
                          className="mt-auto w-fit rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                        >
                          Add to deck
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {suggestions.length > shown && (
                <button
                  type="button"
                  onClick={() => setShown((n) => n + PAGE_SIZE)}
                  className="w-fit self-center rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  Show more ({suggestions.length - shown} left)
                </button>
              )}
            </>
          )}
        </div>
      )}

      {open && tab === "health" && <HealthView health={health} />}
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-md bg-neutral-50 px-3 py-2 dark:bg-neutral-800">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
    </div>
  );
}

function HealthView({ health }) {
  const { stats, curve, colors, tips, total } = health;
  const maxCurve = Math.max(1, ...curve.map((c) => c.count));

  return (
    <div className="flex flex-col gap-4 p-3">
      <ul className="flex flex-col gap-1.5">
        {tips.map((tip) => (
          <li
            key={tip.text}
            className={`rounded-md px-3 py-2 text-sm ${
              tip.kind === "good"
                ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300"
                : tip.kind === "info"
                  ? "bg-neutral-50 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                  : "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
            }`}
          >
            {tip.text}
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Cards" value={`${total}/50`} />
        <Stat label="With a counter" value={stats.counterCards} />
        <Stat label="[Blocker]" value={stats.blockers} />
        <Stat label="[Trigger]" value={stats.triggers} />
        <Stat label="Characters" value={stats.characters} />
        <Stat label="Events" value={stats.events} />
        <Stat label="Stages" value={stats.stages} />
        <Stat label="Average cost" value={stats.avgCost || "-"} />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Cost curve
        </p>
        <div className="flex h-28 items-end gap-1.5" aria-label="Cards by cost">
          {curve.map(({ label, count }) => (
            <div key={label} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                {count || ""}
              </span>
              <div
                className="w-full rounded-t bg-neutral-800 dark:bg-neutral-200"
                style={{ height: `${(count / maxCurve) * 72}px` }}
                title={`Cost ${label}: ${count} card${count === 1 ? "" : "s"}`}
              />
              <span className="text-xs text-neutral-500 dark:text-neutral-400">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {colors.length > 1 && (
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          Color split:{" "}
          {colors.map((c) => `${c.count} ${c.color}`).join(" · ")}
          <span className="text-neutral-400"> (dual-color cards count for both)</span>
        </p>
      )}

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        These are general rules of thumb, not hard rules. Some decks break
        them on purpose.
      </p>
    </div>
  );
}
