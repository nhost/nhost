---
slug: nhost-docs
corpus: hand-written pages under docs/src/content/docs/, minus the generated set
held-out: docs/src/content/docs/platform/cloud/environment-variables.mdx
---

# Voice: nhost-docs

How the Nhost docs read. This file describes, it does not rule: what a page
must contain is in the writing rules and the docs scope. The voice has no
byline, so it never matches a frontmatter author; every docs page resolves
to it. "Hand-written" means not produced by `docs/gen.sh`; the corpus
includes pages that were LLM-assisted and then edited by a maintainer, and
the stats average over all of them. The held-out page is kept out of the
excerpts and out of the stats.

## Register

- Imperative second person. The reader is "you"; the sentence tells them
  what to do or what is true: "Navigate to the **SQL Editor** of the
  database and run the following SQL".
- Code before prose. A step is a sentence ending in a colon and a fenced
  block; the explanation, if any, comes after the block and is short.
- Short sentences, present tense, no build-up. A caveat is stated in the
  sentence after the instruction it qualifies, or in a `:::caution`.
- First-person plural only narrates the running example ("In our example,
  we do not mark `id` nor `user_id`", `products/graphql/permissions/examples.mdx`);
  it is never the writer addressing the reader as a team.

## Opening move

The first paragraph defines the thing in one present-tense sentence that
names it as the subject ("Buckets are containers that organize files",
"Event triggers fire a webhook whenever"), then gives the one fact the
reader needs before acting: the default state, where it is enabled, or what
it requires. There is no preamble about why the topic matters and no
summary of what the page covers; the first heading follows within a few lines.

## Structural habits

- One feature per page. Related features link to each other rather than
  sharing a page.
- Sections are the tasks or the entities, in the order a reader meets them;
  pages have three to four `##` headings (median 4).
- Alternatives are `<Tabs>`: Dashboard and config file, JavaScript and
  TypeScript, one framework per tab. Tabs are the most used component on
  the site.
- A request flow is a Mermaid sequence diagram after the code that triggers it.
- A page that points onward ends with a `## Related resources` link list
  (the five quickstarts, `products/events/guides/webhook-security.mdx`).

## Formatting habits

- UI labels in bold, identifiers and paths in backticks, commands in fenced
  blocks with a language.
- Callouts are `:::note`, `:::tip` and `:::caution`, usually one or two
  sentences, almost always untitled (185 of 191).
- Screenshots sit immediately after the step they show, with a short alt
  text naming the screen. Em dashes are common and unremarkable.

## What docs never do

- Address the reader as a student: no "In this guide, we will", no "Let's".
- Praise the product. A feature is described by what it does and what it
  requires, not by how seamless or powerful it is.
- End with a conclusion, a summary or a next-steps pep talk. The page stops
  after the last task, the limitations if any, or the related-resources list.
- Explain a concept the reader did not come for. A how-to links to the
  concept page instead of restating it.

The corpus is not clean: seven pages carry an `## Overview` or
`## Introduction` heading and a few open with "In this guide, we will".
Those are the exceptions the rules exist to remove, not the voice.

## Excerpts

Attributed by page path; Markdown link markup is dropped, nothing else is.

- `products/functions/guides/getting-started.mdx`: "Place a `.js` or `.ts`
  file inside the `./functions` directory of your project:"
- `products/database/backups.mdx`: "To restore a backup, go to the Backups
  section in your project's dashboard, pick the backup you want to restore
  from and click on "Restore". Keep in mind this will wipe out all of the
  project's data prior to initiating the restore."
- `platform/cloud/custom-domains.mdx`: "The following examples assume we are
  configuring custom domains at `*.custom-domain.com`."
- `products/events/event-triggers.mdx`: "Event triggers fire a webhook
  whenever a row in a tracked table is inserted, updated, or deleted. The
  webhook receives the old and new row data, letting your handler react to
  exactly what changed."
- `products/graphql/permissions/permission-variables.mdx`: "Permission
  variables are values pulled from the user's access token at request time,
  used inside permission rules. Every project has a built-in
  `x-hasura-user-id`; you can also define your own."

## Stats

Measured over every `.mdx` under `docs/src/content/docs/` at `79bfe1016b`,
generated pages and the held-out page skipped: 207 documents, 65524 words, 5684 sentences.

| Stat | Value |
| --- | --- |
| Mean sentence length (words) | 11.5 |
| Median sentence length (words) | 11.0 |
| First person plural per second person | 0.19 (272 / 1433) |
| Imperative openings | 16.3% |
| Questions | 0.2% |
| Headings per 1k words | 18.4 |
| Bold spans per 1k words | 23.0 |
| List items per 1k words | 27.9 |
| Code blocks per 1k words | 10.6 |
