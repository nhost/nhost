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

## Drafting a new page

When asked to write or document something ("document the command palette"),
do not start with the page. Work in this order:

1. **Research.** Find the feature in the source: `dashboard/src/features/`,
   its route under `dashboard/src/pages/`, `cli/` and `services/`, or the
   files a given branch or diff changes. Settle from it what you can without
   asking: the dashboard paths and UI labels, the page's section and type
   (`TGT-DOCS-01`), its sidebar group in `astro.config.mjs`, related pages,
   and caveats the dashboard does not show. For caveats, check when the
   feature does not work and how it differs in the local dashboard:
   `useIsPlatform` and `PlatformOnly` gate Cloud-only UI, and
   `cli/dockercompose/compose.go` sets the local dashboard's environment.
   Trace each side effect to the code that performs it. If a page already
   covers the feature, ask whether to extend it instead.
2. **Ask once.** Fill in the brief template at the end of the docs target
   (`TGT-DOCS-02`). In one message of numbered questions, ask only what the
   source cannot settle: usually audience, outcomes and the running example
   with its names, plus screenshots wanted and anything step 1 left
   ambiguous. Suggest an answer for each, so the user can reply `ok`.
3. **Confirm.** Save the brief to `.nhost-code/drafts/<page>.brief.md` at the
   repo root, show it, and wait for the go-ahead.
4. **Write** the page and add it to the sidebar in `astro.config.mjs`. Check
   each claim in the code the brief lists, not against names or memory. A
   claim you cannot check gets a `VERIFY:` marker and each image a
   `SCREENSHOT:` marker, as under "Placeholders" in the rules doc. Do not
   commit.
5. **Lint.** In the docs shell, run Vale on the page
   (`cd docs && vale --minAlertLevel=warning src/content/docs/<page>.mdx`)
   and fix every alert except `Nhost.ScreenshotPlaceholder` and
   `Nhost.VerifyMarker`; two passes at most.
6. **Report and stop.** List the page, the sidebar change, each placeholder
   left to resolve, and the brief. Offer a review of the page against the
   same standard, in a new session on a different model; do not start it.

The Nix docs check builds from git, so a page git does not track yet fails
there with `The slug ... specified in the Starlight sidebar config does not
exist`.

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
