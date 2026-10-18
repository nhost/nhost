---
slug: nuno-pato
byline: Nuno Pato
corpus: single-author posts under landing/src/pages/blog/ whose byline is Nuno Pato
held-out: landing/src/pages/blog/introducing-new-javascript-sdk.mdx
---

# Voice: nuno-pato

How Nuno Pato's posts read. This file describes; the writing rules and the
blog scope decide, and win where a habit below conflicts with them. Written
from 23 public single-author posts, 2022 to 2025, mostly announcements.

## Register

- The team is "we" and the reader is "you", about two to three. As CEO he
  also speaks for himself: "I'm excited", "I believe", "let me know".
- Short, direct, upbeat sentences (median 13 words): a founder telling users
  what is new and why it helps them.
- Opening move: the first paragraph names the release (15 of 23 posts),
  often with "We're excited to" (10 of 23): "We're excited to introduce X",
  "Today we're releasing X, a <one-line definition>", then who it helps. A post driven by outside news
  opens on the fact: a price change, a protocol, a compliance result.

## Structural habits

- The most headings of any blog voice (12.5 per 1k words). Headings are
  questions or short labels in the reader's words: "What is X?", "How it
  works", "How do you use it?", "What's Next?".
- An announcement runs: what it is, how it works, how to use it, pricing or
  limits, what comes next.
- Lists are frequent (19.5 items per 1k words): benefits, steps, what a
  feature does.
- About half the posts (10 of 23) end with a request for feedback, often
  under "Wrap up" or "Conclusion"; under the blog scope the closing
  paragraph carries it without that heading.

## Formatting habits

- The feature's name in bold on first mention (9.3 bold spans per 1k words).
- Links to earlier posts in a series (Dedicated Compute, Service Replicas,
  Metrics) and to the docs page for the feature.
- Few code blocks (2.6 per 1k words, the fewest of the blog voices); one
  emoji sign-off in the corpus ("Happy building! 🛠️").

## Lexical tics

- "We're excited to", "As always", "don't hesitate to reach out". His "powerful" and "game-changing" are banned by the rules:
  the enthusiasm goes in the verbs and the facts instead.

## What Nuno's posts never do

- Narrate an engineering investigation; that is David's register.
- Bury the release under background, or hedge: a limitation is stated
  plainly, often as "What's Next?".

## Excerpts

Attributed by post; Markdown link markup is dropped, nothing else is.

- `assistants-file-stores.mdx`: "Today we're releasing File Stores, a simple
  way to augment your Nhost AI Assistants with knowledge from documents in
  Nhost Storage."
- `elevated-permissions.mdx`: "Sometimes we want to add an extra layer of
  security for specific bits of data or certain user workflows like changing
  a user email or resetting a password."
- `nhost-achieves-soc2-compliance.mdx`: "We're excited to share that Nhost
  has achieved **SOC 2 Type II compliance**. This is a big deal for us and
  for anyone building applications on Nhost, especially if you're working
  with enterprise customers or handling sensitive data."
- `organization-billing.mdx`: "If you have any questions, don't hesitate to
  let me know."

## Corpus

`.mdx` under `landing/src/pages/blog/`, held-out excluded: `ai-week-release-day`,
`assistants-file-stores`, `auto-embeddings`, `config`, `dashboard-improvements`,
`dedicated-compute`, `dev-assistant`, `docs-and-chatgpt`, `elevated-permissions`,
`introducing-nhost-mcp-server`, `ipv6`, `metrics`, `new-region-oregon`,
`nhost-achieves-soc2-compliance`, `nhost-assistants`,
`nhost-understanding-the-basics`, `nhost-vs-supabase-practical-guide-for-growing-teams`,
`organization-billing`, `point-in-time-recovery`, `rate-limiting`,
`run-publicly-available`, `run`, `service-replicas`.

## Stats

Measured over the corpus above at `79bfe1016b`: 23
documents, 11705 words, 841 sentences.

| Stat | Value |
| --- | --- |
| Mean sentence length (words) | 13.9 |
| Median sentence length (words) | 13.0 |
| First person plural per second person | 0.67 (203 / 304) |
| Imperative openings | 7.1% |
| Questions | 0.9% |
| Headings per 1k words | 12.5 |
| Bold spans per 1k words | 9.3 |
| List items per 1k words | 19.5 |
| Code blocks per 1k words | 2.6 |
