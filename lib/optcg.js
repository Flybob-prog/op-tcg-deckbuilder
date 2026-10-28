/**
 * Data access layer for card data.
 *
 * This is the ONLY file that should know about the OPTCG API
 * (https://optcgapi.com). Every other part of the app (route handlers,
 * pages, components) should import from here instead of calling `fetch`
 * against optcgapi.com directly.
 *
 * The API is really several product lines under one host, each with its
 * own endpoint family: main/extra/premium booster sets
 * (/api/allSetCards/), starter decks (/api/allSTCards/), and promo cards
 * (/api/promos/...). By design, this catalogue only pulls from the first
 * two — main sets and starter decks. Promo cards (tournament winner/
 * judge/regional/championship prints, convention exclusives, etc.) are
 * deliberately left out; they're mostly reprints of existing cards under
 * a different name, and including them roughly doubled result counts
 * with duplicates. getAllCards() below fetches sets + starter decks and
 * merges them, so callers don't need to know they're separate endpoints.
 *
 * Why this matters: if we ever swap data sources (e.g. move to our own
 * database, a paid API, or a scraped dataset), we only need to rewrite
 * the functions in this file. Everything else keeps working as long as
 * these functions keep returning the same shape.
 *
 * ---
 *
 * A note on filtering: the OPTCG API exposes a `/api/sets/filtered/`
 * endpoint, but its query-parameter names aren't publicly documented
 * anywhere we could confirm, so we don't depend on it. Instead, we fetch
 * the full card list once (cached — see CACHE below) and filter it
 * in-memory with `filterCards`. The card set is only a few thousand
 * cards, so this is fast and avoids guessing at an undocumented contract.
 * If `/api/sets/filtered/`'s params get confirmed later, swap the
 * implementation of `searchCards` below without touching any callers.
 */

const BASE_URL = "https://www.optcgapi.com/api";

// The fixed set of real card colors in the OPTCG. Used to sanity-check
// values that come out of card_color — the API's scraped data has a
// handful of malformed rows (see filterCards' color-splitting note), and
// at least one produces a stray non-color token if you naively collect
// every whitespace-separated piece of every card's card_color field.
// Filtering against this known-good list keeps that out of the UI
// regardless of the exact row responsible.
export const KNOWN_COLORS = ["Black", "Blue", "Green", "Purple", "Red", "Yellow"];

// Special prints (parallels, alternate art, manga art, SP chase cards,
// gold chase cards) are NOT tagged with their own `rarity` value in this
// API — confirmed by pulling real cards: "Sanji (SP)" and
// "Monkey.D.Luffy (119) (SP) (Gold)" both carry rarity "SEC", same as
// their base printing. The only place the print type shows up is as a
// parenthetical suffix on card_name. This is the fixed, known vocabulary
// of suffixes the API uses, in the order they tend to appear.
export const KNOWN_PRINT_TAGS = ["Parallel", "Alternate Art", "Manga", "SP", "Gold"];

/**
 * Which special-print tags apply to a card (a card can have more than
 * one, e.g. "(SP) (Gold)"). An empty array means it's a standard/base
 * printing.
 */
export function getPrintTags(card) {
  const name = card.card_name ?? "";
  return KNOWN_PRINT_TAGS.filter((tag) => name.includes(`(${tag})`));
}

// Unlike the print tags above, official rarity tiers ARE tagged
// correctly in the `rarity` field — including "TR" (Treasure Rare),
// confirmed with real cards like "Portgas.D.Ace (TR)" and "Vista (TR)".
// This is the known, fixed set of rarity codes used across main sets and
// starter decks. ("PR" also exists but only appears on promo cards,
// which this catalogue doesn't include — see the file-level note above.)
export const KNOWN_RARITIES = ["C", "UC", "R", "SR", "SEC", "L", "TR"];

// How long Next.js should cache responses from the OPTCG API, in seconds.
// Card data changes rarely (new sets, occasional price updates), so an
// hour is a safe balance between freshness and not hammering someone's
// personal VPS with requests.
const CACHE_SECONDS = 60 * 60;

/**
 * A single normalized card shape used throughout the app. Fields map
 * directly from the OPTCG API response, so this is mostly documentation
 * of what to expect:
 *
 * {
 *   card_set_id: "OP01-001",     // unique ID, e.g. set+number
 *   card_name: "Roronoa Zoro (001)",
 *   card_type: "Leader" | "Character" | "Event" | "Stage",
 *   card_color: "Red",           // dual-color cards are space-separated, e.g. "Green Red"
 *   card_cost: "3" | null,       // null for Leaders (they have no cost)
 *   card_power: "5000" | null,
 *   life: "5" | null,            // only Leaders have life
 *   counter_amount: "1000" | null,
 *   rarity: "L" | "C" | "UC" | "R" | "SR" | "SEC" | ...,
 *   card_text: "...",
 *   sub_types: "Straw Hat Crew Supernovas",
 *   attribute: "Slash" | "Strike" | ...,
 *   set_id: "OP-01",
 *   set_name: "Romance Dawn",
 *   card_image: "https://.../OP01-001.jpg",
 * }
 */

async function fetchJson(url, { cache = true } = {}) {
  // Next.js's built-in fetch cache (the `next.revalidate` option) has a
  // hard 2MB-per-entry limit. /api/allSetCards/ is well over that (~3MB+
  // and growing with every new set), so asking Next to cache it fails on
  // every request — this was showing up as console warnings and, worse,
  // seemed to be what was hanging the dev server. Pass `{ cache: false }`
  // for large responses to skip Next's cache entirely; see the
  // module-level cache in getAllCards() for how we cache those instead.
  const res = await fetch(
    url,
    cache ? { next: { revalidate: CACHE_SECONDS } } : { cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error(`OPTCG API request failed (${res.status}): ${url}`);
  }

  return res.json();
}

// Manual in-place cache for getAllCards(), since the merged
// sets+starter-decks result is too large for Next.js's built-in fetch
// cache to handle (see the note in fetchJson). This is just a
// module-level variable — it lives as long as the server process does,
// which is exactly what we want for a "don't hammer optcgapi.com on
// every page load" cache.
let allCardsCache = null; // { data, expiresAt }

/**
 * Fetch every card across every main/extra/premium set, plus every
 * starter deck. This is the base dataset that search/filtering is built
 * on top of. Deliberately excludes promo cards — see the file-level
 * note at the top of this file for why. Results are sorted (see
 * `sortCards`) so every consumer gets a consistent, sensible order
 * without having to remember to sort themselves.
 */
export async function getAllCards() {
  if (allCardsCache && allCardsCache.expiresAt > Date.now()) {
    return allCardsCache.data;
  }

  const [setCards, starterDeckCards] = await Promise.all([
    fetchJson(`${BASE_URL}/allSetCards/`, { cache: false }),
    fetchJson(`${BASE_URL}/allSTCards/`, { cache: false }),
  ]);
  const cards = [
    ...(Array.isArray(setCards) ? setCards : []),
    ...(Array.isArray(starterDeckCards) ? starterDeckCards : []),
  ];
  const sorted = sortCards(cards);

  allCardsCache = { data: sorted, expiresAt: Date.now() + CACHE_SECONDS * 1000 };
  return sorted;
}

/**
 * Look up a single card by its card_set_id (e.g. "OP01-001").
 * Returns an array because the API includes parallel/alt-art printings
 * of the same card under the same ID.
 */
export async function getCard(cardId) {
  if (!cardId) throw new Error("getCard requires a cardId");
  const cards = await fetchJson(
    `${BASE_URL}/sets/card/${encodeURIComponent(cardId)}/`
  );
  return Array.isArray(cards) ? cards : [];
}

/**
 * Filter an already-fetched card list in-memory.
 *
 * @param {Array} cards - full card list, e.g. from getAllCards()
 * @param {Object} filters
 * @param {string} [filters.name] - substring match against card_name OR card_set_id (case-insensitive), so "Buggy" and "OP16-041" both work
 * @param {string} [filters.color] - exact match against card_color (handles "Green Red" style dual-color leaders)
 * @param {string} [filters.cost] - exact match against card_cost
 * @param {string} [filters.type] - exact match against card_type
 * @param {string} [filters.trait] - substring match against sub_types (case-insensitive) — see note below
 * @param {string} [filters.printTag] - "Base" for standard prints, or one of KNOWN_PRINT_TAGS (e.g. "SP")
 * @param {string} [filters.rarity] - exact match against rarity (one of KNOWN_RARITIES, e.g. "TR")
 */
export function filterCards(cards, filters = {}) {
  const { name, color, cost, type, trait, printTag, rarity } = filters;

  return cards.filter((card) => {
    if (name) {
      const query = name.toLowerCase();
      const matchesName = card.card_name?.toLowerCase().includes(query);
      const matchesId = card.card_set_id?.toLowerCase().includes(query);
      if (!matchesName && !matchesId) return false;
    }
    if (color && !card.card_color?.split(/\s+/).includes(color)) {
      return false;
    }
    if (cost && String(card.card_cost) !== String(cost)) {
      return false;
    }
    if (type && card.card_type !== type) {
      return false;
    }
    // sub_types packs multiple traits into one string with no delimiter,
    // e.g. "Straw Hat Crew Supernovas" is really two traits: "Straw Hat
    // Crew" and "Supernovas". Since traits themselves contain spaces,
    // there's no reliable way to split that into a clean list — so
    // instead of an exact-match dropdown, this is a substring search
    // (same idea as the name search above).
    if (
      trait &&
      !card.sub_types?.toLowerCase().includes(trait.toLowerCase())
    ) {
      return false;
    }
    if (printTag) {
      const tags = getPrintTags(card);
      const matches =
        printTag === "Base" ? tags.length === 0 : tags.includes(printTag);
      if (!matches) return false;
    }
    if (rarity && card.rarity !== rarity) {
      return false;
    }
    return true;
  });
}

/**
 * Parses a card_set_id like "OP01-121" into sortable parts.
 * Falls back gracefully for anything that doesn't match the pattern.
 */
function parseCardSetId(cardSetId) {
  const match = /^([A-Za-z]+)0*(\d+)-0*(\d+)$/.exec(cardSetId ?? "");
  if (!match) return { prefix: cardSetId ?? "", setNum: 0, cardNum: 0 };
  const [, prefix, setNum, cardNum] = match;
  return { prefix, setNum: Number(setNum), cardNum: Number(cardNum) };
}

/**
 * Alt-art printings (parallels, manga art, etc.) share the SAME
 * card_set_id as the base card — the API only distinguishes them via
 * card_image_id, which gets a "_p1", "_p2", ... suffix per variant
 * (confirmed by inspecting real API responses, e.g. "OP01-120_p2" is
 * Shanks' manga alternate art, and "ST13-010_p1" is a starter deck
 * card's parallel). The base printing's card_image_id has no suffix at
 * all. This gives each variant a sort rank so alt arts land right after
 * their base card instead of scattered elsewhere.
 */
function variantRank(card) {
  if (!card.card_image_id || card.card_image_id === card.card_set_id) {
    return 0; // base printing
  }
  const match = /_p(\d+)/.exec(card.card_image_id);
  return match ? Number(match[1]) : 99;
}

/**
 * Sorts cards into a sensible browsing order: by set (in release order,
 * as far as the ID scheme allows), then by card number within the set,
 * then by variant (base printing, then parallel/alt-art/manga versions
 * in the order the API assigns them).
 *
 * Note: this sorts by ID scheme, not by a canonical release-date table,
 * so cross-product-line ordering (e.g. "EB" extra boosters vs "PRB"
 * premium boosters vs "ST" starter decks vs main "OP" sets) is
 * alphabetical by prefix rather than chronological. Within a single set
 * or deck it's exact.
 */
export function sortCards(cards) {
  return [...cards].sort((a, b) => {
    const pa = parseCardSetId(a.card_set_id);
    const pb = parseCardSetId(b.card_set_id);
    if (pa.prefix !== pb.prefix) return pa.prefix.localeCompare(pb.prefix);
    if (pa.setNum !== pb.setNum) return pa.setNum - pb.setNum;
    if (pa.cardNum !== pb.cardNum) return pa.cardNum - pb.cardNum;
    return variantRank(a) - variantRank(b);
  });
}

// Product lines in the order they're shown by sortCardsNewestFirst. Card
// IDs only give release order WITHIN a line (OP17 is newer than OP16),
// not across lines, so main sets come first, then extra boosters,
// premium boosters and starter decks. Unknown prefixes go last.
const NEWEST_FIRST_LINE_ORDER = ["OP", "EB", "PRB", "ST"];

/**
 * Like sortCards, but newest set first within each product line
 * (OP-17, OP-16, ... then EB, PRB, ST, each newest first). Card numbers
 * and printings inside a set stay in normal ascending order. Used by the
 * Deck Builder so the latest cards are at the top.
 */
export function sortCardsNewestFirst(cards) {
  const lineRank = (prefix) => {
    const i = NEWEST_FIRST_LINE_ORDER.indexOf(prefix.toUpperCase());
    return i === -1 ? NEWEST_FIRST_LINE_ORDER.length : i;
  };
  return [...cards].sort((a, b) => {
    const pa = parseCardSetId(a.card_set_id);
    const pb = parseCardSetId(b.card_set_id);
    if (pa.prefix !== pb.prefix) {
      return lineRank(pa.prefix) - lineRank(pb.prefix) || pa.prefix.localeCompare(pb.prefix);
    }
    if (pa.setNum !== pb.setNum) return pb.setNum - pa.setNum;
    if (pa.cardNum !== pb.cardNum) return pa.cardNum - pb.cardNum;
    return variantRank(a) - variantRank(b);
  });
}

/**
 * Fetch + filter in one call. Currently implemented as
 * getAllCards() + filterCards() (see note at top of file).
 */
export async function searchCards(filters = {}) {
  const cards = await getAllCards();
  return filterCards(cards, filters);
}
