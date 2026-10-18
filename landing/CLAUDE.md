# Landing

Next.js site for [nhost.io](https://nhost.io). Blog posts are MDX under
`src/pages/blog/`, one file per post, rendered by `BlogPostLayout`.

## Writing and reviewing posts

Before writing or reviewing anything under `src/pages/blog/`, load, in this
order:

1. `.claude/writing/rules.md` (shared rules, `WR-*` IDs)
2. `.claude/writing/scopes/blog.md` (what a post requires,
   `BLOG-*` IDs)
3. the voice the post resolves to, in `.claude/writing/voices/`

The voice comes from the resolution table in the rules doc, applied by
hand. For a new post, the brief's `author:` line is the voice. The voices are `nhost-blog` (the house
voice, and the default for announcements and for anyone without a profile),
`nuno-pato`, `david-barroso` and `max-serdiukov`. A byline without a profile
resolves to `nhost-blog`; a post with several authors needs a voice named.

Findings and handoff notes cite rule IDs and quote the text they apply to.
A diff alone is never a brief. Writers do not read
`tools/writing/calibration/`.

Vale lints docs pages only: `docs/.vale.ini` has no blog section yet. Until it
does, drafting and review check the mechanical style rules by reading.

## Drafting a new post

When asked to write a post ("write a post announcing X in Nuno's voice"), do
not start with the post. A post often rests on things the repository cannot
supply, so the author is asked first, interviewed until the post is clear,
asked to confirm the brief, and asked to verify the finished post.

1. **Author and topic.** Before anything else, ask who the author is: the
   person on the byline. Unless the request already says, ask in the same
   form what the post is about and what the reader should take away. Suggest
   the voice from the byline: an author with a profile gets their own voice,
   anyone else the house voice `nhost-blog`; the user may pick another.
2. **Research.** For a post about the product, find what shipped in the
   source: `dashboard/src/features/` and `dashboard/src/pages/`, `cli/`,
   `services/`, the docs page for the feature, and nhost-be's
   `services/console-next/nhost/metadata/` for Nhost Cloud behaviour when
   that repository is checked out. Find earlier posts in the same series to
   link. Settle from it what you can without asking: the post type
   (`BLOG-01`), the tags, the links, and every product fact the post
   will state, including how it differs between Nhost Cloud and the local
   dashboard (`useIsPlatform` and `PlatformOnly` gate Cloud-only UI). Trace
   each side effect to the code that performs it.
3. **Interview.** Ask the author for whatever the post needs that research
   did not settle: the thesis, the takeaway, the key points, the call to
   action, and any material from outside the repository, such as their own
   experience, a customer's story, numbers, or an external service the post
   relies on, each with its source or link. Ask in rounds, one form
   submitted once per round (a structured question tool if the session has
   one, else one message of numbered questions), only for what is still
   missing, with a suggested answer wherever research supports one. Keep
   going until nothing is missing. Never fill a gap with an invented
   anecdote, number, quote or customer. The audience is always developers
   and LLMs; do not ask for it.
4. **Brief.** Fill in the brief template at the end of the blog scope
   (`BLOG-02`) from the answers and the research. Save it to
   `.nhost-code/drafts/<slug>.brief.md` at the repo root, show it, and wait
   for the go-ahead.
5. **Write** the post at `src/pages/blog/<slug>.mdx` in the shape of
   `BLOG-04`, in the chosen voice: follow the voice file's register,
   opening move, habits and excerpts, and keep near its stats. Check each
   product claim in the code the brief lists, and use outside material
   only as the author gave it. A claim you cannot check gets
   a `VERIFY:` marker and each missing image a `SCREENSHOT:` marker, as
   under "Placeholders" in the rules doc. Do not commit.
6. **Self-review.** Review the post as under "Reviewing a post". Check each
   finding against what it cites, since a reviewer can be wrong, and fix
   the ones that hold. A fix is a new claim: check it like any other. Copy
   the result to `.nhost-code/drafts/<slug>.reviewed.mdx`.
7. **Hand off.** Give the preview URL (below), the post's absolute path,
   and a terse report: one table of the issues still open, by severity,
   placeholders included, then a separate list of what the self-review
   fixed. No status marks in the open-issues table. Then ask the user, as
   one question, to verify the post or comment on it (a structured
   question tool if the session has one).
8. **After the user's answer.** If they verify it, stop the landing dev
   server if this session started it, and finish. If they comment or edit
   the post, address it, then review only what changed: diff the post
   against `<slug>.reviewed.mdx`, and skip the review if they match. Fix,
   refresh the copy, and return to step 7.

**Preview.** Look for a running `next dev` started from this worktree's
`landing/` (`lsof -nP -iTCP -sTCP:LISTEN`, then the process's working
directory). If there is none, start one from the repo root with
`nix develop .#landing --command pnpm --dir landing dev --port <free port>`
as a background process; it stays in the foreground otherwise. Note that
this session started it, so step 8 stops it. The post is at
`http://localhost:<port>/blog/<slug>`.

## Reviewing a post

When asked to review blog posts, or as step 6 of drafting:

1. **Posts.** In step 6, the post just written. Otherwise use the base the
   user names; without one, ask between `origin/main` and the nearest local
   branch below `HEAD` when that branch is closer, giving the post count for
   each. The posts are `git diff --name-only --diff-filter=d --merge-base
   <base> -- landing/src/pages/blog` plus untracked posts there, `.mdx`
   only. Ask before reviewing more than 5.
2. **Reviewer.** If you can start a subagent with a chosen model, run
   steps 3 to 5 in one subagent on a different model from the one that
   wrote the post. Otherwise review in the same session and say so in the
   report.
3. **Voice.** Resolve each post's voice as above and load its file. Use the
   brief from `.nhost-code/drafts/` when there is one.
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
   other rule breaks; `suggestion`
   for style.
6. **Report.** The file's absolute path, the counts, and one table of open
   issues (`Severity | Line | Rule | Issue`), blocking first, with no status
   marks. Outside drafting, ask before fixing anything.
