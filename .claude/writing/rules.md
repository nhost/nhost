# Writing Rules

Authoritative rules for prose written for the Nhost docs and blog. They apply
to every page under `docs/src/content/docs/**` and every post under
`landing/src/pages/blog/**`, whoever or whatever drafted it. They are stricter
than Vale can be, because they target content and structure, not spelling.

## The three layers

A session that writes or reviews content loads three files, each with one job:

- **Shared rules** (this file, IDs `WR-<AREA>-<NN>`) say what must be true of
  any text we write: grounding, one running example, no filler, placeholders,
  the LLM anti-pattern list and mechanical style.
- **A scope** (`.claude/writing/scopes/<scope>.md`, IDs
  `DOCS-<NN>` or `BLOG-<NN>`) says what the destination requires:
  page or post types, frontmatter, components, links, images, the brief it
  needs.
- **A voice** (`.claude/writing/voices/<slug>.md`, no IDs) says how the text
  reads, as measured stats and attributed excerpts rather than rules.

Rule IDs are the join key between these files, the Vale messages, the judge
rubric, the recorded draft-to-final deltas and review findings. A definition is one line
of the form `- **<ID>** <rule>` and mentions no other ID; voice files contain
no IDs at all. A finding, a delta or a rubric entry cites an ID and quotes the
text it applies to verbatim. The docs scope and the docs voice exist today;
the blog scope and the author voices arrive with the blog work.

## Coverage and generated pages

Generated pages are never written, reviewed or scored by hand. The list below
is the one copy of the generated-page exclusion list and the contract that
`tools/writing resolve` will embed and be tested against. Globs are relative
to `docs/src/content/docs/`.

```text
reference/javascript/**
reference/cli/**
reference/deprecated/**
reference/configuration/**
products/database/extensions.mdx
```

`reference/deprecated/**` is kept for parity with `docs/.vale.ini`, which
already turns every style off for it. The generator table in
`docs/README.md` names the source of each generated set.

## Resolving the scope and the voice

Scope and voice are resolved by one function,
`Resolve(path, scope, frontmatter, voiceFlag)`. The rows below are tried in
order and the first match wins. A brief's `author: <slug>` line is passed as
the voice flag. The tool `tools/writing resolve` is authoritative wherever it
is present and may be run. An agent without it, or in CI where PR-head code
must not run, applies the table by hand. The table is reproduced here so that
both paths apply the same rules; it is the contract the tool will embed, and
a test will hold the tool's copy to it.

```markdown
| Input | Scope | Voice |
| --- | --- | --- |
| `--scope <docs|blog>` given | the flag | continue with the voice rows below; a path is optional |
| no `--scope`, path under `docs/src/content/docs/**` | `docs` | continue |
| no `--scope`, path under `landing/src/pages/blog/**` | `blog` | continue |
| no `--scope`, any other path or no path | error | error |
| path matches the generated-page exclusion list | `docs`, `excluded: true` | callers skip the document |
| `--voice <slug>` given and a profile with that `slug:` exists | as above | the flag; `--voice nhost-blog` is how an announcement or any post gets the neutral house voice over a byline match |
| scope `blog`, frontmatter lists exactly one author whose byline matches a profile's `byline:` | `blog` | that profile |
| scope `blog`, frontmatter lists exactly one author with no matching profile | `blog` | `nhost-blog`, `reason: unprofiled author` |
| scope `blog`, zero or several authors | `blog` | error: `--voice` required |
| scope `docs` | `docs` | `nhost-docs` |
```

Nothing is ever guessed to be a named person. A co-authored post needs an
explicit voice; an unknown single byline gets the neutral house voice.

## Content (`WR-CONTENT`)

- **WR-CONTENT-01** The opening names the reader and the outcome: what they
  already have or know, and what they can do once they finish. A reader who
  is not that person can leave after the first paragraph.
- **WR-CONTENT-02** Structure follows the reader's task in docs and the thesis
  in a post: the first section after the opening is the first thing the
  reader does or the claim the post makes. Headings name the task the reader
  performs or the thing they work with, not a narrative phrase, and cover
  every case the section covers.
- **WR-CONTENT-03** A page uses exactly one running example in every code
  block and screenshot, introduced once and carried through to the end with
  sentences that tie each step back to it by naming the example's table,
  column or file rather than "a table". A second entity appears only where
  the example needs it, and is defined before it is used.
- **WR-CONTENT-04** Every section either advances the task or states a fact
  the reader needs to act. There is no section that previews, recaps or
  motivates the rest of the page.
- **WR-CONTENT-05** Every claim about product behaviour (a UI location, a
  default, a limit, a version requirement, what an action writes or changes)
  is checked against a cited source in the repository, or carries a
  `{/* VERIFY: <claim> — <what to check it against> */}` marker. A claim that
  cannot be sourced is removed. Vale-enforced: `Nhost.VerifyMarker`.

## Style (`WR-STYLE`)

Mechanical prose style that holds in docs and posts alike. The first three
entries do not depend on Vale. Entries 04 to 15 are rules vendored from the
Google Vale package, one ID per vendored rule, each named in its Vale
message; 16 is an Nhost rule. An entry marked Advisory is a suggestion-tier
rule: it informs a revision and never blocks one.

- **WR-STYLE-01** Sentences are short, declarative and in the present tense.
  One idea per sentence; the subject performs the verb; a procedure is
  written as instructions, not as a description of what happens.
- **WR-STYLE-02** Every identifier, path, command, value and file name is in
  backticks. A command the reader runs, a file they create and output they
  compare against are fenced blocks with a language tag, never inline.
- **WR-STYLE-03** List items are parallel in form. Steps the reader performs
  in order are a numbered list; anything else is a bulleted list or a
  sentence. A list with one item is a sentence.
- **WR-STYLE-04** Prose has no exclamation marks. Vale-enforced:
  `Nhost.Exclamation`.
- **WR-STYLE-05** Prose has no `...` ellipsis: finish the list or the
  sentence, and write an overflow menu as **⋯**. Vale-enforced:
  `Nhost.Ellipses`.
- **WR-STYLE-06** One space, never two or none, follows the mark that ends a
  sentence. Vale-enforced: `Nhost.Spacing`.
- **WR-STYLE-07** A space separates a number from its unit: `10 GB`, `16 MB`,
  `5 s`. Vale-enforced: `Nhost.Units`.
- **WR-STYLE-08** Ordinals in prose are words (`the first of the month`);
  percentiles stay numeric (`95th percentile`). Vale-enforced: `Nhost.Ordinal`.
- **WR-STYLE-09** An adverb ending in -ly takes no hyphen before the word it
  modifies: `fully managed`. Vale-enforced: `Nhost.LyHyphens`.
- **WR-STYLE-10** Plurals are never optional in parentheses: `ports`, not
  `port(s)`. Vale-enforced: `Nhost.OptionalPlurals`.
- **WR-STYLE-11** A list of three or more items in a sentence takes a comma
  before the final `and` or `or`. Vale-enforced: `Nhost.OxfordComma`.
- **WR-STYLE-12** Advisory: after a colon inside a sentence, a word that is not
  a proper noun starts in lowercase. Vale-enforced: `Nhost.Colons`.
- **WR-STYLE-13** Advisory: write `for example` and `that is`, not `e.g.` and
  `i.e.`. Vale-enforced: `Nhost.Latin`.
- **WR-STYLE-14** Advisory: a comma or period that follows a quotation goes
  inside the closing mark. Vale-enforced: `Nhost.Quotes`.
- **WR-STYLE-15** Advisory: terms from Google's word list, such as `URL` for
  `url`; its `Cloud` entry does not apply to Nhost Cloud. Vale-enforced:
  `Nhost.WordList`.
- **WR-STYLE-16** Advisory: em dashes are house style. The hand-written docs
  use them freely, 275 times at the commit this standard was written
  against, so nothing bans them and no reviewer treats them as a sign of
  generated text; the rule only lists them. Vale-enforced: `Nhost.EmDash`.

## Anti-patterns (`WR-ANTI`)

Each entry is a pattern that marks a draft as generated rather than written.
A reviewer cites the entry and quotes the text; the writer rewrites, never
paraphrases around it.

- **WR-ANTI-01** Disconnected or abstract examples: a code block, table or
  screenshot that exists to show syntax (`foo`, `customers`, a field no SQL
  defines) rather than to advance the page's one running example.
- **WR-ANTI-02** Invented UI locations: a menu path, tab, button or settings
  page written from memory. Every UI location is checked against the
  dashboard routes and components it names, or marked for verification.
- **WR-ANTI-03** Invented side effects: a file written, state changed or data
  kept that is inferred from an API's name or from how similar products
  behave. A side effect is stated only when the source shows it.
- **WR-ANTI-04** Filler sections: a heading named Overview, Introduction,
  Benefits, Summary or Conclusion, and any paragraph that tells the reader
  what the page is about to say or has just said. Vale-enforced:
  `Nhost.FillerHeadings`.
- **WR-ANTI-05** Hedge and marketing words: "seamless", "leverage", "robust",
  "powerful", "effortless", "unlock", "delve", "simply", "it's worth noting",
  "let's dive in", and any adjective that praises the product instead of
  describing it. Vale-enforced: `Nhost.LLMPhrases`,
  `Nhost.LLMPhrasesStrict`.
- **WR-ANTI-06** Restating the heading as the first sentence of its section
  ("## Create a bucket" followed by "In this section you create a bucket").
  The first sentence does the work the heading announces.
- **WR-ANTI-07** Raw URL-pattern subsections: a paragraph or fenced block
  that documents a dashboard URL template such as
  `/orgs/{org}/projects/{project}/...`. The reader gets the UI path and a
  deep link instead.
- **WR-ANTI-08** Mixed component systems on one page: `<Aside>` beside `:::`
  callouts, raw HTML beside Markdown for the same construct, or a component
  the scope does not list. One page uses the scope's conventions
  throughout.
- **WR-ANTI-09** Tutorial voice: "In this guide, we will", "Let's", "Now that
  we have", and any sentence that narrates the writer's plan instead of
  giving the reader an instruction or a fact. Vale-enforced:
  `Nhost.TutorialVoice`.

## Placeholders

A writer who cannot capture a screenshot or verify a claim leaves an MDX
comment where the image or the fact belongs:

- `{/* SCREENSHOT: /images/<section>/<page>/<name>.png — what the capture shows */}`
- `{/* VERIFY: <claim> — <what to check it against> */}`

Neither ever merges. A screenshot placeholder is replaced by the image at the
path it names; a verify marker is resolved by checking the claim against the
source it names and then removing the marker, or by removing the claim.
`Nhost.ScreenshotPlaceholder` and `Nhost.VerifyMarker` fail docs CI on either
marker, so a page carrying one cannot pass the docs check.

## Evidence

A review finding, a judge scorecard entry or a recorded delta is made of
three parts: the rule ID, a quote of the text it applies to, verbatim, and
one sentence saying what is wrong or what the source says instead. A finding
without a quote is not a finding. For a grounding finding the sentence names
the source checked: a dashboard route under `dashboard/src/pages`, a feature
directory under `dashboard/src/features`, a CLI command under `cli/`, or
service code under `services/`.
