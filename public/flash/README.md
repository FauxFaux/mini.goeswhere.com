Flash decks
===========

Place each deck in `public/flash/<identifier>.json`. Identifiers contain 1–128
letters, numbers, underscores or hyphens. There is no deck index or discovery UI.
Files are public to anyone who knows their URL; this is not access control.

Deck format:

```json
{
  "title": "My deck",
  "cards": [{ "id": "stable-card-id", "front": "Question", "back": "Answer" }]
}
```

Use unique, stable card IDs, including when editing or reordering a deck. Text is
rendered as plain text, with line breaks preserved. A deck has 1–10,000 cards;
titles have at most 200 characters, IDs 128, and each face 20,000.

The `mini.flash.profile` localStorage entry contains version `v: 1`, a `name`,
the selected `deck` identifier, and `reviews`. Each review stores `deck`, `card`,
`shownAt` and `ratedAt` (Unix milliseconds), and `rating` (1 again, 2 bad, 3 okay,
4 good). Switching decks preserves history. The current policy resumes after
the last reviewed card and cycles in deck order. History supports a future
scheduler; no spaced repetition intervals are applied yet.
