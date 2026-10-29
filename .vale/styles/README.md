# Nhost Vale styles

House rules for the places we write prose, sharing one styles tree:

| Content | Config | Styles | Checked by |
| --- | --- | --- | --- |
| docs pages under `docs/src/content/docs/` | `docs/.vale.ini` | `Vale`, `Nhost` | the `docs` Nix check |
| blog posts under `landing/src/pages/blog/` | `landing/.vale.ini` | `Vale`, `Nhost`, `NhostBlog` | the `landing` Nix check |
| repository Markdown: READMEs, contributor guides, service docs, `CLAUDE.md` files | `.vale.ini` | `Vale`, `Nhost` | the `vale` Nix check (`tools/vale`) |

`Nhost` holds the rules that apply wherever we write, so every config enables
it; `NhostBlog` holds the blog-only rules and is enabled by `landing/.vale.ini`
alone. Every config also enables Vale's built-in `Vale.*` checks. Everything
here is committed and runs offline; no `Packages` are downloaded. Generated
pages are excluded in `docs/.vale.ini`.

The tree sits at the repository root rather than under `docs/` because it is
shared. Vale takes one `StylesPath` per config, so all three configs point
here, and Vale picks a config by looking in its working directory and then
its parents. That is why `docs/` and `landing/` lint with their own config and
every other directory falls through to the root `.vale.ini`.

## Running Vale

`vale` is not on a stock PATH; it comes from the `docs`, `landing` and `vale`
dev shells. Outside them every command below fails with
`vale: command not found`.

| Content | Errors only (what CI runs) | Warnings too | Changed files only |
| --- | --- | --- | --- |
| docs | `pnpm --dir docs test:prose` | `pnpm --dir docs lint:prose` | `pnpm --dir docs lint:prose:changed` |
| blog | `pnpm --dir landing test:prose` | `pnpm --dir landing lint:prose` | `pnpm --dir landing lint:prose:changed` |
| repository Markdown | `.vale/lint_markdown.sh --minAlertLevel=error` | `make -C tools/vale lint` | `vale <file>` from the repository root |

Run the `pnpm` scripts inside `nix develop .#docs` or `nix develop .#landing`.
The `changed` scripts lint pages changed against `origin/main` (or `main`)
plus uncommitted and untracked ones. Add `--minAlertLevel=suggestion` to any
`vale` run to see the suggestion tier. `make -C tools/vale test` runs the rule
fixtures; `make -C tools/vale check` runs the whole `vale` Nix check.

`.vale/lint_markdown.sh` lints every tracked `*.md` and `*.mdx` file except
those matched by `.vale/markdown.ignore`. An entry there needs a reason other
than "it has findings": fix the page, or relax the rule in `.vale.ini` on a
measured count.

## Severity tiers

Every rule sits in one of three tiers, chosen by its count on main:

- `error`: the count on main is zero. The project's Nix check fails on any
  hit.
- `warning`: the count is not zero, but the hits are worth sweeping. Shown by
  the `lint:prose` scripts (`MinAlertLevel = warning`); never fails a check.
- `suggestion`: available but out of the way. Shown only by
  `vale --minAlertLevel=suggestion`.

A rule moves up a tier only on a measured count, recorded below, never on
opinion. Counts are taken after the `TokenIgnores` in the config that runs the
rule and exclude generated pages.

A rule carries its tier in its own `level:` field. For `Nhost.*` that field is
the docs tier, and `docs/.vale.ini` never names a rule, so the empty
`BasedOnStyles =` in the generated-page section turns every one of them off;
only the built-in `Vale.*` checks are set by name there and need turning off by
name as well.

The corpora are not equally clean, so `landing/.vale.ini` and `.vale.ini` do
name shared rules, to switch off the docs-only ones and to relax any that
their corpus has not reached zero on. They only ever relax a shared rule,
never promote one, so `error` means the same thing in every config and a
rule's `level:` field is always its strictest tier.

## Docs rules

The `Vale.*` built-ins and the whole `Nhost` style, run by `docs/.vale.ini`
over `docs/src/content/docs/`. Counts are over the 219 pages at `edefb8f2bc`
and exclude generated pages.

| Rule | Tier | Count on main | Note |
| --- | --- | --- | --- |
| `Vale.Repetition` | warning | 4 in 3 pages | 6 hits before the ignores; 2 were a code fence directly under `<TabItem>`, read as HTML until the JSX ignore. Promote once the pages are fixed |
| `Vale.Avoid` | error | 0 | Flags words in `config/vocabularies/Nhost/reject.txt`, which is empty |
| `Vale.Terms` | warning | 67 in 35 pages | Lowercase product names in prose: `nhost`, `postgres`, `graphql`, `hasura` and a few more. Moves to `error` once `accept.txt` and a sweep bring it to zero |
| `Vale.Spelling` | off | 639 in 152 pages (`8c8def5300`) | Disabled; the hits are mostly code identifiers and product names in prose |
| `Nhost.Exclamation` | warning | 8 in 7 pages | 5 of them the tutorial welcome lines |
| `Nhost.Ellipses` | warning | 3 in 3 pages | Two are the overflow menu, written **⋯** elsewhere in the docs |
| `Nhost.Spacing` | error | 0 | |
| `Nhost.Units` | warning | 12 in 3 pages | `10GB`, `16MB`, `10s` |
| `Nhost.Ordinal` | warning | 3 in 1 page | Dates; the `95th`/`75th percentile` dashboard panel titles are exempted by a lookahead added to the vendored rule |
| `Nhost.LyHyphens` | warning | 2 in 2 pages | |
| `Nhost.OptionalPlurals` | warning | 3 in 3 pages | |
| `Nhost.OxfordComma` | warning | 25 in 21 pages | The docs mix both comma styles; cheap to sweep later and then promote |
| `Nhost.Colons` | suggestion | 177 in 54 pages | The docs capitalise after a colon, so this asserts a house style the corpus does not follow |
| `Nhost.Latin` | suggestion | 57 in 41 pages | Mostly `e.g.`; the corpus uses them freely |
| `Nhost.Quotes` | suggestion | 21 in 7 pages | Mostly quoted third-party UI labels in setup steps (`select "App Registrations".`), where the period belongs outside |
| `Nhost.WordList` | suggestion | 42 in 17 pages | Mostly `Cloud` in Nhost Cloud, which Google's list maps to Google Cloud Platform; the rest `url` |
| `Nhost.Aside` | error | 0 | Callouts are `:::note`, `:::tip` or `:::caution`, never `<Aside>`; raw scope, so it sees the JSX the ignores drop |
| `Nhost.RawDashboardURL` | error | 0 | A URL template (`/orgs/{org}/projects/`) or an `app.nhost.io/orgs/` link that names an organisation instead of `_`; raw scope, code fences included |
| `Nhost.DeepLinkRel` | error | 0 | An `app.nhost.io` anchor with `target="_blank"` and no `rel="noopener noreferrer"`, by lookahead; raw scope |
| `Nhost.UIPathArrow` | warning | 35 in 18 pages | Each `->` in a bold UI path, which should use `→`; raw scope |
| `Nhost.NavPaths` | warning | 0 | Stale dashboard paths, one row per move checked against the dashboard source named in the rule, including `Settings → Sign-In Methods` without the leading `Auth →`; raw scope. At zero, so it can be promoted to error |
| `Nhost.FillerHeadings` | warning | 11 in 11 pages | Headings that are exactly Overview, Introduction, Benefits, Summary or Conclusion. Promote once the pages are fixed |
| `Nhost.LLMPhrases` | warning | 106 in 61 pages | Praise and hedge words common in generated text (`powerful`, `seamlessly`, `simply`, `comprehensive`, `when it comes to`, ...) with hits on the docs or blog |
| `Nhost.LLMPhrasesStrict` | error | 0 | The same kind of word or phrase with no hits on the docs, split out so they can fail now. A word is never in both files |
| `Nhost.RhetoricalQuestion` | error | 0 | The one-word question standing in for a transition (`The catch?`, `Why does this matter?`). Separate from `LLMPhrasesStrict` because a token ending in `?` needs `nonword` |
| `Nhost.TutorialVoice` | warning | 18 in 12 pages | `In this section/guide, we will`, `Let's <verb>` and `Now that we/you have` |
| `Nhost.EmDash` | suggestion | 256 in 74 pages | Em dashes are house style, so this only shows them and is never promoted |

At the suggestion level the tree reports 0 errors, 297 warnings and 553
suggestions in 219 files, so `pnpm --dir docs test:prose` passes on main.

## Blog rules

The blog-only rules, run by `landing/.vale.ini`. Counts are over the 86 posts
at `edefb8f2bc`.

| Rule | Tier | Count on main | Note |
| --- | --- | --- | --- |
| `NhostBlog.NewTabRel` | error | 0 | Any `target="_blank"` link without `rel="noopener noreferrer"`; wider than `Nhost.DeepLinkRel`, which only guards `app.nhost.io`. All 15 new-tab links in the corpus already carry the `rel` |
| `NhostBlog.Callout` | error | 0 | `BlogPostLayout` does not render `:::`, so the markup would reach the reader as literal colons |
| `NhostBlog.ImageFolder` | warning | 25 in 19 posts | Images belong in the post's own folder. 19 hits are the older flat `og-<name>.png` social images, 6 are content images. Promote once the posts move into per-slug folders |
| `NhostBlog.BoldParagraph` | suggestion | 23 in 8 posts | In the corpus every hit is a bold line standing in for a heading, not the generated-text tell of a bolded thesis. A rule cannot tell the two apart, so it stays at suggestion |
| `NhostBlog.BodyHeading` | warning | 20 in 7 posts | The layout renders the title as the h1, so the body starts at `##`. `scope: heading.h1` parses the Markdown, so a `#` comment inside a code fence is not counted |
| `NhostBlog.ClosingHeading` | warning | 11 in 11 posts | `Wrap up` 6, `Wrapping Up` 3, `Wrapping up` 1, `Closing` 1. `Conclusion` and `Summary` are `Nhost.FillerHeadings`, and no word is in both files |
| `NhostBlog.DocsLinkPath` | warning | 3 in 2 posts | Pre-restructure docs paths (`/graphql`, `/authentication`, `/storage`) that now 404 |
| `NhostBlog.LegacyHost` | warning | 2 in 2 posts | Both are v1-era posts where the dead `console.nhost.io` link is the subject, which is why this is not an error |
| `NhostBlog.InsecureLink` | warning | 1 in 1 post | One `http://docs.nhost.io` link |
| `NhostBlog.ActuallyMeans` | warning | 1 in 1 post | A subhead promising what something "actually means" |

The shared `Nhost.*` rules run on the blog too, at the tier in their `level:`
field unless `landing/.vale.ini` relaxes them. Their counts over the same 86
posts: `LLMPhrases` 136 in 56, `Exclamation` 129 in 45, `Colons` 79 in 31,
`Units` 76 in 6, `TutorialVoice` 41 in 18, `OxfordComma` 39 in 33, `EmDash`
28 in 7, `Latin` 22 in 15, `FillerHeadings` 18 in 18, `Quotes` 11 in 10,
`WordList` 7 in 6, `LLMPhrasesStrict` 7 in 5, `Ellipses` 7 in 6, `Ordinal` 6
in 5, `LyHyphens` 2 in 2, `Spacing` 1 in 1, and `OptionalPlurals` and
`RhetoricalQuestion` 0. For the built-ins, `Vale.Terms` is 73 in 30 and
`Vale.Repetition` 1 in 1, both at warning; `Vale.Avoid` is 0 at error and
`Vale.Spelling` is off, as in the docs.

Two shared rules are relaxed from error to warning in `landing/.vale.ini`,
because the blog is not yet at zero on either: `Nhost.LLMPhrasesStrict` (7) and
`Nhost.Spacing` (1). Delete the line to promote one back once its count is
zero. Five docs-only rules are switched off there instead: `Nhost.Aside` (the
blog has no callout, and `NhostBlog.Callout` says so with the right message),
`Nhost.NavPaths` and `Nhost.UIPathArrow` (no dashboard walkthroughs),
`Nhost.RawDashboardURL`, and `Nhost.DeepLinkRel` (superseded by the wider
`NhostBlog.NewTabRel`).

At the suggestion level the blog reports 0 errors, 599 warnings and 170
suggestions in 86 files, so `pnpm --dir landing test:prose` passes on main.

## Repository Markdown rules

The root `.vale.ini` runs the `Vale.*` built-ins and the `Nhost` style over
the 93 files `.vale/lint_markdown.sh` selects at `edefb8f2bc`, with the same
five docs-only rules switched off as on the blog. No shared rule needed
relaxing: the two error-tier hits on main, `First and foremost` in
`README.md` and `Rest assured` in `SECURITY.md`, were rewritten instead.

Counts: `EmDash` 380 in 41, `Colons` 123 in 35, `Latin` 39 in 21,
`Vale.Terms` 33 in 18, `LLMPhrases` 20 in 15, `FillerHeadings` 15 in 9,
`WordList` 11 in 8, `Units` 10 in 6, `OxfordComma` 8 in 8, `Quotes` 5 in 3,
`Exclamation` 4 in 4, `LyHyphens` 4 in 3, `Ellipses` 2 in 2, `Ordinal` 1 in
1, and every error-tier rule 0. At the suggestion level that is 0 errors, 97
warnings and 558 suggestions in 93 files.

## Nhost rules

The rules from `Aside` to `EmDash` in the docs table are written for Nhost.
`Aside`, `RawDashboardURL`, `DeepLinkRel`, `UIPathArrow` and `NavPaths` use
`scope: raw`, which bypasses the `TokenIgnores`, so they see MDX comments, JSX
attributes and code fences. They also set `vocab: false`. Vale adds every
`accept.txt` entry as an exception to every rule, and `NavPaths` without it
never reported `Settings -> Hasura`, because the match contains the accepted
`Hasura`; the other raw rules set it too, so no accepted term can hide a
structural match.

Two traps caught `LLMPhrases`, `LLMPhrasesStrict` and `RhetoricalQuestion`
when their token lists grew, and neither announces itself: a rule stays green
while silently matching nothing.

- The `accept.txt` exception is tested against the **matched text**, not the
  surrounding sentence. A single-word token is safe, but a token with a
  wildcard can span an accepted term, so `that's where .{1,40} comes in`
  never reported `that's where Nhost comes in` — the likeliest way anyone
  writes it. Any rule with a wildcard token needs `vocab: false`, raw scope
  or not.
- `existence` wraps each token in `\b` unless `nonword` is set, and `\b`
  cannot follow a question mark, so a token ending in `?` silently never
  matches. That is why the question fragments are their own rule rather than
  entries in `LLMPhrasesStrict`.

A new token is worth proving against a fixture for this reason alone: both
failures look exactly like a clean corpus.

## NhostBlog rules

Every rule in this style is written for Nhost. None is vendored, so every one
needs a fixture directory.

`NewTabRel`, `Callout`, `LegacyHost`, `InsecureLink`, `DocsLinkPath`,
`ImageFolder` and `BoldParagraph` use `scope: raw` and set `vocab: false`, for
the same reasons the raw `Nhost` rules do: the `TokenIgnores` drop the JSX
attributes and the `export const article` block that hold a post's links and
image paths, and an accepted term such as `Nhost` inside a match would
otherwise hide it. `BoldParagraph` is raw because a whole-line match is about
the line's shape rather than its words.

`BodyHeading`, `ClosingHeading` and `ActuallyMeans` use a heading scope
instead, so Vale's Markdown parse decides what a heading is. That is what
keeps `BodyHeading` honest: 11 files contain a line starting with `# `, but 4
of them are shell comments inside code fences, and the rule reports the 7 real
ones.

Two rules deliberately stop short of the corpus. `ClosingHeading` lists
neither `What's next` (14 posts), because that heading names what the reader
does next, which is the call to action a post should end on, nor `TL;DR`,
which is conventionally an opener; the rule matches a heading wherever it
sits, and Vale has no "last section" scope to tell an opener from a closer.
`InsecureLink` matches only `nhost.io` hosts, because a third party's scheme
is not ours to fix, and the literal `nhost.io` in the token is what keeps
`http://localhost` out of it.

## Fixture tests

`.vale/test.sh` runs the fixtures for both styles, as part of the `vale` Nix
check (`make -C tools/vale test` runs it alone). It lints with
`.vale/tests/.vale.ini`, which parses like the content configs (same format
mapping, vocabulary and `TokenIgnores`, kept in step by hand), from the
repository root so the paths in `--output=line` are stable:

- `.vale/tests/<Style>/<Rule>/fail.mdx` must report exactly `expected.txt`
  beside it, every line from `<Style>.<Rule>`, and `pass.mdx` must report
  nothing, both at the suggestion level. Every rule that is not vendored needs
  a directory.
- `.vale/tests/Nhost/Ignores/` holds an import, an `export const` block, a
  multi-line JSX tag, an MDX comment, a fence under a `<TabItem>`, a fenced
  `export const ... as const;` block and a second `export const` block whose
  `};` would let a run-past `export const` ignore swallow the hit after the
  fence. `fail.mdx` follows each with a planted `Nhost.Exclamation` hit and
  must report all seven; `pass.mdx` keeps the constructs, with hits inside
  them, and must report nothing.

The config enables one style per fixture tree rather than both over
everything, because the two disagree on purpose: a docs fixture uses `:::`
callouts and `app.nhost.io` deep links, which `NhostBlog.Callout` and
`NhostBlog.NewTabRel` are written to reject.

Fixture prose must also be clean of the vendored rules, since they run at
the suggestion level too. After changing a rule or a fixture, regenerate
the expected files with `./.vale/test.sh --update` from the repository root
(inside `nix develop .#vale`), then review the diff: an expected file is a
reviewed golden, not a snapshot to accept blindly. To bootstrap a new rule,
add its `fail.mdx` and `pass.mdx` and run `--update`, which creates the
missing `expected.txt` that a plain run reports as a failure.

## Heading case

No rule yet. Over the `## ` and `### ` headings outside code fences in the 208
non-generated pages at `8c8def5300`: 729 Title Case, 173 sentence case, 223
undecidable. Classification ignores the first word, inline code and the minor
words `a an the and or but nor for of on in to with at by from as vs via into
per is are`; a heading is Title Case when every remaining word is capitalised,
sentence case when any is lowercase, and undecidable when none remain
(`## Dashboard`). Proper nouns count as capitalised, so some sentence-case
headings land in the Title Case column.

The same classification over the 86 blog posts at `68f5050eb7`: 250 Title
Case, 291 sentence case, 99 undecidable. The blog leans the opposite way to
the docs, but neither corpus is consistent enough to assert a house case, so
the vendored `Headings` and `WordListCase` rules stay out of both styles and
there is still no rule here.

## Vendored rules

The `Nhost.*` rules from `Exclamation` to `WordList` in the docs table are
vendored from the errata-ai Google package
(<https://github.com/errata-ai/Google>), tag `v0.7.1`, commit `56b01fed25`,
under the MIT licence in `Nhost/LICENSE.errata-ai-Google`. No `NhostBlog` rule
is vendored. Each file keeps its upstream name, message and body; the changes
are a header naming the source, the `level:` set to the tier above, the
lookahead in `Ordinal.yml` and the false-positive guards in `OxfordComma.yml`,
each commented in place. Vendored: `Exclamation`, `Ellipses`, `Spacing`,
`Units`, `Ordinal`, `LyHyphens`, `OptionalPlurals`, `OxfordComma`, `Colons`,
`Latin`, `Quotes`, `WordList`. Deliberately not vendored: `Headings`,
`HeadingPunctuation`, `We`, `Will`, `FirstPerson` and `WordListCase`, which
contradict how the docs read, and `EmDash`, which is house style and has the
Nhost rule `EmDash` instead. The rest of the package, `meta.json` and
`vocab.txt` are not copied. None of the vendored rules runs a script.
