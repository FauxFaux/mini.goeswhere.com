import { useEffect, useRef, useState } from "preact/hooks";
import { decodeDeck, decodeProfile, deckId, nextCard, STORAGE_KEY } from "./model.ts";
import type { Deck, Profile, Rating } from "./model.ts";
import "./style.css";

function readProfile(): { profile: Profile | null; error: string } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return { profile: saved === null ? null : decodeProfile(JSON.parse(saved)), error: "" };
  } catch {
    return {
      profile: null,
      error:
        "Your local profile could not be read. It has been preserved. Restore it before continuing, or explicitly replace it below.",
    };
  }
}

export function Flash() {
  const [initial] = useState(readProfile);
  const [profile, setProfile] = useState(initial.profile);
  const [error, setError] = useState(initial.error);
  const [name, setName] = useState(initial.profile?.name ?? "");
  const [identifier, setIdentifier] = useState(initial.profile?.deck ?? "");
  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [shownAt, setShownAt] = useState(0);
  const [retry, setRetry] = useState(0);
  const ratingLock = useRef(false);
  const card = profile && deck ? nextCard(deck, profile) : null;

  function save(updated: Profile) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setProfile(updated);
      setError("");
      return true;
    } catch {
      setError(
        "Could not save your profile. Check that browser storage is available and has space; your review has not advanced.",
      );
      return false;
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    setDeck(null);
    if (!profile) return;
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}flash/${profile.deck}.json`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Deck request failed (${response.status}).`);
        const loaded = decodeDeck(await response.json());
        if (!controller.signal.aborted) {
          setRevealed(false);
          setShownAt(Date.now());
          setDeck(loaded);
        }
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(
            `Could not load this deck. Check the identifier and try again. ${cause instanceof Error ? cause.message : ""}`,
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [profile?.deck, retry]);

  function rate(rating: Rating) {
    if (!profile || !card || !revealed || ratingLock.current) return;
    ratingLock.current = true;
    const updated: Profile = {
      ...profile,
      reviews: [
        ...profile.reviews,
        {
          deck: profile.deck,
          card: card.id,
          shownAt,
          ratedAt: Math.max(shownAt, Date.now()),
          rating,
        },
      ],
    };
    if (save(updated)) {
      setRevealed(false);
      setShownAt(Date.now());
    }
    ratingLock.current = false;
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        (target instanceof HTMLElement &&
          (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)))
      )
        return;
      if (revealed && ["1", "2", "3", "4"].includes(event.key)) {
        event.preventDefault();
        rate(Number(event.key) as Rating);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div class="flash">
      <h1>Flash</h1>
      <p class="muted">Your profile and review history are saved in this browser.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          try {
            if (!name.trim() || name.length > 100) throw new Error("Enter a profile name.");
            const selected = deckId(identifier.trim());
            if (
              save({ v: 1, name: name.trim(), deck: selected, reviews: profile?.reviews ?? [] })
            ) {
              setRevealed(false);
              setShownAt(Date.now());
            }
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Invalid profile.");
          }
        }}
      >
        <label>
          Profile name{" "}
          <input
            value={name}
            maxLength={100}
            required
            onInput={(event) => setName(event.currentTarget.value)}
          />
        </label>
        <label>
          Deck identifier{" "}
          <input
            value={identifier}
            maxLength={128}
            required
            pattern="[a-zA-Z0-9_-]+"
            autoComplete="off"
            spellcheck={false}
            onInput={(event) => setIdentifier(event.currentTarget.value)}
          />
        </label>
        <button type="submit">
          {initial.error && !profile ? "Replace local profile" : "Save profile"}
        </button>
      </form>
      {error && (
        <p role="alert" class="error">
          {error}
        </p>
      )}
      {profile && !deck && !loading && (
        <button onClick={() => setRetry((value) => value + 1)}>Retry loading deck</button>
      )}
      {loading && <p role="status">Loading deck…</p>}
      {profile && deck && card && (
        <section aria-label="Flashcard">
          <h2>{deck.title}</h2>
          <p class="muted">
            {profile.name} · {deck.cards.length} cards ·{" "}
            {profile.reviews.filter((review) => review.deck === profile.deck).length} reviews
          </p>
          <div class="flash-card" aria-live="polite">
            <p>{card.front}</p>
            {revealed && (
              <>
                <hr />
                <p>{card.back}</p>
              </>
            )}
          </div>
          {!revealed ? (
            <button onClick={() => setRevealed(true)}>Show answer</button>
          ) : (
            <div class="flash-ratings">
              {(["Again", "Bad", "Okay", "Good"] as const).map((label, index) => (
                <button onClick={() => rate((index + 1) as Rating)}>
                  {index + 1} · {label}
                </button>
              ))}
            </div>
          )}
          <p class="muted">
            Reveal the answer, then rate it with 1–4 or the buttons. Cards currently cycle in deck
            order.
          </p>
        </section>
      )}
    </div>
  );
}
