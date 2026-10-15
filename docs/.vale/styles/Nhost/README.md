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

## Rules

| Rule | Tier | Count on main (commit) | Note |
| --- | --- | --- | --- |
| `Vale.Repetition` | error | 0 (`8c8def5300` plus the 2a fixes) | 6 hits before the ignores; 2 were a code fence directly under `<TabItem>`, read as HTML until the JSX ignore; the other 4 were fixed in the commit that added this table |
| `Vale.Avoid` | error | 0 (`8c8def5300`) | Flags words in `config/vocabularies/Nhost/reject.txt`, which is empty |
| `Vale.Terms` | warning | 67 in 35 pages (`8c8def5300`) | Lowercase product names in prose: `nhost` 18, `postgres` 15, `graphql` 11, `hasura` 8, the rest 15. Moves to `error` once `accept.txt` and a sweep bring it to zero |
| `Vale.Spelling` | off | 639 in 152 pages (`8c8def5300`) | Disabled; the hits are mostly code identifiers and product names in prose |

## Heading case

No rule yet. Over the `## ` and `### ` headings outside code fences in the 208
non-generated pages at `8c8def5300`: 729 Title Case, 173 sentence case, 223
undecidable. Classification ignores the first word, inline code and the minor
words `a an the and or but nor for of on in to with at by from as vs via into
per is are`; a heading is Title Case when every remaining word is capitalised,
sentence case when any is lowercase, and undecidable when none remain
(`## Dashboard`). Proper nouns count as capitalised, so some sentence-case
headings land in the Title Case column.
