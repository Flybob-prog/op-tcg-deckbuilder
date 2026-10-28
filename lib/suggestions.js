import { getPrintTags } from "@/lib/optcg";
import {
  DECK_SIZE,
  MAX_COPIES,
  hasUnlimitedCopies,
  isPlayableWithLeader,
  totalCardCount,
} from "@/lib/deck";
import { RECOMMENDED_DECKS } from "@/lib/recommendedDecks";

/**
 * Card suggestions and deck health tips for the deck builder.
 *
 * Same principle as lib/recommendedDecks.js: nothing here comes from
 * tournament results, meta tier lists, or an AI. Every suggestion is
 * worked out from two things only:
 *
 *  1. The cards' own printed text and types (from the OPTCG API), e.g.
 *     Buggy's Leader effect mentions "Cross Guild" type cards, so
 *     Cross Guild cards rank highly for that Leader.
 *  2. The hand-curated decklists in lib/recommendedDecks.js, e.g. if a
 *     recommended deck for this Leader runs a card, that card is
 *     suggested with the deck's name as the reason.
 *
 * Every suggestion carries a list of plain-English `reasons`, so the UI
 * can always say *why* a card was suggested. Pure functions only (no
 * React, no DOM), same as lib/deck.js.
 */

// ---------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------

function normalizeText(text) {
  // The API mostly uses straight quotes, but normalise curly ones just
  // in case a scraped row uses them.
  return (text ?? "").replace(/[“”]/g, '"').replace(/−/g, "-");
}

/**
 * A card's name without its printing suffixes, e.g.
 * "Monkey.D.Luffy (119) (SP)" -> "Monkey.D.Luffy" and
 * "Roronoa Zoro - OP01-001 (Alternate Art)" -> "Roronoa Zoro".
 */
export function baseName(card) {
  return (card.card_name ?? "")
    .replace(/\s*\(.*$/, "")
    .replace(/\s+-\s+[A-Z]+\d*-\d+.*$/, "")
    .trim();
}

/**
 * Types a piece of card text refers to. The OPTCG always prints these
 * in quotes followed by "type" ("Cross Guild" type), or as
 * 'a type including "Whitebeard Pirates"'.
 */
export function typesMentionedIn(text) {
  const found = new Set();
  const clean = normalizeText(text);
  for (const m of clean.matchAll(/"([^"]+)"\s+type/gi)) found.add(m[1].trim());
  for (const m of clean.matchAll(/type\s+including\s+"([^"]+)"/gi)) {
    found.add(m[1].trim());
  }
  return found;
}

/** Card names a piece of text refers to in [square brackets], e.g. [Perona]. */
function namesMentionedIn(text, knownNames) {
  const found = new Set();
  for (const m of normalizeText(text).matchAll(/\[([^\]]+)\]/g)) {
    const name = m[1].trim();
    // Brackets are also used for keywords like [On Play] or [Blocker].
    // Only keep it if a real card actually has that name.
    if (knownNames.has(name.toLowerCase())) found.add(name);
  }
  return found;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * sub_types is a space-separated string ("Straw Hat Crew Supernovas"),
 * which can't be split reliably because most types are several words
 * long. Instead we match it against a vocabulary of every type that any
 * card's text mentions (see buildCardIndex), longest first.
 */
function typesOfCard(card, typeVocab) {
  const subTypes = card.sub_types ?? "";
  const found = new Set();
  if (!subTypes) return found;
  for (const { type, regex } of typeVocab) {
    if (regex.test(subTypes)) found.add(type);
  }
  return found;
}

// ---------------------------------------------------------------------
// Mechanics ("themes")
// ---------------------------------------------------------------------

/**
 * Mechanics a Leader can build around. If the Leader's text and a
 * card's text both match the same theme, that's a (weaker) reason to
 * suggest the card. Kept deliberately specific so general words like
 * "draw" don't match half the card pool.
 */
const THEMES = [
  {
    id: "trash",
    label: "Uses the trash, like your Leader",
    regex: /from your trash|cards? in your trash|trash \d+ cards? from the top of your deck/i,
  },
  {
    id: "don-minus",
    label: "DON!! minus synergy, like your Leader",
    regex: /DON!!\s*-\s*\d|returned to your DON!! deck|return \d+ (of your )?DON!!/i,
  },
  {
    id: "life",
    label: "Works with Life cards, like your Leader",
    regex: /Life cards?/i,
  },
  {
    id: "rest",
    label: "Rests your opponent's cards, like your Leader",
    regex: /rest up to \d+ of your opponent's|opponent's rested/i,
  },
  {
    id: "bounce",
    label: "Returns cards to hand, like your Leader",
    regex: /return[^.]*to (the owner's|their owner's) hand/i,
  },
  {
    id: "bottom-deck",
    label: "Places cards at the bottom of the deck, like your Leader",
    regex: /at the bottom of (the owner's|their owner's) deck/i,
  },
  {
    id: "events",
    label: "Event card, which your Leader's effect uses",
    leaderRegex: /\bEvents?\b/,
    cardTest: (card) => card.card_type === "Event",
  },
  {
    id: "blocker",
    label: "[Blocker], which your Leader's effect mentions",
    regex: /\[Blocker\]/,
  },
  {
    id: "trigger",
    label: "[Trigger], which your Leader's effect mentions",
    regex: /\[Trigger\]/,
  },
];

function themesOfText(text) {
  const clean = normalizeText(text);
  return THEMES.filter((t) => (t.leaderRegex ?? t.regex).test(clean));
}

function cardMatchesTheme(card, theme) {
  if (theme.cardTest) return theme.cardTest(card);
  return theme.regex.test(normalizeText(card.card_text));
}

// ---------------------------------------------------------------------
// Card index (built once per card list)
// ---------------------------------------------------------------------

/**
 * Pre-computes everything that only depends on the full card list:
 * one representative printing per card_set_id (the base print, same
 * rule as resolveDeck in lib/recommendedDecks.js), the type vocabulary
 * and the set of real card names. Call once (e.g. in useMemo) and pass
 * the result to getSuggestions.
 */
export function buildCardIndex(allCards) {
  const byId = new Map();
  for (const card of allCards) {
    const existing = byId.get(card.card_set_id);
    if (!existing) {
      byId.set(card.card_set_id, card);
    } else if (
      getPrintTags(existing).length > 0 &&
      getPrintTags(card).length === 0
    ) {
      byId.set(card.card_set_id, card);
    }
  }

  const typeNames = new Set();
  const knownNames = new Set();
  for (const card of byId.values()) {
    for (const t of typesMentionedIn(card.card_text)) typeNames.add(t);
    const name = baseName(card);
    if (name) knownNames.add(name.toLowerCase());
  }

  // Longest first, so "Straw Hat Crew" wins over a hypothetical "Crew".
  const toVocab = (names) =>
    [...names]
      .sort((a, b) => b.length - a.length)
      .map((type) => ({
        type,
        regex: new RegExp(`(^|\\s)${escapeRegExp(type)}(\\s|$)`, "i"),
      }));

  // Some types are never quoted in any card's text (e.g. "Sky Island"),
  // so they aren't in the vocabulary yet. Whatever is left of a card's
  // sub_types after removing known types is added as one more type.
  const firstPass = toVocab(typeNames);
  for (const card of byId.values()) {
    let rest = ` ${card.sub_types ?? ""} `;
    for (const { type } of firstPass) {
      rest = rest.replace(
        new RegExp(`\\s${escapeRegExp(type)}(?=\\s)`, "gi"),
        " "
      );
    }
    rest = rest.trim().replace(/\s+/g, " ");
    if (rest) typeNames.add(rest);
  }
  const typeVocab = toVocab(typeNames);

  return { cards: [...byId.values()], byId, typeVocab, knownNames };
}

// ---------------------------------------------------------------------
// Leader profile
// ---------------------------------------------------------------------

/** What a Leader's own card says it wants. Shared by suggestions and health tips. */
export function leaderProfile(leader, index) {
  const text = leader?.card_text ?? "";
  return {
    name: leader ? baseName(leader) : "",
    // Types the Leader's effect explicitly asks for ("Cross Guild" type).
    calledTypes: typesMentionedIn(text),
    // Types printed on the Leader itself.
    ownTypes: leader ? typesOfCard(leader, index.typeVocab) : new Set(),
    // Specific cards the Leader's effect names, e.g. [Perona].
    namedCards: namesMentionedIn(text, index.knownNames),
    themes: themesOfText(text),
  };
}

// ---------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------

// Scores per reason. Higher = stronger. MIN_SCORE hides cards whose
// only link to the Leader is weak (e.g. one shared mechanic).
const SCORE = {
  curatedDeck: 6,
  namedByLeader: 5,
  calledType: 5,
  needsThisLeader: 5,
  needsLeaderType: 4,
  supportsCalledType: 2,
  sharesType: 2,
  sharesTypeOnly: 3,
  theme: 2,
};
const MAX_THEME_REASONS = 2;
export const MIN_SCORE = 3;

/**
 * Ranked card suggestions for the deck's Leader.
 *
 * Returns [{ card, score, reasons: string[] }], best first. Cards that
 * can't be played with the Leader, or that are already in the deck,
 * are left out.
 *
 * @param {object} deck - see lib/deck.js
 * @param {object} index - from buildCardIndex(allCards)
 * @param {object} [options]
 * @param {(card) => boolean} [options.filter] - extra filter, e.g. "only cards I own"
 */
export function getSuggestions(deck, index, { filter } = {}) {
  const leader = deck.leader;
  if (!leader) return [];

  const profile = leaderProfile(leader, index);
  const leaderNameLower = profile.name.toLowerCase();

  // Recommended decks for this exact Leader: cardSetId -> [deck names].
  const curated = new Map();
  for (const rec of RECOMMENDED_DECKS) {
    if (rec.leaderId !== leader.card_set_id) continue;
    for (const { cardSetId } of rec.cards) {
      if (!curated.has(cardSetId)) curated.set(cardSetId, []);
      curated.get(cardSetId).push(rec.name);
    }
  }

  const results = [];

  for (const card of index.cards) {
    if (!isPlayableWithLeader(leader, card)) continue;
    if (deck.cards[card.card_set_id]) continue;
    if (filter && !filter(card)) continue;

    const text = normalizeText(card.card_text);
    const types = typesOfCard(card, index.typeVocab);
    const mentioned = typesMentionedIn(text);
    let score = 0;
    const reasons = [];

    const deckNames = curated.get(card.card_set_id);
    if (deckNames) {
      score += SCORE.curatedDeck;
      reasons.push(`In our recommended deck: ${deckNames.join(", ")}`);
    }

    const cardNameLower = baseName(card).toLowerCase();
    if ([...profile.namedCards].some((n) => n.toLowerCase() === cardNameLower)) {
      score += SCORE.namedByLeader;
      reasons.push("Named in your Leader's effect");
    }

    const calledHits = [...profile.calledTypes].filter((t) => types.has(t));
    if (calledHits.length > 0) {
      score += SCORE.calledType;
      reasons.push(`"${calledHits.join('", "')}" type, which your Leader's effect uses`);
    }

    // "If your Leader is [Buggy]" style text.
    const namesLeader = [...text.matchAll(/Leader is \[([^\]]+)\]/gi)].some(
      (m) => m[1].trim().toLowerCase() === leaderNameLower
    );
    if (namesLeader) {
      score += SCORE.needsThisLeader;
      reasons.push(`Gets a bonus when your Leader is ${profile.name}`);
    }

    // 'If your Leader has the "Navy" type' style text.
    const leaderTypeNeeded = [
      ...text.matchAll(/Leader has the "([^"]+)" type|Leader's type includes "([^"]+)"/gi),
    ]
      .map((m) => (m[1] ?? m[2]).trim())
      .filter((t) => profile.ownTypes.has(t));
    if (leaderTypeNeeded.length > 0) {
      score += SCORE.needsLeaderType;
      reasons.push(`Needs a "${leaderTypeNeeded[0]}" Leader, which yours is`);
    }

    // The card's own effect works with a type the Leader asks for.
    const supportHits = [...profile.calledTypes].filter(
      (t) => mentioned.has(t) && !leaderTypeNeeded.includes(t)
    );
    if (supportHits.length > 0) {
      score += SCORE.supportsCalledType;
      reasons.push(`Effect supports "${supportHits[0]}" type cards`);
    }

    // Shares a printed type with the Leader (only counted when it isn't
    // already covered by the stronger "called type" reason above).
    const shared = [...profile.ownTypes].filter(
      (t) => types.has(t) && !calledHits.includes(t)
    );
    if (shared.length > 0) {
      // When the Leader's effect doesn't ask for any type (e.g. Zoro),
      // sharing its printed type is the best signal we have.
      score +=
        profile.calledTypes.size === 0 ? SCORE.sharesTypeOnly : SCORE.sharesType;
      reasons.push(`Shares the "${shared[0]}" type with your Leader`);
    }

    let themeReasons = 0;
    for (const theme of profile.themes) {
      if (themeReasons >= MAX_THEME_REASONS) break;
      if (cardMatchesTheme(card, theme)) {
        score += SCORE.theme;
        reasons.push(theme.label);
        themeReasons += 1;
      }
    }

    if (score >= MIN_SCORE) results.push({ card, score, reasons });
  }

  return results.sort(
    (a, b) =>
      b.score - a.score ||
      // Tie-break: cards with a counter value first, then by ID order.
      (Number(b.card.counter_amount) || 0) - (Number(a.card.counter_amount) || 0) ||
      a.card.card_set_id.localeCompare(b.card.card_set_id)
  );
}

// ---------------------------------------------------------------------
// Deck health
// ---------------------------------------------------------------------

/**
 * Rules of thumb used for the health tips. These are general
 * deck-building guidelines, not hard rules, and some decks break them on
 * purpose. All numbers are "per 50 cards" and get scaled down while the
 * deck is still being built. Tweak to taste.
 */
export const HEALTH_GUIDE = {
  minCounterCards: 15, // cards with a printed +1000/+2000 counter
  minEarlyPlays: 8, // cards costing 2 or less
  maxTopEnd: 10, // cards costing 7 or more
  maxSingleCopyCards: 5, // different cards run as a single copy
  minThemeShare: 0.5, // share of the deck matching the Leader's called type
  tipsFromCardCount: 20, // don't give ratio-based tips before this
};

function cost(card) {
  const n = Number(card.card_cost);
  return Number.isFinite(n) ? n : null;
}

/**
 * Stats and tips for the 50-card body of the deck.
 *
 * Returns {
 *   total, stats: { counterCards, counterEvents, blockers, triggers,
 *   characters, events, stages, avgCost }, curve: [{ label, count }],
 *   colors: [{ color, count }], tips: [{ kind: "tip" | "good" | "info", text }]
 * }
 */
export function getDeckHealth(deck, index) {
  const entries = Object.values(deck.cards);
  const total = totalCardCount(deck);
  const profile = deck.leader ? leaderProfile(deck.leader, index) : null;

  const stats = {
    counterCards: 0,
    counterEvents: 0,
    blockers: 0,
    triggers: 0,
    characters: 0,
    events: 0,
    stages: 0,
    avgCost: 0,
  };
  const curveCounts = Array(11).fill(0); // 0..9, then 10+
  const colorCounts = new Map();
  let costSum = 0;
  let costCards = 0;
  let themeCards = 0;
  let singleCopies = 0;

  for (const { card, count } of entries) {
    const text = normalizeText(card.card_text);
    if ((Number(card.counter_amount) || 0) > 0) stats.counterCards += count;
    if (card.card_type === "Event" && /\[Counter\]/i.test(text)) {
      stats.counterEvents += count;
    }
    if (/\[Blocker\]/.test(text)) stats.blockers += count;
    if (/\[Trigger\]/.test(text)) stats.triggers += count;
    if (card.card_type === "Character") stats.characters += count;
    if (card.card_type === "Event") stats.events += count;
    if (card.card_type === "Stage") stats.stages += count;

    const c = cost(card);
    if (c !== null) {
      curveCounts[Math.min(c, 10)] += count;
      costSum += c * count;
      costCards += count;
    }

    for (const color of card.card_color?.split(/\s+/) ?? []) {
      colorCounts.set(color, (colorCounts.get(color) ?? 0) + count);
    }

    if (profile && profile.calledTypes.size > 0) {
      const types = typesOfCard(card, index.typeVocab);
      if ([...profile.calledTypes].some((t) => types.has(t))) themeCards += count;
    }

    if (count === 1 && !hasUnlimitedCopies(card)) singleCopies += 1;
  }

  stats.avgCost = costCards ? Math.round((costSum / costCards) * 10) / 10 : 0;

  const curve = curveCounts.map((count, i) => ({
    label: i === 10 ? "10+" : String(i),
    count,
  }));

  const leaderColors = deck.leader?.card_color?.split(/\s+/) ?? [];
  const colors = leaderColors.map((color) => ({
    color,
    count: colorCounts.get(color) ?? 0,
  }));

  const tips = [];
  const g = HEALTH_GUIDE;

  if (total < g.tipsFromCardCount) {
    tips.push({
      kind: "info",
      text: `Add at least ${g.tipsFromCardCount} cards to get tips on balance. Stats below update as you go.`,
    });
    return { total, stats, curve, colors, tips };
  }

  // Scale "per 50" guidelines to the current deck size.
  const scale = Math.min(total, DECK_SIZE) / DECK_SIZE;
  const per50 = (n) => Math.round((n / Math.max(total, 1)) * DECK_SIZE);

  const counterTarget = Math.round(g.minCounterCards * scale);
  if (stats.counterCards < counterTarget) {
    tips.push({
      kind: "tip",
      text: `Only ${stats.counterCards} cards with a counter value (about ${per50(stats.counterCards)} per 50). Most decks run ${g.minCounterCards} or more so they can survive attacks.`,
    });
  } else {
    tips.push({
      kind: "good",
      text: `Counter count looks healthy: ${stats.counterCards} cards with a counter value${stats.counterEvents ? `, plus ${stats.counterEvents} Counter Events` : ""}.`,
    });
  }

  const early = curveCounts.slice(0, 3).reduce((a, b) => a + b, 0);
  if (early < Math.round(g.minEarlyPlays * scale)) {
    tips.push({
      kind: "tip",
      text: `Only ${early} cards cost 2 or less. A few more early plays help you use your DON!! on turns 1 and 2.`,
    });
  }

  const topEnd = curveCounts.slice(7).reduce((a, b) => a + b, 0);
  if (topEnd > Math.round(g.maxTopEnd * scale)) {
    tips.push({
      kind: "tip",
      text: `${topEnd} cards cost 7 or more, which is quite top-heavy. You may draw them before you can play them.`,
    });
  }

  for (let c = 3; c <= 6; c++) {
    if (curveCounts[c] === 0) {
      tips.push({
        kind: "tip",
        text: `Nothing at cost ${c}. A gap in the middle of the curve can leave a turn with nothing good to play.`,
      });
      break;
    }
  }

  if (stats.blockers === 0) {
    tips.push({
      kind: "tip",
      text: "No [Blocker] cards. Fine for an all-out aggro deck, but most decks run a few to protect their Leader.",
    });
  }

  if (singleCopies > g.maxSingleCopyCards) {
    tips.push({
      kind: "tip",
      text: `${singleCopies} different cards at a single copy. Running ${MAX_COPIES} copies of your key cards makes them much easier to draw.`,
    });
  }

  if (profile && profile.calledTypes.size > 0) {
    const typeList = [...profile.calledTypes].map((t) => `"${t}"`).join(" / ");
    if (themeCards / total < g.minThemeShare) {
      tips.push({
        kind: "tip",
        text: `Your Leader's effect uses ${typeList} type cards, but only ${themeCards} of your ${total} cards are that type. Check the Suggested cards tab for more.`,
      });
    } else {
      tips.push({
        kind: "good",
        text: `${themeCards} of your ${total} cards are ${typeList} type, which suits your Leader.`,
      });
    }
  }

  if (colors.length > 1) {
    const missing = colors.filter((c) => c.count === 0);
    if (missing.length > 0) {
      tips.push({
        kind: "tip",
        text: `No ${missing.map((c) => c.color).join(" or ")} cards yet. Your Leader is ${colors.map((c) => c.color).join("/")}, so you can use both colors.`,
      });
    }
  }

  return { total, stats, curve, colors, tips };
}
