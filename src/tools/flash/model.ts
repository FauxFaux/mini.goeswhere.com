export const STORAGE_KEY = "mini.flash.profile";
export const DECK_ID = /^[a-zA-Z0-9_-]{1,128}$/;

export type Rating = 1 | 2 | 3 | 4;
export type Card = { id: string; front: string; back: string };
export type Deck = { title: string; cards: Card[] };
export type Review = {
  deck: string;
  card: string;
  shownAt: number;
  ratedAt: number;
  rating: Rating;
};
export type Profile = { v: 1; name: string; deck: string; reviews: Review[] };

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected an object.");
  return value as Record<string, unknown>;
}

function string(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new Error("Invalid text.");
  return value;
}

export function deckId(value: unknown): string {
  if (typeof value !== "string" || !DECK_ID.test(value))
    throw new Error(
      "Deck identifiers must contain 1–128 letters, numbers, underscores or hyphens.",
    );
  return value;
}

export function decodeDeck(value: unknown): Deck {
  const data = object(value);
  if (!Array.isArray(data.cards) || !data.cards.length || data.cards.length > 10000)
    throw new Error("A deck must contain 1–10,000 cards.");
  const ids = new Set<string>();
  const cards = data.cards.map((value) => {
    const card = object(value);
    const id = string(card.id, 128);
    if (ids.has(id)) throw new Error("Duplicate card identifier.");
    ids.add(id);
    return { id, front: string(card.front, 20000), back: string(card.back, 20000) };
  });
  return { title: string(data.title, 200), cards };
}

export function decodeProfile(value: unknown): Profile {
  const data = object(value);
  if (data.v !== 1) throw new Error("Unknown Flash profile version.");
  if (!Array.isArray(data.reviews)) throw new Error("Invalid review history.");
  const reviews = data.reviews.map((value): Review => {
    const review = object(value);
    const { shownAt, ratedAt, rating } = review;
    if (
      typeof shownAt !== "number" ||
      !Number.isSafeInteger(shownAt) ||
      shownAt < 0 ||
      typeof ratedAt !== "number" ||
      !Number.isSafeInteger(ratedAt) ||
      ratedAt < shownAt ||
      (rating !== 1 && rating !== 2 && rating !== 3 && rating !== 4)
    )
      throw new Error("Invalid review.");
    return { deck: deckId(review.deck), card: string(review.card, 128), shownAt, ratedAt, rating };
  });
  return { v: 1, name: string(data.name, 100), deck: deckId(data.deck), reviews };
}

/** Initial policy: resume after the last reviewed card, then cycle in deck order. */
export function nextCard(deck: Deck, profile: Profile): Card {
  const last = profile.reviews.findLast((review) => review.deck === profile.deck);
  const index = last ? deck.cards.findIndex((card) => card.id === last.card) : -1;
  return deck.cards[(index + 1) % deck.cards.length]!;
}
