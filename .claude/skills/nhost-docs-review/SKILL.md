---
name: nhost-docs-review
description: Review Nhost docs pages under docs/src/content/docs/ against the writing standard (WR-* and DOCS-* rule IDs, the nhost-docs voice, Vale), grounding every product claim in the source, and write .nhost-code/review/DOCS_REVIEW_<branch>.md. Use when asked to review, check or run the docs-quality check on docs pages, and as the self-review step of nhost-docs-draft.
---

# Review docs pages

Read `docs/CLAUDE.md` first. It lists the three files of the writing standard
to load, in order, and holds the Vale notes this skill relies on.

1. **Pages.** When drafting, the page just written. Otherwise use the base
   the user names; without one, ask between `origin/main` and the nearest
   local branch below `HEAD` when that branch is closer, giving the page
   count for each. The pages are `git diff --name-only --diff-filter=d
   --merge-base <base> -- docs/src/content/docs` plus untracked pages there,
   `.md` and `.mdx` only, minus the generated list. Ask before reviewing
   more than 5.
2. **Reviewer.** If you can start a subagent with a chosen model, run
   steps 3 to 5 in one subagent on a different model from the one that
   wrote the page. If the subagent cannot write files, have it return the
   review file's content and write it yourself. Otherwise review in the
   same session and say so in the report.
3. **Vale** on those pages at warning level, as in step 3 of
   `nhost-docs-draft`.
4. **Check each page.** Read it whole; report on the lines the branch
   changed, and on older lines only when the problem is blocking. Check the
   skeleton for its page type (`DOCS-01`). Check every product claim
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
   `blocking` for Vale errors and contradicted claims (`DOCS-09`),
   `warning` for claims not found and other rule breaks, and `suggestion`
   for style. A Vale rule with no ID, such as `Vale.Terms`, is cited by its
   Vale name.
6. **Report.** When a subagent reviewed, first check each of its findings
   against what it cites, since a reviewer can be wrong, and correct or
   drop the ones that do not hold. Then give the file's absolute path, the
   counts, and one table of open issues (`Severity | Line | Rule | Issue`),
   blocking first, with no status marks. Outside drafting, ask before
   fixing anything.
