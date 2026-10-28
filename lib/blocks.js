import BLOCKS from "@/lib/blocks.json";

/**
 * Block icons (the numbered Devil Fruit symbol printed bottom-right on
 * each card, used for Standard format rotation).
 *
 * The OPTCG API doesn't include block icons, so lib/blocks.json is a
 * snapshot taken from Bandai's official English card list
 * (https://en.onepiece-cardgame.com/cardlist/), which shows the block
 * icon for every printing. Taken 2026-10-28, covering OP-01 to OP-17,
 * EB-01 to EB-05, PRB-01/02 and ST-01 to ST-36 (4,910 printings). It's
 * stored compactly:
 *  - sets: the block most cards in each set carry, e.g. "OP16": "5"
 *  - cards: base printings that differ from their set, e.g. OP05 Leaders
 *  - printings: alternate printings (card_image_id) that differ from the base
 *
 * Bandai's English list doesn't always agree with fan sites (e.g. it
 * shows OP-16 as block 5 and most of OP-05 as block 1). We follow
 * Bandai, since that's what's printed on the cards.
 *
 * Values are "1".."5", plus "X" and "-" exactly as Bandai shows them.
 * Cards from a set newer than the snapshot return null ("not known yet")
 * until blocks.json is refreshed.
 */

/** The block icon for a card printing, as a string ("1".."5", "X", "-"), or null if unknown. */
export function getBlock(card) {
  if (!card) return null;
  const imageId = card.card_image_id;
  if (imageId && BLOCKS.printings[imageId]) return BLOCKS.printings[imageId];
  if (BLOCKS.cards[card.card_set_id]) return BLOCKS.cards[card.card_set_id];
  const setPrefix = (card.card_set_id ?? "").split("-")[0].toUpperCase();
  return BLOCKS.sets[setPrefix] ?? null;
}

/** Numeric block for sorting: 1..5, with "X", "-" and unknown sorted after all numbers. */
export function blockSortValue(card) {
  const n = Number(getBlock(card));
  return Number.isFinite(n) && n > 0 ? n : Infinity;
}

/** Every block value present in a card list, numbers first, for the filter dropdown. */
export function blockOptions(cards) {
  const found = new Set(cards.map(getBlock).filter(Boolean));
  return [...found].sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    if (Number.isFinite(na)) return -1;
    if (Number.isFinite(nb)) return 1;
    return a.localeCompare(b);
  });
}

/** Printed power as a number, or null for cards without power (Events, Stages). */
export function powerValue(card) {
  const n = Number(card.card_power);
  return card.card_power !== null && card.card_power !== "" && Number.isFinite(n) ? n : null;
}
