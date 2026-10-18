---
slug: max-serdiukov
byline: Max Serdiukov
corpus: single-author posts under landing/src/pages/blog/ whose byline is Max Serdiukov
# One post, so nothing is held out; expect.yaml marks the voice skip: true.
held-out: none
---

# Voice: max-serdiukov

How Max Serdiukov's posts read. This file describes, it does not rule: what a
post must contain is in the writing rules and the blog scope, and where a
habit below conflicts with them, the rules win. It is written from one post,
`semantic-search-with-pgvector.mdx` (2026-08-12), a technical explainer, so
every stat is that one post and nothing is held out.

## Register

- Second person throughout: 37 "you" sentences and one "we". The reader is a
  developer adding a feature to an app they already have.
- The longest sentences on the blog (median 18 words), each one explaining
  why as well as what. Calm and exact; no exclamation, no hype.

## Opening move

- A concrete example of the problem before any definition: a user types one
  phrase and the search should find a page that shares none of its words.
- Then one sentence on what the post walks through and with what tool.

## Structural habits

- `##` sections split into `###` subsections, in the order the reader builds
  the thing: the idea, the setup, the code, the tuning, the product.
- The concept comes before the code, and says so: "it's worth understanding
  how before writing any code".
- Each step is a sentence, a code block, and a sentence on the line that is
  not obvious.
- Limits are stated plainly near the end ("Two limits worth knowing"), and
  the post closes on a short paragraph with a sign-up link, with no
  conclusion heading.

## Formatting habits

- No bullet lists and no bold anywhere in the post.
- SQL blocks for every step (4.8 per 1k words), identifiers in backticks in
  the prose around them.
- Markdown links only, to an earlier post, the docs and the dashboard.

## Lexical tics

- Short summarizing sentences after a long explanation: "That's the whole
  idea: turn text into a position, then look for its neighbors."
- Anticipating the reader's objection: "looks redundant, and logically it
  is", "That's exact, and it gets slow".
- "turns out", "worth knowing", "comes down to".

## What Max's post never does

- Use "we" for the team or narrate how Nhost built something.
- Use lists, bold or exclamation marks.
- Promise more than the code shows; the trade-off of each choice is given
  (HNSW against IVFFlat, approximate against exact).

The post has one heading in the shape "What … actually means"; the blog
scope lists that shape as a tell of generated text, so new posts in this
voice name the idea plainly instead.

## Excerpts

Attributed by post; Markdown link markup is dropped, nothing else is.

- `semantic-search-with-pgvector.mdx`: "Semantic search matches on meaning
  instead of exact words. A user types "how do I cancel," and the search
  returns the page titled "ending your subscription," even though the two
  share no keywords at all."
- `semantic-search-with-pgvector.mdx`: "That's the whole idea: turn text
  into a position, then look for its neighbors."
- `semantic-search-with-pgvector.mdx`: "Without an index, a similarity
  search scans every row and measures the distance to each one. That's
  exact, and it gets slow as the table grows."
- `semantic-search-with-pgvector.mdx`: "The `WHERE documents.id IS NOT NULL`
  looks redundant, and logically it is."

## Stats

Measured over the corpus above at `79bfe1016b`: 1
document, 1465 words, 77 sentences.

| Stat | Value |
| --- | --- |
| Mean sentence length (words) | 19.0 |
| Median sentence length (words) | 18.0 |
| First person plural per second person | 0.03 (1 / 37) |
| Imperative openings | 1.3% |
| Questions | 0.0% |
| Headings per 1k words | 6.1 |
| Bold spans per 1k words | 0.0 |
| List items per 1k words | 0.0 |
| Code blocks per 1k words | 4.8 |
