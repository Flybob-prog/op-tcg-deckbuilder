import { getPrintTags } from "@/lib/optcg";

/**
 * Derives the list of official Starter Decks straight from the already-
 * fetched card database, instead of a hand-maintained list.
 *
 * Every card whose set_id looks like "ST-01", "ST-02", etc. (see
 * lib/optcg.js — getAllCards() already merges in every card from
 * optcgapi.com's /api/allSTCards/ endpoint) belongs to a Starter Deck,
 * and that set's cards ARE the deck's unique card pool. So new Starter
 * Decks show up here automatically as soon as optcgapi.com has them —
 * no manual entry, and nothing to keep in sync by hand.
 *
 * Deliberately does NOT show copy counts (how many of each card ship in
 * the physical 51-card box). That number isn't published anywhere we
 * could verify — not by Bandai, not by the card API, not by any card-
 * tracking site (checked several while building this; the numbers we
 * did find for ST-01 were inconsistent and didn't even add up to 51).
 * Only the fixed set of UNIQUE cards in each deck is reliably known, so
 * that's all this shows. Same principle as recommendedDecks.js's file
 * note: nothing here should be invented.
 */
export function getStarterDecks(allCards) {
  const decks = new Map();

  for (const card of allCards) {
    if (!/^ST-\d+$/.test(card.set_id ?? "")) continue;
    if (getPrintTags(card).length > 0) continue; // base printings only

    if (!decks.has(card.set_id)) {
      decks.set(card.set_id, {
        setId: card.set_id,
        setName: card.set_name,
        leader: null,
        cards: [],
        cardIds: new Set(),
      });
    }
    const deck = decks.get(card.set_id);

    if (card.card_type === "Leader") {
      if (!deck.leader) deck.leader = card;
      continue;
    }

    // Guard against duplicate rows for the same card_set_id (shouldn't
    // happen for base printings, but cheap to be defensive about).
    if (deck.cardIds.has(card.card_set_id)) continue;
    deck.cardIds.add(card.card_set_id);
    deck.cards.push(card);
  }

  return Array.from(decks.values())
    .map(({ cardIds, ...deck }) => ({
      ...deck,
      cards: [...deck.cards].sort((a, b) =>
        a.card_set_id.localeCompare(b.card_set_id)
      ),
    }))
    // Newest deck first (ST-36, ST-35, ... ST-01).
    .sort((a, b) => Number(b.setId.slice(3)) - Number(a.setId.slice(3)));
}
