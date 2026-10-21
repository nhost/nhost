# Nhost Vale styles

House rules for the two places we write prose, sharing one styles tree:

| Style | Content | Config | Scope file |
| --- | --- | --- | --- |
| `Nhost` | docs pages under `docs/src/content/docs/` | `docs/.vale.ini` | `.claude/writing/scopes/docs.md` |
| `NhostBlog` | blog posts under `landing/src/pages/blog/` | `landing/.vale.ini` | `.claude/writing/scopes/blog.md` |

`Nhost` holds the rules that apply wherever we write, so both configs enable
it; `NhostBlog` holds the blog-only rules and is enabled by `landing/.vale.ini`
alone. Both configs also enable Vale's built-in `Vale.*` checks. Everything
here is committed and runs offline; no `Packages` are downloaded. Generated
pages are excluded in `docs/.vale.ini`, matching the exclusion list in
`.claude/writing/rules.md`.

The tree sits at the repository root rather than under `docs/` because it is
shared, the same reason `.claude/writing/` does. Vale takes one `StylesPath`
per config, so both configs point here.

## Severity tiers

Every rule sits in one of three tiers, chosen by its count on main:

- `error`: the count on main is zero. `pnpm test:prose` fails on any hit, and
  it runs in that project's Nix check.
- `warning`: the count is not zero, but the hits are worth sweeping. Shown by
  `pnpm lint:prose` (`MinAlertLevel = warning`); never fails a check.
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

The two corpora are not equally clean, so `landing/.vale.ini` does name shared
rules, to switch off the docs-only ones and to relax two that the blog has not
reached zero on. It only ever relaxes a shared rule, never promotes one, so
`error` means the same thing in both configs and a rule's `level:` field is
always its strictest tier.

## Docs rules

The `Vale.*` built-ins and the whole `Nhost` style, run by `docs/.vale.ini`
over `docs/src/content/docs/`. Counts exclude generated pages. The same rules
run on the blog at the counts and tiers in the next section.

| Rule | Tier | Count on main (commit) | Note |
| --- | --- | --- | --- |
| `Vale.Repetition` | warning | 4 in 3 pages (`79bfe1016b`, main's pages unchanged) | 6 hits before the ignores; 2 were a code fence directly under `<TabItem>`, read as HTML until the JSX ignore. The fixes are on `docs-quality/03-content-fixes`; promote to error once they land and the count is zero |
| `Vale.Avoid` | error | 0 (`8c8def5300`) | Flags words in `config/vocabularies/Nhost/reject.txt`, which is empty |
| `Vale.Terms` | warning | 67 in 35 pages (`8c8def5300`) | Lowercase product names in prose: `nhost` 18, `postgres` 15, `graphql` 11, `hasura` 8, the rest 15. Moves to `error` once `accept.txt` and a sweep bring it to zero |
| `Vale.Spelling` | off | 639 in 152 pages (`8c8def5300`) | Disabled; the hits are mostly code identifiers and product names in prose |
| `Nhost.Exclamation` | warning | 8 in 7 pages (`79bfe1016b`, main's pages unchanged) | 5 of them the tutorial welcome lines. The fixes are on `docs-quality/03-content-fixes`; promote to error once they land and the count is zero |
| `Nhost.Ellipses` | warning | 3 in 3 pages (`79bfe1016b`, main's pages unchanged) | Two are the overflow menu, written **⋯** elsewhere in the docs. The fixes are on `docs-quality/03-content-fixes`; promote to error once they land and the count is zero |
| `Nhost.Spacing` | error | 0 (`e56d1473c2`) | No hits |
| `Nhost.Units` | warning | 12 in 3 pages (`79bfe1016b`, main's pages unchanged) | `10GB`, `16MB`, `10s`. The fixes are on `docs-quality/03-content-fixes`; promote to error once they land and the count is zero |
| `Nhost.Ordinal` | warning | 3 in 1 page (`79bfe1016b`, main's pages unchanged) | Dates; the `95th`/`75th percentile` dashboard panel titles are exempted by a lookahead added to the vendored rule. The fixes are on `docs-quality/03-content-fixes`; promote to error once they land and the count is zero |
| `Nhost.LyHyphens` | warning | 2 in 2 pages (`79bfe1016b`, main's pages unchanged) | The fixes are on `docs-quality/03-content-fixes`; promote to error once they land and the count is zero |
| `Nhost.OptionalPlurals` | warning | 3 in 3 pages (`79bfe1016b`, main's pages unchanged) | The fixes are on `docs-quality/03-content-fixes`; promote to error once they land and the count is zero |
| `Nhost.OxfordComma` | warning | 23 in 20 pages (`e56d1473c2`) | The docs mix both comma styles; cheap to sweep later and then promote |
| `Nhost.Colons` | suggestion | 177 in 54 pages (`e56d1473c2`) | The docs capitalise after a colon, so this asserts a house style the corpus does not follow |
| `Nhost.Latin` | suggestion | 57 in 41 pages (`e56d1473c2`) | `e.g.` 52, `i.e.` 5; the corpus uses them freely |
| `Nhost.Quotes` | suggestion | 20 in 6 pages (`e56d1473c2`) | Mostly quoted third-party UI labels in setup steps (`select "App Registrations".`), where the period belongs outside |
| `Nhost.WordList` | suggestion | 40 in 16 pages (`e56d1473c2`) | 37 are `Cloud` in Nhost Cloud, which Google's list maps to Google Cloud Platform; the other 3 are `url` |
| `Nhost.Aside` | error | 0 (`e5bbdf0771`) | `DOCS-04`; raw scope, so it sees the JSX the ignores drop |
| `Nhost.ScreenshotPlaceholder` | error | 0 (`e5bbdf0771`) | `DOCS-08`; raw scope, so it sees the `{/* SCREENSHOT: */}` comment |
| `Nhost.VerifyMarker` | error | 0 (`e5bbdf0771`) | `WR-CONTENT-05`; raw scope, so it sees the `{/* VERIFY: */}` comment |
| `Nhost.RawDashboardURL` | error | 0 (`e5bbdf0771`) | `DOCS-07`; a URL template (`/orgs/{org}/projects/`) or an `app.nhost.io/orgs/` link that names an organisation instead of `_`; raw scope, code fences included |
| `Nhost.DeepLinkRel` | error | 0 (`e5bbdf0771`) | `DOCS-07`; an `app.nhost.io` anchor with `target="_blank"` and no `rel="noopener noreferrer"`, by lookahead; raw scope |
| `Nhost.UIPathArrow` | warning | 18 in 10 pages (`79bfe1016b`, main's pages unchanged) | `DOCS-06`; each `->` in a bold UI path; raw scope. The fixes are on `docs-quality/03-content-fixes`; promote to error once they land and the count is zero |
| `Nhost.NavPaths` | warning | 4 in 4 pages (`79bfe1016b`, main's pages unchanged) | `DOCS-06`; stale dashboard paths, one row per move checked against the dashboard source named in the rule, including `Settings → Sign-In Methods` without the leading `Auth →`; raw scope. The fixes are on `docs-quality/03-content-fixes`; promote to error once they land and the count is zero |
| `Nhost.FillerHeadings` | warning | 11 in 11 pages (`e5bbdf0771`) | `WR-ANTI-04`; headings that are exactly Overview, Introduction, Benefits, Summary or Conclusion. Promote once the pages are fixed |
| `Nhost.LLMPhrases` | warning | 46 in 26 pages (`e5bbdf0771`) | `WR-ANTI-05`; `leverage` and its forms 21, `seamless(ly)` 11, `robust` 7, `powerful` 6, `unlocks` 1 |
| `Nhost.LLMPhrasesStrict` | error | 0 (`e5bbdf0771`) | `WR-ANTI-05`; the words from the same list with no hits (`effortless`, `delve`, `let's dive`, `it's worth noting`), split out so they can fail now. A word is never in both files |
| `Nhost.TutorialVoice` | warning | 3 in 2 pages (`e5bbdf0771`) | `WR-ANTI-09`; `In this section/guide, we will` and `we'll` |
| `Nhost.EmDash` | suggestion | 256 in 74 pages (`e5bbdf0771`) | `WR-STYLE-16`; em dashes are house style, so this only shows them and is never promoted |

At the suggestion level the whole tree reports 0 errors, 207 warnings and 550
suggestions in 218 files (`68f5050eb7`'s pages; this branch changes no docs
content). A rule is promoted only on a measured count and a one-line reason
in its row.

## Blog rules

The blog-only rules, run by `landing/.vale.ini`. Counts are over the 86 posts
at `68f5050eb7`; this branch changes no blog content, so they are main's.

| Rule | Tier | Count on main (`68f5050eb7`) | Note |
| --- | --- | --- | --- |
| `NhostBlog.NewTabRel` | error | 0 | `BLOG-06`; wider than `Nhost.DeepLinkRel`, which only guards `app.nhost.io`. All 15 new-tab links in the corpus already carry the `rel` |
| `NhostBlog.Callout` | error | 0 | `BLOG-05`; `BlogPostLayout` does not render `:::`, so the markup would reach the reader as literal colons |
| `NhostBlog.ImageFolder` | warning | 25 in 19 posts | `BLOG-07`; 19 are the older flat `og-<name>.png` social images, 6 are content images. Promote once the posts move into per-slug folders |
| `NhostBlog.BoldParagraph` | suggestion | 23 in 8 posts | `BLOG-09`; in the corpus every hit is a bold line standing in for a heading, not the generated-text tell of a bolded thesis. A rule cannot tell the two apart, so it stays at suggestion |
| `NhostBlog.BodyHeading` | warning | 20 in 7 posts | `BLOG-05`; the 7 posts the blog scope names. `scope: heading.h1` parses the Markdown, so a `#` comment inside a code fence is not counted |
| `NhostBlog.ClosingHeading` | warning | 11 in 11 posts | `BLOG-08`; `Wrap up` 6, `Wrapping Up` 3, `Wrapping up` 1, `Closing` 1. `Conclusion` and `Summary` are `Nhost.FillerHeadings`, and no word is in both files |
| `NhostBlog.DocsLinkPath` | warning | 3 in 2 posts | `BLOG-06`; pre-restructure docs paths (`/graphql`, `/authentication`, `/storage`) that now 404 |
| `NhostBlog.LegacyHost` | warning | 2 in 2 posts | `BLOG-06`; both are v1-era posts where the dead `console.nhost.io` link is the subject, which is why this is not an error |
| `NhostBlog.InsecureLink` | warning | 1 in 1 post | `BLOG-06`; one `http://docs.nhost.io` link |
| `NhostBlog.ActuallyMeans` | warning | 1 in 1 post | `BLOG-09`; the one subhead the blog scope names |

The shared `Nhost.*` rules run on the blog too, at the tier in their `level:`
field unless `landing/.vale.ini` relaxes them. Their counts over the same 86
posts: `Exclamation` 129 in 45, `Colons` 79 in 31, `Units` 76 in 6,
`LLMPhrases` 63 in 34, `OxfordComma` 39 in 33, `EmDash` 28 in 7, `Latin` 22 in
15, `FillerHeadings` 18 in 18, `Quotes` 11 in 10, `WordList` 7 in 6,
`LLMPhrasesStrict` 7 in 5, `Ellipses` 7 in 6, `Ordinal` 6 in 5,
`TutorialVoice` 2 in 2, `LyHyphens` 2 in 2, `Spacing` 1 in 1, and
`OptionalPlurals`, `ScreenshotPlaceholder` and `VerifyMarker` 0. For the
built-ins, `Vale.Terms` is 73 in 30 and `Vale.Repetition` 1 in 1, both at
warning; `Vale.Avoid` is 0 at error and `Vale.Spelling` is off, as in the docs.

Two shared rules are relaxed from error to warning in `landing/.vale.ini`,
because the blog is not yet at zero on either: `Nhost.LLMPhrasesStrict` (7) and
`Nhost.Spacing` (1). Delete the line to promote one back once its count is
zero. Five docs-only rules are switched off there instead, because each
enforces a `DOCS-*` ID the blog scope does not have: `Nhost.Aside` (the blog
has no callout, and `NhostBlog.Callout` says so with the right message),
`Nhost.NavPaths` and `Nhost.UIPathArrow` (no dashboard walkthroughs),
`Nhost.RawDashboardURL`, and `Nhost.DeepLinkRel` (superseded by the wider
`NhostBlog.NewTabRel`). `Nhost.ScreenshotPlaceholder` stays on, because
`BLOG-07` uses the same placeholder contract, though its message names
`DOCS-08`.

At the suggestion level the blog reports 0 errors, 487 warnings and 170
suggestions in 86 files, so `pnpm --dir landing test:prose` passes on main.

## Nhost rules

The rules from `Aside` to `EmDash` in the docs table are written for Nhost.
Each message starts with the rule ID it enforces, defined in
`.claude/writing/rules.md` or `.claude/writing/scopes/docs.md`, and
the definition line names the rule back. `Aside`, `ScreenshotPlaceholder`,
`VerifyMarker`, `RawDashboardURL`, `DeepLinkRel`, `UIPathArrow` and
`NavPaths` use `scope: raw`, which bypasses the `TokenIgnores`, so they see
MDX comments, JSX attributes and code fences. They also set `vocab: false`.
Vale adds every `accept.txt` entry as an exception to every rule, and
`NavPaths` without it never reported `Settings -> Hasura`, because the
match contains the accepted `Hasura`; the other raw rules set it too, so no
accepted term can hide a structural match.

## NhostBlog rules

Every rule in this style is written for Nhost and cites a `BLOG-*` ID defined
in `.claude/writing/scopes/blog.md`, which names the rule back. None is
vendored, so every one needs a fixture directory.

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
does next, which `BLOG-08` asks for, nor `TL;DR`, which is conventionally an
opener and which `BLOG-01` asks a comparison post to lead with; the rule
matches a heading wherever it sits, and Vale has no "last section" scope to
tell an opener from a closer. `InsecureLink` matches only `nhost.io` hosts,
because a third party's scheme is not ours to fix, and the literal `nhost.io`
in the token is what keeps `http://localhost` out of it.

## Fixture tests

`pnpm test:prose-rules` runs `.vale/test.sh`, part of the docs `pnpm test` and
the docs Nix check. It covers both styles, and only the docs check runs it,
because the calibration half reads the docs calibration set and only the docs
Nix fileset ships it. It lints with `.vale/tests/.vale.ini`, which parses like
the two content configs (same format mapping, vocabulary and `TokenIgnores`,
kept in step by hand), from the repository root so the paths in
`--output=line` are stable:

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
- Every `tools/writing/calibration/docs/*/{draft,final}.mdx`, at the error
  level, must report exactly `.vale/tests/calibration/expected-errors.txt`.
  The calibration set is in the docs Nix fileset, read in place.

The config enables one style per fixture tree rather than both over
everything, because the two disagree on purpose: a docs fixture uses `:::`
callouts and `app.nhost.io` deep links, which `NhostBlog.Callout` and
`NhostBlog.NewTabRel` are written to reject. The calibration set is docs
content, so it reads as docs.

Fixture prose must also be clean of the vendored rules, since they run at
the suggestion level too. After changing a rule or a fixture, regenerate
the expected files with `./.vale/test.sh --update` from the repository root
(inside `nix develop .#docs`), then review the diff: an expected file is a
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
is vendored. Each file keeps its upstream name and
body; the changes are a header naming the source, the `WR-STYLE-*` ID
appended to the message, the `level:` set to the tier above, and one
lookahead in `Ordinal.yml`, commented in place. Vendored: `Exclamation`,
`Ellipses`, `Spacing`, `Units`, `Ordinal`, `LyHyphens`, `OptionalPlurals`,
`OxfordComma`, `Colons`, `Latin`, `Quotes`, `WordList`. Deliberately not
vendored: `Headings`, `HeadingPunctuation`, `We`, `Will`, `FirstPerson` and
`WordListCase`, which contradict how the docs read, and `EmDash`, which is
house style and has the Nhost rule `EmDash` instead. The rest of the package,
`meta.json` and `vocab.txt` are not copied. None of the vendored rules runs a
script.
