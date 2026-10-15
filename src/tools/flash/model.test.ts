import { describe, expect, it } from "vitest";
import { decodeDeck, decodeProfile, deckId, nextCard } from "./model.ts";
import type { Profile } from "./model.ts";

const deck = decodeDeck({
  title: "Test",
  cards: [
    { id: "a", front: "A?", back: "A!" },
    { id: "b", front: "B?", back: "B!" },
  ],
});
const profile: Profile = { v: 1, name: "Learner", deck: "secret", reviews: [] };

describe("Flash data", () => {
  it("round trips a profile and retains display times and ratings", () => {
    const saved: Profile = {
      ...profile,
      reviews: [{ deck: "secret", card: "a", shownAt: 100, ratedAt: 200, rating: 3 }],
    };
    expect(decodeProfile(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    expect(nextCard(deck, saved).id).toBe("b");
  });
  it("cycles and ignores reviews from another deck", () => {
    expect(nextCard(deck, profile).id).toBe("a");
    expect(
      nextCard(deck, {
        ...profile,
        reviews: [
          { deck: "secret", card: "b", shownAt: 0, ratedAt: 1, rating: 1 },
          { deck: "other", card: "a", shownAt: 2, ratedAt: 3, rating: 4 },
        ],
      }).id,
    ).toBe("a");
  });
  it("rejects malformed decks and unsafe paths", () => {
    for (const id of ["../secret", "a/b", "", "x?y", "x".repeat(129)])
      expect(() => deckId(id)).toThrow();
    for (const value of [
      null,
      { title: "T", cards: [] },
      { title: "T", cards: [deck.cards[0], deck.cards[0]] },
      { title: "T", cards: [{ id: "a", front: 1, back: "B" }] },
    ])
      expect(() => decodeDeck(value)).toThrow();
  });
  it("rejects unknown versions and corrupt history", () => {
    expect(() => decodeProfile({ ...profile, v: 2 })).toThrow();
    for (const changes of [{ rating: 5 }, { shownAt: -1 }, { ratedAt: 0 }, { card: "" }]) {
      expect(() =>
        decodeProfile({
          ...profile,
          reviews: [{ deck: "secret", card: "a", shownAt: 1, ratedAt: 2, rating: 1, ...changes }],
        }),
      ).toThrow();
    }
  });
});
