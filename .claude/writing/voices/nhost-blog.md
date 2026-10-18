---
slug: nhost-blog
corpus: single-author posts under landing/src/pages/blog/ by a profiled author (Nuno Pato, David Barroso, Max Serdiukov) dated on or after since
held-out: landing/src/pages/blog/newsletter-2026q1.mdx
since: 2024-01-01
---

# Voice: nhost-blog

The house voice of the Nhost blog: how the team writes when no one author's
habits should show. It is the default for announcements, for any team member
without a profile of their own, and for any post whose brief asks for it with
`author: nhost-blog`. This file describes; the writing rules and the blog
scope decide, and win where a habit below conflicts with them.

It is measured, not invented: the corpus is the profiled authors' (Nuno,
David and Max) single-author posts since 2024, so the house voice is the
current team average, and each author profile is a deviation from it.

## Register

- The team is "we" and the reader is "you", about three to four. "I" belongs
  to an author profile, not to the house voice.
- Plain, direct sentences (median 14 words) that say what a feature does and
  what the reader can now do with it. Confident, never breathless.
- Opening move: the first sentence names what shipped or what the post
  claims, with a one-line definition when the name alone says nothing.
  Background, if any, comes after.

## Structural habits

- About eight headings per 1k words: fewer than the docs, more than an
  engineering write-up. Headings are short labels or reader questions: what
  it is, how it works, how to use it, limits, what comes next.
- Lists for parallel items (17 items per 1k words): what a feature covers,
  the steps to start, the services it applies to.
- One code or config block where it shows how to start; a technical
  explainer carries more.
- The post ends on a closing paragraph with one call to action: the docs, a
  sign-up link, or a request for feedback on Discord.

## Formatting habits

- Bold is sparing (6.8 spans per 1k words; 11 of the 18 posts have none):
  a feature's name or a key term, not whole sentences.
- Markdown links to the docs page, the product page and earlier posts in the
  same series.
- Numbers are given exactly: a price, a region, a version, a limit.

## What the house voice never does

- Sound like one person: no first-person singular, no emoticons, no in-jokes.
- Praise the feature instead of describing it, or open with a paragraph
  about the industry before naming the release.
- End on a "Conclusion" or "Wrap up" section.

## Excerpts

Attributed by post; Markdown link markup is dropped, nothing else is.

- `introducing-nhost-mcp-server.mdx` (Nuno Pato): "Think of the MCP server as
  the bridge between your AI tools and your actual app or infrastructure."
- `organization-billing.mdx` (Nuno Pato): "Organizations function similarly
  to workspaces, allowing you to group projects together. Organizations can
  also accommodate multiple members with different roles."
- `nodejs-22-support.mdx` (David Barroso): "We can use Node.js 18 by ensuring
  the following configuration is in our `nhost.toml`:"
- `autoscaler.mdx` (David Barroso): "In all scenarios, we maintain a fixed
  load to observe how stable the system remains and how fast it can do its
  job."
- `semantic-search-with-pgvector.mdx` (Max Serdiukov): "Two limits worth
  knowing: embeddings are OpenAI-only today, and the sync is near real time
  rather than instant, so a row you just changed may take a short delay to
  show up in results."

## Corpus

`.mdx` under `landing/src/pages/blog/`, 18 posts dated 2024-01-01 or later by
a profiled author: `advanced_graphql`, `assistants-file-stores`, `auth-to-go`,
`autoscaler`, `dashboard-improvements`, `elevated-permissions`,
`introducing-nhost-mcp-server`, `ipv6`, `local-settings`, `new-region-oregon`,
`nhost-achieves-soc2-compliance`,
`nhost-vs-supabase-practical-guide-for-growing-teams`, `nodejs-20-support`,
`nodejs-22-support`, `organization-billing`, `point-in-time-recovery`,
`rate-limiting`, `semantic-search-with-pgvector`. Posts by bylines without a
profile are in no corpus; every held-out post is set aside.

## Stats

Measured over the corpus above at `79bfe1016b`: 18
documents, 9850 words, 646 sentences.

| Stat | Value |
| --- | --- |
| Mean sentence length (words) | 15.2 |
| Median sentence length (words) | 14.0 |
| First person plural per second person | 0.73 (171 / 234) |
| Imperative openings | 4.0% |
| Questions | 0.5% |
| Headings per 1k words | 8.3 |
| Bold spans per 1k words | 6.8 |
| List items per 1k words | 17.0 |
| Code blocks per 1k words | 3.1 |
