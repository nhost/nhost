---
slug: david-barroso
byline: David Barroso
corpus: single-author posts under landing/src/pages/blog/ whose byline is David Barroso
held-out: landing/src/pages/blog/mcp-service.mdx
---

# Voice: david-barroso

How David Barroso's posts read. This file describes; the writing rules and
the blog scope decide, and win where a habit below conflicts with them.
Written from 8 public single-author posts, 2022 to 2024: engineering
write-ups, benchmarks and short runtime releases.

## Register

- The only blog voice with more "we" than "you", about two to one: the
  engineering team explaining what it built and why.
- Longer sentences than Nuno's: a reason, a constraint and a result often
  share one.
- Dry humour and asides addressed to an engineering reader: "apologies in
  advance ;)", "I knew someone was going to ask".
- Opening move: a release opens with "Today we are happy to announce" and the change, then
  how to use it. An engineering post opens on the thing being changed,
  defined in one sentence, or on a line that knows what kind of post it is
  ("one of those posts about how we migrated X from Y").

## Structural habits

- Few headings (5.4 per 1k words). A short release post may have none: a
  sentence, the config, the command, the output.
- An engineering post runs: why change, what changed, how it was measured,
  results per scenario, further work. Scenario headings name the setup
  exactly ("Autoscaler, 40 workers, max 10 replicas").
- Posts often end on a "Conclusion" or "Further Work" section; under the
  blog scope the closing paragraph carries it without that heading.

## Formatting habits

- Config and code blocks show a change exactly (3.5 per 1k words); results
  are charts or a table, with the setup stated first.
- Links go to the source: GitHub, the docs page, the pattern's Wikipedia
  entry. Bold is rare (3.2 per 1k words), questions rarer (1 in 267).

## Lexical tics

- "Today we are happy to announce", "As you know", "This was no easy feat";
  playful headings in engineering posts ("Why, Oh Why?", "Why not Rust?").
- Emoticons such as ";)" and ":)" in asides. The corpus typos ("chose" for
  "choose", "cristal ball") are not the voice.

## What David's posts never do

- Sell a change before saying what it is, or give long runs of commands
  (0.8% imperative openings): the config is shown, not ordered.
- Claim a result without the numbers behind it.

## Excerpts

Attributed by post; Markdown link markup is dropped, nothing else is.

- `auth-to-go.mdx`: "This is one of those posts about how we migrated X from
  Y language to Z and all the improvements and amazing things we saw along
  the way. If you are triggered by this kind of post or you are a fan of Y
  (or some other language entirely) and are equally triggered, apologies in
  advance ;)"
- `local-settings.mdx`: "This was no easy feat. As you know we have always
  aimed at configuration correctness, IaC, and the ability to replicate
  environments so to make this possible we had to port some of our cloud
  functionality to the CLI."
- `auth-to-go.mdx`: "I knew someone was going to ask. See previous paragraph
  :)"
- `nodejs-22-support.mdx`: "Doing so is very easy, just select your
  preferred version in your `nhost.toml`."

## Corpus

`.mdx` under `landing/src/pages/blog/`: `advanced_graphql`, `auth-to-go`,
`autoscaler`, `hasura-storage-in-go-5x-performance-increase-and-40-percent-less-ram`,
`local-settings`, `metrics-functions`, `nodejs-20-support`, `nodejs-22-support`.
Set aside: `mcp-service` (his held-out) and `newsletter-2026q1` (the
`nhost-blog` held-out).

## Stats

Measured over the corpus above at `79bfe1016b`: 8
documents, 4620 words, 267 sentences.

| Stat | Value |
| --- | --- |
| Mean sentence length (words) | 17.3 |
| Median sentence length (words) | 15.0 |
| First person plural per second person | 1.95 (125 / 64) |
| Imperative openings | 0.8% |
| Questions | 0.4% |
| Headings per 1k words | 5.4 |
| Bold spans per 1k words | 3.2 |
| List items per 1k words | 11.5 |
| Code blocks per 1k words | 3.5 |
