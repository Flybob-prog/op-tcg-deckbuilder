"use client";

import { useState } from "react";
import { importDeckList } from "@/lib/importDeck";

/**
 * Collapsible "Import deck list" box for the deck builder. Paste a list
 * copied from gumgum.gg (or any "4xOP01-016" style list), and it's
 * turned into a deck via lib/importDeck.js. Importing replaces the
 * current deck.
 */
export default function DeckImport({ allCards, hasExistingDeck, onImport }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [result, setResult] = useState(null); // { ok, messages }

  function handleImport() {
    const { deck, messages } = importDeckList(text, allCards);
    if (!deck) {
      setResult({ ok: false, messages });
      return;
    }
    onImport(deck);
    const total = Object.values(deck.cards).reduce((s, e) => s + e.count, 0);
    setResult({
      ok: true,
      messages: [
        `Imported ${deck.leader.card_name} with ${total} card${total === 1 ? "" : "s"}.`,
        ...messages,
      ],
    });
    setText("");
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-left text-sm font-medium text-neutral-700 dark:text-neutral-300"
      >
        Import a deck list (e.g. copied from gumgum.gg)
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={"1xOP12-001\n4xOP12-008\n4xOP12-015\n..."}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-800"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleImport}
              disabled={!text.trim()}
              className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-40 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Import deck
            </button>
            {hasExistingDeck && (
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                This replaces the deck you&apos;re currently building.
              </span>
            )}
          </div>
        </div>
      )}

      {result && (
        <ul
          className={`mt-3 list-disc space-y-1 pl-5 text-sm ${
            result.ok
              ? "text-green-700 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {result.messages.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
