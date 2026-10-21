---
name: nhost-blog-review
description: Review Nhost blog posts under landing/src/pages/blog/ against the writing standard (WR-* and BLOG-* rule IDs and the post's voice profile), grounding product claims in the source, and write .nhost-code/review/BLOG_REVIEW_<branch>.md. Use when asked to review, check or run the docs-quality check on blog posts, and as the self-review step of nhost-blog-draft.
---

# Review blog posts

Read `landing/CLAUDE.md` first. It lists the files of the writing standard to
load, in order, and says how each post's voice resolves.

1. **Posts.** When drafting, the post just written. Otherwise use the base
   the user names; without one, ask between `origin/main` and the nearest
   local branch below `HEAD` when that branch is closer, giving the post
   count for each. The posts are `git diff --name-only --diff-filter=d
   --merge-base <base> -- landing/src/pages/blog` plus untracked posts
   there, `.mdx` only. Ask before reviewing more than 5.
2. **Reviewer.** If you can start a subagent with a chosen model, run
   steps 3 to 5 in one subagent on a different model from the one that
   wrote the post. If the subagent cannot write files, have it return the
   review file's content and write it yourself. Otherwise review in the
   same session and say so in the report.
3. **Voice.** Resolve each post's voice as `landing/CLAUDE.md` says and
   load its file. Use the brief from `.nhost-code/drafts/` when there is
   one.
4. **Check each post.** Read it whole; report on the lines the branch
   changed, and on older lines only when the problem is blocking.
   - The thesis is in the first paragraph and, with a brief, every key
     point has its section (`BLOG-03`); the post follows its type's
     shape (`BLOG-01`).
   - Every product claim is checked against the source, tracing side
     effects to the code that performs them, and sorted into one of three
     outcomes. **Contradicted**: blocking, citing the source's `path:line`.
     **Not found**, because it belongs to software outside this repo or
     could not be located: a warning under `WR-CONTENT-05` naming what to
     verify. Before calling a Cloud claim not found, check nhost-be's
     `services/console-next/nhost/metadata/` if that repository is checked
     out. **Confirmed**: no finding, not listed.
   - The voice: register, opening move, habits and stats against the voice
     file. A drift is a warning cited as `voice:<slug>`, quoting the text
     and naming the habit it breaks.
   - Outside material (an anecdote, customer, quote or number) that the
     brief's "Material from the author" does not list is invented: a
     `BLOG-09` finding, blocking.
   - The rest of the standard, including the other blog tells (`BLOG-09`)
     and the mechanical style rules, read by hand.
   Do not read `tools/writing/calibration/`.
5. **Write** `.nhost-code/review/BLOG_REVIEW_<branch>.md`, with `/` in the
   branch name replaced by `-`: a count line, then per post one finding per
   problem, titled `### [<severity>] <rule ID>: <issue> (line <n>)`, with a
   quote of the post's text, what the source or voice file shows, and the
   fix. Severity is `blocking` for contradicted claims (`BLOG-10`), invented
   outside material (`BLOG-09`) and, with a brief, a missing thesis or key
   point (`BLOG-03`); `warning` for claims not found, voice drift and
   other rule breaks; `suggestion` for style.
6. **Report.** When a subagent reviewed, first check each of its findings
   against what it cites, since a reviewer can be wrong, and correct or
   drop the ones that do not hold. Then give the file's absolute path, the
   counts, and one table of open issues (`Severity | Line | Rule | Issue`),
   blocking first, with no status marks. Outside drafting, ask before
   fixing anything.
