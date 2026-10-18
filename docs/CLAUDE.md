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
3. `.claude/docs/writing-voices/nhost-docs.md` (how the docs read)

Findings and handoff notes cite rule IDs and quote the text they apply to.

Generated pages are out of scope for all three: the exclusion list is the
fenced block under "Scope and generated pages" in the rules doc. Edit their
sources and regenerate instead.

Calibration pairs (an unedited LLM draft beside the approved page, with the
brief and the deltas) live under `tools/writing/calibration/`. Writers do not
read that directory; reviewers and the judge do.

## Drafting a new page

When asked to write or document something ("document the command palette"),
do not start with the page. The user is asked twice: to confirm the brief
(step 2) and to read the finished page (step 5).

1. **Research.** Find the feature in the source: `dashboard/src/features/`,
   its route under `dashboard/src/pages/`, `cli/` and `services/`, or the
   files a given branch or diff changes. Settle from it what you can without
   asking: the dashboard paths and UI labels, the page's section and type
   (`TGT-DOCS-01`), its sidebar group in `astro.config.mjs`, related pages,
   and caveats the dashboard does not show. For caveats, check when the
   feature does not work and how it differs in the local dashboard:
   `useIsPlatform` and `PlatformOnly` gate Cloud-only UI, and
   `cli/dockercompose/compose.go` sets the local dashboard's environment.
   Nhost Cloud behaviour the dashboard only calls, such as organizations,
   members and billing, is in the nhost-be repository when it is checked
   out: permissions and event triggers under
   `services/console-next/nhost/metadata/`. Trace each side effect to the
   code that performs it. If a page already covers the feature, ask whether
   to extend it instead.
2. **Brief.** Fill in the brief template at the end of the docs target
   (`TGT-DOCS-02`). The audience is always developers and LLMs; do not ask
   for it. Ask for everything else the source cannot settle, usually the
   outcomes, the running example and the screenshots wanted, in one form
   the user submits once (a structured question tool if the session has
   one, else one message of numbered questions), each with a suggested
   answer. Save the brief to `.nhost-code/drafts/<page>.brief.md` at the
   repo root, show it, and wait for the go-ahead.
3. **Write** the page and add it to the sidebar in `astro.config.mjs`. Check
   each claim in the code the brief lists, not against names or memory. A
   claim you cannot check gets a `VERIFY:` marker and each image a
   `SCREENSHOT:` marker, as under "Placeholders" in the rules doc. Run Vale
   on the page (`cd docs && vale --minAlertLevel=warning
   src/content/docs/<page>.mdx` in the docs shell) and fix every alert
   except `Nhost.ScreenshotPlaceholder` and `Nhost.VerifyMarker`; two passes
   at most. Do not commit.
4. **Self-review.** Review the page as under "Reviewing a page". Check each
   finding against the source it cites, since a reviewer can be wrong, fix
   the ones that hold, and run Vale again. A fix is a new claim: check it
   like any other. Copy the result to `.nhost-code/drafts/<page>.reviewed.mdx`.
5. **Hand off and stop.** Give the preview URL (below), the page's absolute
   path, and a terse report: one table of the issues still open, by
   severity, placeholders included, then a separate list of what the
   self-review fixed. No status marks in the open-issues table.
6. **After the user's pass.** Review only what changed: diff the page
   against `<page>.reviewed.mdx`, and skip the review if they match. Fix,
   run Vale, refresh the copy, and report as in step 5.

**Preview.** Look for a running docs dev server started from this
worktree's `docs/` (`lsof -nP -iTCP -sTCP:LISTEN`, then the process's
working directory). If there is none, start one from the repo root with
`nix develop .#docs --command pnpm --dir docs dev --port <free port>`; it
keeps running in the background until `astro dev stop`. The page is at
`http://localhost:<port>/<path under src/content/docs, without .mdx>`, with
no trailing slash. While the docs dev shell symlinks `node_modules` into
the Nix store, `astro dev` returns 500 on every page; the fix is to copy
`node_modules` instead.

The Nix docs check builds from git, so a page git does not track yet fails
there with `The slug ... specified in the Starlight sidebar config does not
exist`.

## Reviewing a page

When asked to review docs pages, or as step 4 of drafting:

1. **Pages.** In step 4, the page just written. Otherwise use the base the
   user names; without one, ask between `origin/main` and the nearest local
   branch below `HEAD` when that branch is closer, giving the page count for
   each. The pages are `git diff --name-only --diff-filter=d --merge-base
   <base> -- docs/src/content/docs` plus untracked pages there, `.md` and
   `.mdx` only, minus the generated list. Ask before reviewing more than 5.
2. **Reviewer.** If you can start a subagent with a chosen model, run
   steps 3 to 5 in one subagent on a different model from the one that
   wrote the page. Otherwise review in the same session and say so in the
   report.
3. **Vale** on those pages at warning level, as in drafting step 3.
4. **Check each page.** Read it whole; report on the lines the branch
   changed, and on older lines only when the problem is blocking. Check the
   skeleton for its page type (`TGT-DOCS-01`). Check every product claim
   against the source, tracing side effects to the code that performs them,
   and sort each into one of three outcomes. **Contradicted**: blocking,
   citing the source's `path:line`. **Not found**, because it belongs to
   software outside this repo or could not be located: a warning under
   `WR-CONTENT-05` naming what to verify. Before calling a Cloud claim not
   found, check nhost-be's `services/console-next/nhost/metadata/` if that
   repository is checked out. **Confirmed**: no finding, not
   listed. Then check the rest of the standard, and fold each Vale alert
   into the finding for its line. Do not read `tools/writing/calibration/`.
5. **Write** `.nhost-code/review/DOCS_REVIEW_<branch>.md`, with `/` in the
   branch name replaced by `-`: a count line, then per page one finding per
   problem, titled `### [<severity>] <rule ID>: <issue> (line <n>)`, with a
   quote of the page's text, what the source shows, and the fix. Severity is
   `blocking` for Vale errors and contradicted claims (`TGT-DOCS-09`),
   `warning` for claims not found and other rule breaks, and `suggestion`
   for style. A Vale rule with no ID, such as `Vale.Terms`, is cited by its
   Vale name.
6. **Report.** The file's absolute path, the counts, and one table of open
   issues (`Severity | Line | Rule | Issue`), blocking first, with no status
   marks. Outside drafting, ask before fixing anything.

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
