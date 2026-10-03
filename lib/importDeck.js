import { getPrintTags } from "@/lib/optcg";
import { createEmptyDeck, isPlayableWithLeader } from "@/lib/deck";

/**
 * Turns a pasted deck list (e.g. copied from gumgum.gg, or the common
 * OPTCG Sim "4xOP01-016" format) into a deck object the builder can use.
 *
 * Deliberately forgiving about format, since different sites lay lists
 * out slightly differently. Each line is scanned for a card ID such as
 * OP01-016, ST10-005, EB01-012, PRB01-001 or P-001 and an optional copy
 * count. All of these are understood:
 *   4xOP01-016        4x OP01-016       4 OP01-016 Nami
 *   OP01-016 x4       OP01-016 (4)      1 x OP12-001 Leader
 * A line with an ID but no count counts as 1 copy. Alt-art suffixes like
 * "_p1" are ignored, since every printing shares the same card number.
 */

const CARD_ID = String.raw`([A-Z]{1,4}\d{0,2}-\d{3})(?:_[a-z]\d+)?`;
const COUNT_BEFORE = new RegExp(String.raw`(\d{1,2})\s*[xX×]?\s*` + CARD_ID, "i");
const COUNT_AFTER = new RegExp(CARD_ID + String.raw`\s*(?:[xX×]\s*(\d{1,2})|\((\d{1,2})\))`, "i");
const ID_ONLY = new RegExp(CARD_ID, "i");

export function parseDeckList(text) {
  const entries = []; // in pasted order, duplicates merged
  const byId = new Map();
  const unreadLines = [];

  for (const raw of text.split(/\r?\n|,|;/)) {
    const line = raw.trim();
    if (!line) continue;

    let id;
    let count;
    let m;
    if ((m = COUNT_BEFORE.exec(line))) {
      count = Number(m[1]);
      id = m[2];
    } else if ((m = COUNT_AFTER.exec(line))) {
      id = m[1];
      count = Number(m[2] ?? m[3]);
    } else if ((m = ID_ONLY.exec(line))) {
      id = m[1];
      count = 1;
    } else {
      // Headings like "Leader", "Characters (32)" etc. are fine to skip,
      // but keep them so the user can see if a real card line was missed.
      unreadLines.push(line);
      continue;
    }

    id = id.toUpperCase();
    if (!count) continue;
    if (byId.has(id)) {
      byId.get(id).count += count;
    } else {
      const entry = { cardSetId: id, count };
      byId.set(id, entry);
      entries.push(entry);
    }
  }

  return { entries, unreadLines };
}

/**
 * Builds a deck from pasted text against the loaded card data.
 * Returns { deck, messages } where messages are human-readable notes
 * about anything that couldn't be imported. deck is null if no Leader
 * was found (the builder can't hold a deck without one).
 */
export function importDeckList(text, allCards) {
  const { entries, unreadLines } = parseDeckList(text);
  const messages = [];

  const findCard = (cardSetId) => {
    const matches = allCards.filter((c) => c.card_set_id === cardSetId);
    return matches.find((c) => getPrintTags(c).length === 0) ?? matches[0];
  };

  const resolved = [];
  const unknown = [];
  for (const entry of entries) {
    const card = findCard(entry.cardSetId);
    if (card) resolved.push({ ...entry, card });
    else unknown.push(entry.cardSetId);
  }

  if (entries.length === 0) {
    return {
      deck: null,
      messages: ["No card IDs found. Paste a list with lines like \"4xOP01-016\"."],
    };
  }

  const leaders = resolved.filter((e) => e.card.card_type === "Leader");
  if (leaders.length === 0) {
    return {
      deck: null,
      messages: [
        "No Leader card found in the list, so the deck wasn't imported.",
        ...(unknown.length ? [`Not in the card database: ${unknown.join(", ")}.`] : []),
      ],
    };
  }
  const leader = leaders[0].card;
  if (leaders.length > 1) {
    messages.push(
      `More than one Leader in the list. Used ${leader.card_set_id} ${leader.card_name}; skipped ${leaders
        .slice(1)
        .map((e) => e.cardSetId)
        .join(", ")}.`
    );
  }

  const deck = createEmptyDeck();
  deck.leader = leader;
  const offColor = [];
  for (const entry of resolved) {
    if (entry.card.card_type === "Leader") continue;
    if (!isPlayableWithLeader(leader, entry.card)) {
      offColor.push(entry.cardSetId);
      continue;
    }
    deck.cards[entry.cardSetId] = { card: entry.card, count: entry.count };
  }

  if (unknown.length) {
    messages.push(`Not in the card database (skipped): ${unknown.join(", ")}.`);
  }
  if (offColor.length) {
    messages.push(
      `Don't share a color with the Leader (skipped): ${offColor.join(", ")}.`
    );
  }
  const ignored = unreadLines.filter((l) => /\d{3}/.test(l));
  if (ignored.length) {
    messages.push(`Couldn't read these lines: ${ignored.join(" | ")}.`);
  }

  return { deck, messages };
}

/**
 * The reverse of importDeckList: turns a deck into plain text in the
 * same "4xOP01-016" format, Leader first, then cards in card-number
 * order. Pasting this back into the import box rebuilds the same deck,
 * on any device or browser, and it's the format gumgum.gg and the
 * OPTCG Sim use, so lists can go the other way too.
 */
export function exportDeckList(deck) {
  const lines = [];
  if (deck.leader) lines.push(`1x${deck.leader.card_set_id}`);
  const entries = Object.values(deck.cards).sort((a, b) =>
    a.card.card_set_id.localeCompare(b.card.card_set_id)
  );
  for (const { card, count } of entries) {
    lines.push(`${count}x${card.card_set_id}`);
  }
  return lines.join("\n");
}
