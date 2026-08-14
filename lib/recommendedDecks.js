import { getPrintTags } from "@/lib/optcg";

/**
 * Hand-curated decks shown on the "Recommended Decks" page.
 *
 * Deliberately NOT pulled from tournament results, meta-tier lists, or
 * generated automatically — same principle as the Shopify product
 * catalogue: this only ever contains decks a real person (Simon) has
 * chosen to recommend. Nothing here is invented, so it starts empty and
 * stays empty until real decklists are added below.
 *
 * Format — one object per deck:
 * {
 *   id: "unique-slug",        // used as the React key, keep it URL-safe
 *   name: "Display name",     // e.g. "Red Zoro Aggro"
 *   archetype: "Aggro",       // short free-text label, shown as a badge
 *   description: "A sentence or two about how the deck plays.",
 *   leaderId: "OP01-060",     // the Leader's card_set_id
 *   cards: [
 *     { cardSetId: "OP01-013", count: 4 },
 *     // ...list every other card + how many copies, should total 50
 *   ],
 * }
 *
 * card_set_id values are the same IDs shown under each card's image on
 * the Card Database page (e.g. "OP01-013") — no need to look anywhere
 * else to build a decklist.
 */
export const RECOMMENDED_DECKS = [
  {
    id: "buggy-impel-down-prisoners",
    name: "Impel Down Prisoner Swarm",
    archetype: "Combo / Swarm",
    description:
      "The aim of OP16-041 Buggy is to create an unstoppable, self-replenishing swarm of Prisoners that the opponent cannot efficiently remove, leading to repeated attacks and a guaranteed win through attrition.",
    leaderId: "OP16-041",
    cards: [
      { cardSetId: "OP16-054", count: 4 },
      { cardSetId: "OP16-055", count: 4 },
      { cardSetId: "OP16-045", count: 4 },
      { cardSetId: "OP16-056", count: 4 },
      { cardSetId: "OP16-048", count: 4 },
      { cardSetId: "OP07-056", count: 2 },
      { cardSetId: "OP06-058", count: 4 },
      { cardSetId: "OP13-057", count: 2 },
      { cardSetId: "OP16-042", count: 22 }, // Prisoner of Impel Down — exempt from the 4-copy limit, see lib/deck.js's hasUnlimitedCopies
    ],
  },
];

/**
 * Turns a RECOMMENDED_DECKS entry into real card objects by matching
 * against the already-fetched `allCards` list, so the UI can render
 * images/names instead of raw IDs.
 *
 * Some card_set_ids have multiple rows in the dataset (base printing +
 * alt-art/SP/manga variants — see lib/optcg.js's getPrintTags note), so
 * this prefers the base printing (no print tags) and only falls back to
 * whatever row exists if no base printing is found. Any cardSetId that
 * doesn't match a real card is silently dropped rather than crashing the
 * page — that shouldn't happen with real IDs, but a typo shouldn't take
 * the whole page down either.
 */
export function resolveDeck(deckDef, allCards) {
  const findCard = (cardSetId) => {
    const matches = allCards.filter((card) => card.card_set_id === cardSetId);
    return (
      matches.find((card) => getPrintTags(card).length === 0) ?? matches[0]
    );
  };

  const leaderCard = findCard(deckDef.leaderId);
  const cardEntries = deckDef.cards
    .map(({ cardSetId, count }) => ({ card: findCard(cardSetId), count }))
    .filter((entry) => Boolean(entry.card));
  const totalCount = cardEntries.reduce((sum, entry) => sum + entry.count, 0);

  return { ...deckDef, leaderCard, cardEntries, totalCount };
}
