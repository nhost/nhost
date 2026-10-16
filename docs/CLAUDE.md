# Docs

Astro + Starlight site for [docs.nhost.io](https://docs.nhost.io). Pages are
MDX under `src/content/docs/`. `README.md` covers the layout, the `pnpm`
commands and the generated pages: the table under "Generated Documentation"
names the source of each generated set, and `pnpm generate` rebuilds them.

## Writing and reviewing content

Before writing or reviewing anything under `src/content/docs/`, load, in this
order:

1. `.claude/docs/writing-rules.md` (shared rules, `WR-*` IDs)
2. `.claude/docs/writing-targets/docs.md` (what a docs page requires,
   `TGT-DOCS-*` IDs)
3. `.claude/docs/voices/nhost-docs.md` (how the docs read)

Findings and handoff notes cite rule IDs and quote the text they apply to.

Generated pages are out of scope for all three: the exclusion list is the
fenced block under "Scope and generated pages" in the rules doc. Edit their
sources and regenerate instead.

Calibration pairs (an unedited LLM draft beside the approved page, with the
brief and the deltas) live under `tools/writing/calibration/`. Writers do not
read that directory; reviewers and the judge do.

## Prose lint (Vale)

`vale` is not on a stock PATH; it comes from the docs dev shell. Run these
from the repo root as `nix develop .#docs --command pnpm --dir docs <script>`,
or from inside `nix develop .#docs`. Outside the shell they fail with
`vale: command not found`, which looks like a broken script but is not.

- `pnpm test:prose`: error-level alerts only; part of `pnpm test` and the
  docs Nix check, so it must exit 0
- `pnpm lint:prose`: every page, warnings included
- `pnpm lint:prose:changed`: only pages changed against `origin/main` (or
  `main`) plus untracked pages
- `vale --minAlertLevel=suggestion src/content/docs/`: the suggestion tier too
- `pnpm test:prose-rules`: fixture tests for the Nhost rules and the
  calibration golden (`vale_test.sh`; `--update` regenerates the expected
  files); part of `pnpm test`

Config is `.vale.ini`; rules, severity tiers and their measured counts are
in `.vale/styles/Nhost/README.md`. Raise a rule's tier only with a new count
there. `.vale.ini` ignores imports, `export const` blocks, `{/* */}` comments
and JSX tags; a rule that must see a comment (`SCREENSHOT:`, `VERIFY:`) needs
`scope: raw`, plus `vocab: false` so an `accept.txt` term (`Hasura`) inside
the match cannot hide it. When Vale flags text inside a JSX-wrapped paragraph (a `<Card>`
body, say) and the same text also sits earlier in the page inside ignored
content (a tag attribute such as an `href`, an `export const` value), the
alert is reported at that earlier line, not the line holding the prose.
