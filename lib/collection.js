/**
 * Local "card collection" tracking — how many physical copies of each
 * card you own, kept in the browser the same way lib/deck.js keeps the
 * deck-in-progress (see STORAGE_KEY there). There's no account system
 * in this app, so this is the simplest thing that works for a single
 * person cataloguing their own binder on their own machine: a plain
 * object keyed by card_set_id, persisted to localStorage (see
 * hooks/useCollection.js for the load/save wiring).
 *
 * Deliberately keyed by card_set_id (the official "card number"), NOT
 * by the specific printing/variant (parallel, alt-art, manga, etc.) —
 * see getPrintTags() in lib/optcg.js. Two reasons: (1) most collectors
 * think in terms of "how many OP01-001s do I own" rather than tracking
 * each alt-art separately, and (2) the deck-legality rules in
 * lib/deck.js already treat every printing of a card_set_id as the same
 * card for the 4-copy limit, so this matches that same unit.
 *
 * Each entry also optionally tracks a Shopify "spare card for sale"
 * listing (see lib/shopify.js and app/collection/page.js) — so a
 * collection entry is one of:
 *
 *   number                        // legacy shape: just the owned count
 *   { owned: number, listing: null | {
 *       productId, handle, adminUrl,  // from lib/shopify.js's createCardListing()
 *       quantity, price,               // what you listed it at
 *     }
 *   }
 *
 * normalizeEntry() below folds both shapes into the object form so every
 * other function (and every caller) only ever has to deal with one
 * shape — old localStorage data from before Shopify listings existed
 * keeps working without a migration step.
 */

export const STORAGE_KEY = "optcg-collection";

export function createEmptyCollection() {
  return {};
}

function normalizeEntry(raw) {
  if (raw == null) return { owned: 0, listing: null };
  if (typeof raw === "number") return { owned: raw, listing: null };
  return { owned: raw.owned ?? 0, listing: raw.listing ?? null };
}

/** How many copies of `card` you own, 0 if it's never been recorded. */
export function getOwnedCount(collection, card) {
  return normalizeEntry(collection[card.card_set_id]).owned;
}

/** The Shopify listing for `card`, or null if it isn't currently listed. */
export function getListing(collection, card) {
  return normalizeEntry(collection[card.card_set_id]).listing;
}

/**
 * Returns a NEW collection with the owned count for `cardId` set to
 * `count`, clamped to >= 0, preserving any existing Shopify listing.
 * An entry with owned=0 and no listing is removed entirely rather than
 * stored as a zero, so an empty collection stays a genuinely empty
 * object instead of accumulating dead keys forever.
 */
export function setOwnedCount(collection, cardId, count) {
  const clamped = Math.max(0, Math.trunc(count) || 0);
  const current = normalizeEntry(collection[cardId]);

  if (clamped === 0 && !current.listing) {
    const { [cardId]: _removed, ...rest } = collection;
    return rest;
  }

  return {
    ...collection,
    [cardId]: { owned: clamped, listing: current.listing },
  };
}

/** Returns a NEW collection with one more owned copy of `card`. */
export function incrementOwned(collection, card) {
  return setOwnedCount(
    collection,
    card.card_set_id,
    getOwnedCount(collection, card) + 1
  );
}

/** Returns a NEW collection with one fewer owned copy of `card` (floor of 0). */
export function decrementOwned(collection, card) {
  return setOwnedCount(
    collection,
    card.card_set_id,
    getOwnedCount(collection, card) - 1
  );
}

/**
 * Returns a NEW collection with `card`'s Shopify listing set (pass an
 * object from lib/shopify.js's createCardListing(), plus the quantity/
 * price you listed it at) or cleared (pass null, e.g. after unlisting).
 * Preserves the owned count either way.
 */
export function setListing(collection, cardId, listing) {
  const current = normalizeEntry(collection[cardId]);

  if (listing == null && current.owned === 0) {
    const { [cardId]: _removed, ...rest } = collection;
    return rest;
  }

  return {
    ...collection,
    [cardId]: { owned: current.owned, listing },
  };
}

export function clearCollection() {
  return createEmptyCollection();
}

/** Number of distinct cards (by card_set_id) you own at least one copy of. */
export function totalUniqueOwned(collection) {
  return Object.keys(collection).filter(
    (id) => normalizeEntry(collection[id]).owned > 0
  ).length;
}

/** Total physical cards owned, summed across every card_set_id. */
export function totalCardsOwned(collection) {
  return Object.values(collection).reduce(
    (sum, entry) => sum + normalizeEntry(entry).owned,
    0
  );
}

/** Number of cards currently listed for sale on Shopify. */
export function totalListed(collection) {
  return Object.values(collection).filter(
    (entry) => normalizeEntry(entry).listing
  ).length;
}
