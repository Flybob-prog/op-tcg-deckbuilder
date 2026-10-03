"use client";

import { useState } from "react";
import Image from "next/image";

/**
 * "Spares ready to list" section on the Collection page: cards where
 * you own more copies than your current deck-in-progress uses (see
 * hooks/useSavedDeck.js), each with a one-click "List for sale" button
 * that creates a real DRAFT Shopify product via lib/shopify.js's
 * createCardListing() (called through /api/shopify/list-card so the
 * Admin API token stays server-side — see that file's comment).
 *
 * A price has to be typed per card since neither the card database nor
 * your collection tracks market prices — this app only knows what card
 * it is, not what it's worth today.
 */
export default function SpareListings({ entries, onList, onUnlist }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-500 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        No spares to list right now — a card shows up here once you own
        more copies than your current deck-in-progress uses. Add owned
        copies above, or build a deck that uses fewer of what you have.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div>
        <h2 className="text-lg font-semibold">Spares Ready to List</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Owned copies beyond what your deck-in-progress needs. Listings
          are created as DRAFTS on Shopify — review and publish them
          yourself once you&apos;re happy with the price.
        </p>
      </div>

      <ul className="flex flex-col divide-y divide-neutral-100 dark:divide-neutral-800">
        {entries.map((entry) => (
          <SpareListingRow
            key={entry.card.card_set_id}
            entry={entry}
            onList={onList}
            onUnlist={onUnlist}
          />
        ))}
      </ul>
    </div>
  );
}

function SpareListingRow({ entry, onList, onUnlist }) {
  const { card, owned, reserved, spare, listing } = entry;
  const [quantity, setQuantity] = useState(String(spare));
  const [price, setPrice] = useState(listing?.price ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const priceIsValid = /^\d+(\.\d{1,2})?$/.test(price) && Number(price) > 0;
  const quantityNumber = Number(quantity);
  const quantityIsValid =
    Number.isInteger(quantityNumber) &&
    quantityNumber >= 1 &&
    quantityNumber <= spare;

  async function handleList() {
    setError(null);
    setBusy(true);
    try {
      await onList(card, { quantity: quantityNumber, price });
    } catch (err) {
      setError(err.message || "Something went wrong listing this card.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlist() {
    setError(null);
    setBusy(true);
    try {
      await onUnlist(card, listing);
    } catch (err) {
      setError(err.message || "Something went wrong removing this listing.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex items-center gap-3 sm:w-64 sm:flex-shrink-0">
        {card.card_image ? (
          <div className="relative h-14 w-10 flex-shrink-0 overflow-hidden rounded border border-neutral-200 dark:border-neutral-700">
            <Image
              src={card.card_image}
              alt={card.card_name}
              fill
              sizes="40px"
              className="object-cover"
              unoptimized
            />
          </div>
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{card.card_name}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {card.card_set_id} &middot; own {owned}
            {reserved > 0 ? `, ${reserved} in deck` : ""} &middot; {spare}{" "}
            spare
          </p>
        </div>
      </div>

      {listing ? (
        <div className="flex flex-1 flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-400">
            Listed &middot; {listing.quantity}x @ £{listing.price}
          </span>
          <a
            href={listing.adminUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-neutral-600 underline hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
          >
            View on Shopify
          </a>
          <button
            type="button"
            onClick={handleUnlist}
            disabled={busy}
            className="ml-auto rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium hover:bg-neutral-100 disabled:cursor-default disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            {busy ? "Removing…" : "Unlist"}
          </button>
        </div>
      ) : (
        <div className="flex flex-1 flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              Qty
            </span>
            <input
              type="number"
              min={1}
              max={spare}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-16 rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-800"
            />
          </label>
          <label className="flex items-center gap-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              £
            </span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-20 rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-800"
            />
          </label>
          <button
            type="button"
            onClick={handleList}
            disabled={busy || !priceIsValid || !quantityIsValid}
            className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium hover:bg-neutral-100 disabled:cursor-default disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            {busy ? "Listing…" : "List for sale"}
          </button>
          {error && (
            <p className="w-full text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
