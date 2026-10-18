# Nhost Vale style

House rules for the docs under `src/content/docs/`, run by `docs/.vale.ini`
together with Vale's built-in `Vale.*` checks. Everything here is committed
and runs offline; no `Packages` are downloaded. Generated pages are excluded
in `.vale.ini`, matching the exclusion list in `.claude/docs/writing-rules.md`.

## Severity tiers

Every rule sits in one of three tiers, chosen by its count on main:

- `error`: the count on main is zero. `pnpm test:prose` fails on any hit, and
  it runs in the docs Nix check.
- `warning`: the count is not zero, but the hits are worth sweeping. Shown by
  `pnpm lint:prose` (`MinAlertLevel = warning`); never fails a check.
- `suggestion`: available but out of the way. Shown only by
  `vale --minAlertLevel=suggestion`.

A rule moves up a tier only on a measured count, recorded below, never on
opinion. Counts are taken after the `TokenIgnores` in `.vale.ini` and exclude
generated pages.

An `Nhost.*` rule carries its tier in its own `level:` field and is never
named in `.vale.ini`, so the empty `BasedOnStyles =` in the generated-page
section turns every one of them off. Only the built-in `Vale.*` checks are
set by name there and need turning off by name as well.

## Rules

| Rule | Tier | Count on main (commit) | Note |
| --- | --- | --- | --- |
| `Vale.Repetition` | error | 0 (`8c8def5300` plus the 2a fixes) | 6 hits before the ignores; 2 were a code fence directly under `<TabItem>`, read as HTML until the JSX ignore; the other 4 were fixed in the commit that added this table |
| `Vale.Avoid` | error | 0 (`8c8def5300`) | Flags words in `config/vocabularies/Nhost/reject.txt`, which is empty |
| `Vale.Terms` | warning | 67 in 35 pages (`8c8def5300`) | Lowercase product names in prose: `nhost` 18, `postgres` 15, `graphql` 11, `hasura` 8, the rest 15. Moves to `error` once `accept.txt` and a sweep bring it to zero |
| `Vale.Spelling` | off | 639 in 152 pages (`8c8def5300`) | Disabled; the hits are mostly code identifiers and product names in prose |
| `Nhost.Exclamation` | error | 0 (`e56d1473c2` plus the 2b fixes) | 8 hits in 7 pages before the sweep, 5 of them the tutorial welcome lines |
| `Nhost.Ellipses` | error | 0 (`e56d1473c2` plus the 2b fixes) | 3 hits in 3 pages before the sweep; two were the overflow menu, now written **⋯** as elsewhere in the docs |
| `Nhost.Spacing` | error | 0 (`e56d1473c2`) | No hits |
| `Nhost.Units` | error | 0 (`e56d1473c2` plus the 2b fixes) | 12 hits in 3 pages before the sweep (`10GB`, `16MB`, `10s`), fixed with a plain space |
| `Nhost.Ordinal` | error | 0 (`e56d1473c2` plus the 2b fixes) | 5 hits in 2 pages before the sweep; 3 dates fixed, and the 2 `95th`/`75th percentile` hits are dashboard panel titles, exempted by a lookahead added to the vendored rule |
| `Nhost.LyHyphens` | error | 0 (`e56d1473c2` plus the 2b fixes) | 2 hits in 2 pages before the sweep |
| `Nhost.OptionalPlurals` | error | 0 (`e56d1473c2` plus the 2b fixes) | 3 hits in 3 pages before the sweep |
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
| `Nhost.UIPathArrow` | error | 0 (`e5bbdf0771` plus the sweep) | `DOCS-06`; 17 hits on 15 lines in 9 pages before the sweep, each `->` in a bold UI path changed to `→` and nothing else; raw scope |
| `Nhost.NavPaths` | error | 0 (`e5bbdf0771` plus the fixes) | `DOCS-06`; stale dashboard paths, one row per move checked against the dashboard source named in the rule. 3 hits in 3 pages before the fixes, all `Settings → Sign-In Methods` without the leading `Auth →`, which the fixes added; raw scope |
| `Nhost.FillerHeadings` | warning | 11 in 11 pages (`e5bbdf0771`) | `WR-ANTI-04`; headings that are exactly Overview, Introduction, Benefits, Summary or Conclusion. Promote once the pages are fixed |
| `Nhost.LLMPhrases` | warning | 46 in 26 pages (`e5bbdf0771`) | `WR-ANTI-05`; `leverage` and its forms 21, `seamless(ly)` 11, `robust` 7, `powerful` 6, `unlocks` 1 |
| `Nhost.LLMPhrasesStrict` | error | 0 (`e5bbdf0771`) | `WR-ANTI-05`; the words from the same list with no hits (`effortless`, `delve`, `let's dive`, `it's worth noting`), split out so they can fail now. A word is never in both files |
| `Nhost.TutorialVoice` | warning | 3 in 2 pages (`e5bbdf0771`) | `WR-ANTI-09`; `In this section/guide, we will` and `we'll` |
| `Nhost.EmDash` | suggestion | 256 in 74 pages (`e5bbdf0771`) | `WR-STYLE-16`; em dashes are house style, so this only shows them and is never promoted |

At the suggestion level the whole tree reports 0 errors, 150 warnings and 550
suggestions in 218 files (`e5bbdf0771` plus the `UIPathArrow` sweep and the
`NavPaths` fixes). A suggestion rule is promoted only on a measured count and
a one-line reason in its row.

## Nhost rules

The rules from `Aside` to `EmDash` in the table are written for Nhost. Each
message starts with the rule ID it enforces, defined in
`.claude/docs/writing-rules.md` or `.claude/docs/writing-scopes/docs.md`, and
the definition line names the rule back. `Aside`, `ScreenshotPlaceholder`,
`VerifyMarker`, `RawDashboardURL`, `DeepLinkRel`, `UIPathArrow` and
`NavPaths` use `scope: raw`, which bypasses the `TokenIgnores`, so they see
MDX comments, JSX attributes and code fences. They also set `vocab: false`.
Vale adds every `accept.txt` entry as an exception to every rule, and
`NavPaths` without it never reported `Settings -> Hasura`, because the
match contains the accepted `Hasura`; the other raw rules set it too, so no
accepted term can hide a structural match.

## Fixture tests

`pnpm test:prose-rules` runs `docs/vale_test.sh`, part of `pnpm test` and the
docs Nix check. It lints with `.vale/tests/.vale.ini`, which parses like
`.vale.ini` (same format mapping, vocabulary and `TokenIgnores`, kept in step
by hand) with only the `Nhost` style enabled, from the repository root so
the paths in `--output=line` are stable:

- `.vale/tests/<Rule>/fail.mdx` must report exactly `expected.txt` beside
  it, every line from `Nhost.<Rule>`, and `pass.mdx` must report nothing,
  both at the suggestion level. Every rule that is not vendored needs a
  directory.
- `.vale/tests/Ignores/` holds an import, an `export const` block, a
  multi-line JSX tag, an MDX comment, a fence under a `<TabItem>`, a fenced
  `export const ... as const;` block and a second `export const` block whose
  `};` would let a run-past `export const` ignore swallow the hit after the
  fence. `fail.mdx` follows each with a planted `Nhost.Exclamation` hit and
  must report all seven; `pass.mdx` keeps the constructs, with hits inside
  them, and must report nothing.
- Every `tools/writing/calibration/docs/*/{draft,final}.mdx`, at the error
  level, must report exactly `.vale/tests/calibration/expected-errors.txt`.
  The calibration set is in the docs Nix fileset, read in place.

Fixture prose must also be clean of the vendored rules, since they run at
the suggestion level too. After changing a rule or a fixture, regenerate
the expected files with `./vale_test.sh --update` from `docs/` (inside
`nix develop .#docs`), then review the diff: an expected file is a reviewed
golden, not a snapshot to accept blindly. To bootstrap a new rule, add its
`fail.mdx` and `pass.mdx` and run `--update`, which creates the missing
`expected.txt` that a plain run reports as a failure.

## Heading case

No rule yet. Over the `## ` and `### ` headings outside code fences in the 208
non-generated pages at `8c8def5300`: 729 Title Case, 173 sentence case, 223
undecidable. Classification ignores the first word, inline code and the minor
words `a an the and or but nor for of on in to with at by from as vs via into
per is are`; a heading is Title Case when every remaining word is capitalised,
sentence case when any is lowercase, and undecidable when none remain
(`## Dashboard`). Proper nouns count as capitalised, so some sentence-case
headings land in the Title Case column.

## Vendored rules

The `Nhost.*` rules from `Exclamation` to `WordList` in the table above are
vendored from the errata-ai Google package
(<https://github.com/errata-ai/Google>), tag `v0.7.1`, commit `56b01fed25`,
under the MIT licence in `LICENSE.errata-ai-Google`. Each file keeps its upstream name and
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
