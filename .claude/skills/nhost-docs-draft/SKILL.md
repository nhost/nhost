---
name: nhost-docs-draft
description: Draft a new Nhost docs page, or extend one, under docs/src/content/docs/. Researches the feature in the source, agrees a brief with the user, writes the page to the writing standard, self-reviews it with nhost-docs-review and hands it off with a preview. Use when asked to write, document or add a docs page.
---

# Draft a docs page

Read `docs/CLAUDE.md` first. It lists the three files of the writing standard
to load, in order, and holds the preview and Vale notes this skill relies on.

When asked to write or document something ("document the command palette"),
do not start with the page. The user is asked twice: to confirm the brief
(step 2) and to read the finished page (step 5).

1. **Research.** Find the feature in the source: `dashboard/src/features/`,
   its route under `dashboard/src/pages/`, `cli/` and `services/`, or the
   files a given branch or diff changes. Settle from it what you can without
   asking: the dashboard paths and UI labels, the page's section and type
   (`DOCS-01`), its sidebar group in `astro.config.mjs`, related pages,
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
2. **Brief.** Fill in the brief template at the end of the docs scope
   (`DOCS-02`). The audience is always developers and LLMs; do not ask
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
4. **Self-review.** Review the page with the `nhost-docs-review` skill.
   Check each finding against the source it cites, since a reviewer can be
   wrong, fix the ones that hold, and run Vale again. A fix is a new claim:
   check it like any other. Copy the result to
   `.nhost-code/drafts/<page>.reviewed.mdx`.
5. **Hand off.** Give the preview URL (see "Preview" in `docs/CLAUDE.md`),
   the page's absolute path, and a terse report: one table of the issues
   still open, by severity, placeholders included, then a separate list of
   what the self-review fixed. No status marks in the open-issues table.
   Then ask the user, as one question, to verify the page or comment on it
   (a structured question tool if the session has one).
6. **After the user's answer.** If they verify it, stop the docs dev
   server if this session started it, and finish. If they comment or edit
   the page, address it, then review only what changed: diff the page
   against `<page>.reviewed.mdx`, and skip the review if they match. Fix,
   run Vale, refresh the copy, and return to step 5.
