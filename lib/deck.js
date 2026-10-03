/**
 * Deck-building rules, kept separate from lib/optcg.js on purpose:
 * optcg.js only knows how to fetch/shape card data, this file only knows
 * the rules for what makes a valid OPTCG deck. Neither depends on React
 * or the DOM, so both are easy to test on their own.
 *
 * Official OPTCG deck construction rules this encodes:
 *  - Exactly 1 Leader card, plus exactly 50 other cards.
 *  - Every non-Leader card must share at least one color with the Leader
 *    (Leaders can be dual-color, e.g. "Green Red" — a card matches if it
 *    has any color in common).
 *  - Max 4 copies of "the same card" — official rules define "same
 *    card" by card number, which is exactly our card_set_id. Different
 *    printings (parallel, manga, SP, etc.) of the same card_set_id all
 *    count toward the same 4-copy limit; a reprint under a NEW
 *    card_set_id in a later set counts separately, which matches the
 *    real rules.
 *  - EXCEPT: a handful of cards across different sets carry text like
 *    "you may have any number of this card in your deck" (confirmed on
 *    "Prisoner of Impel Down", OP16-042), which lifts the 4-copy limit
 *    for that specific card — the 50-card total limit still applies.
 *    There's no reliable list of exactly which cards these are (new
 *    ones can be printed in any future set), so hasUnlimitedCopies()
 *    below detects this from the card's own text instead of a
 *    hardcoded whitelist — same approach as getPrintTags() in
 *    lib/optcg.js for the same kind of reason.
 *  - Leader-type cards can never be included in the 50-card body, only
 *    as the deck's single Leader.
 *
 * A deck is represented as:
 * {
 *   leader: card | null,
 *   cards: { [card_set_id]: { count: number, card } }
 * }
 */

export const DECK_SIZE = 50;
export const MAX_COPIES = 4;

// Shared localStorage key for the deck-in-progress. Lives here (not in
// the page that first used it) so any other page — e.g. the recommended
// decks gallery loading a preset deck — writes to the exact same slot
// the deck builder reads from, instead of duplicating this string and
// risking a typo splitting them into two different keys.
export const STORAGE_KEY = "optcg-deck";

export function createEmptyDeck() {
  return { leader: null, cards: {} };
}

function cardColors(card) {
  return card.card_color?.split(/\s+/) ?? [];
}

// Phrases the OPTCG uses on cards that are exempt from the normal
// 4-copy limit. Matched case-insensitively against card_text. More than
// one phrasing is included since we've only confirmed one exact card's
// wording and can't rule out minor variations on others.
const UNLIMITED_COPIES_PHRASES = [
  "any number of this card in your deck",
  "any number of copies of this card in your deck",
];

export function hasUnlimitedCopies(card) {
  const text = card.card_text?.toLowerCase() ?? "";
  return UNLIMITED_COPIES_PHRASES.some((phrase) => text.includes(phrase));
}

/**
 * Whether `card` could ever go in the 50-card body of a deck led by
 * `leader`: it isn't a Leader itself and shares at least one color
 * with the Leader. Ignores copy counts and deck size, so it's the right
 * check for "should this card be shown at all" (the deck builder's
 * leader-color filter), as opposed to canAddCard's "can I add one more
 * right now".
 */
export function isPlayableWithLeader(leader, card) {
  if (!leader || card.card_type === "Leader") return false;
  const leaderColors = cardColors(leader);
  return cardColors(card).some((c) => leaderColors.includes(c));
}

/**
 * Whether `card` is legal to add to a deck led by `leader` — right
 * card_type, shares a color with the leader, not already at the 4-copy
 * cap (unless it's exempt — see hasUnlimitedCopies), and the deck isn't
 * already full. Returns { ok, reason } so the UI can explain *why* a
 * card can't be added, not just that it can't.
 */
export function canAddCard(deck, card) {
  if (!deck.leader) {
    return { ok: false, reason: "Pick a Leader first." };
  }
  if (card.card_type === "Leader") {
    return { ok: false, reason: "Leaders can't be added as regular cards." };
  }
  const leaderColors = cardColors(deck.leader);
  const shared = cardColors(card).some((c) => leaderColors.includes(c));
  if (!shared) {
    return {
      ok: false,
      reason: `Doesn't match your Leader's color (${deck.leader.card_color}).`,
    };
  }
  const current = deck.cards[card.card_set_id]?.count ?? 0;
  if (current >= MAX_COPIES && !hasUnlimitedCopies(card)) {
    return { ok: false, reason: `Already at the ${MAX_COPIES}-copy limit.` };
  }
  if (totalCardCount(deck) >= DECK_SIZE) {
    return { ok: false, reason: `Deck is full (${DECK_SIZE} cards).` };
  }
  return { ok: true, reason: null };
}

/** Returns a NEW deck with one more copy of `card`, or the same deck unchanged if canAddCard() would fail. */
export function addCard(deck, card) {
  if (!canAddCard(deck, card).ok) return deck;

  const existing = deck.cards[card.card_set_id];
  return {
    ...deck,
    cards: {
      ...deck.cards,
      [card.card_set_id]: {
        card,
        count: (existing?.count ?? 0) + 1,
      },
    },
  };
}

/** Returns a NEW deck with one fewer copy of the card at `cardSetId` (removing the entry entirely once it hits 0). */
export function removeCard(deck, cardSetId) {
  const existing = deck.cards[cardSetId];
  if (!existing) return deck;

  if (existing.count <= 1) {
    const { [cardSetId]: _removed, ...rest } = deck.cards;
    return { ...deck, cards: rest };
  }

  return {
    ...deck,
    cards: {
      ...deck.cards,
      [cardSetId]: { ...existing, count: existing.count - 1 },
    },
  };
}

/**
 * Sets the deck's Leader. Any already-added cards that no longer share a
 * color with the new Leader are dropped automatically — keeping an
 * "invalid" card sitting in the deck after a Leader change would just
 * be confusing, and there's nothing useful to do with it besides remove
 * it.
 */
export function setLeader(deck, leaderCard) {
  const newLeaderColors = cardColors(leaderCard);
  const cards = Object.fromEntries(
    Object.entries(deck.cards).filter(([, entry]) =>
      cardColors(entry.card).some((c) => newLeaderColors.includes(c))
    )
  );
  return { leader: leaderCard, cards };
}

export function clearDeck() {
  return createEmptyDeck();
}

export function totalCardCount(deck) {
  return Object.values(deck.cards).reduce((sum, entry) => sum + entry.count, 0);
}

/**
 * Returns { isComplete, issues } — issues is a list of human-readable
 * problems (empty when the deck is tournament-legal). isComplete is
 * true only when there are zero issues.
 */
export function validateDeck(deck) {
  const issues = [];

  if (!deck.leader) {
    issues.push("No Leader selected.");
  }

  const total = totalCardCount(deck);
  if (total < DECK_SIZE) {
    issues.push(`Deck has ${total}/${DECK_SIZE} cards — needs ${DECK_SIZE - total} more.`);
  } else if (total > DECK_SIZE) {
    issues.push(`Deck has ${total}/${DECK_SIZE} cards — ${total - DECK_SIZE} too many.`);
  }

  for (const { card, count } of Object.values(deck.cards)) {
    if (count > MAX_COPIES && !hasUnlimitedCopies(card)) {
      issues.push(`${card.card_name}: ${count} copies (max ${MAX_COPIES}).`);
    }
  }

  return { isComplete: issues.length === 0, issues };
}
