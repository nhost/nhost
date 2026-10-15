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

At the suggestion level the whole tree reports 0 errors, 90 warnings and 294
suggestions in 218 files (`e56d1473c2` plus the 2b fixes). A suggestion rule
is promoted only on a measured count and a one-line reason in its row.

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

Every `Nhost.*` rule in the table above is vendored from the errata-ai Google
package
(<https://github.com/errata-ai/Google>), tag `v0.7.1`, commit `56b01fed25`,
under the MIT licence in `LICENSE`. Each file keeps its upstream name and
body; the changes are a header naming the source, the `WR-STYLE-*` ID
appended to the message, the `level:` set to the tier above, and one
lookahead in `Ordinal.yml`, commented in place. Vendored: `Exclamation`,
`Ellipses`, `Spacing`, `Units`, `Ordinal`, `LyHyphens`, `OptionalPlurals`,
`OxfordComma`, `Colons`, `Latin`, `Quotes`, `WordList`. Deliberately not
vendored: `Headings`, `HeadingPunctuation`, `We`, `Will`, `FirstPerson` and
`WordListCase`, which contradict how the docs read, and `EmDash`, which is
house style and gets an Nhost rule of its own. The rest of the package,
`meta.json` and `vocab.txt` are not copied. None of the vendored rules runs a
script.
