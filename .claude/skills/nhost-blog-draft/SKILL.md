---
name: nhost-blog-draft
description: Draft a new post for the Nhost blog under landing/src/pages/blog/. Asks for the byline and topic, researches the source, interviews the author, agrees a brief, writes in the resolved voice, self-reviews with nhost-blog-review and hands off with a preview. Use when asked to write a blog post, an announcement or a post in someone's voice.
---

# Draft a blog post

Read `landing/CLAUDE.md` first. It lists the files of the writing standard to
load, in order, says how the voice resolves, and holds the preview notes this
skill relies on.

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
5. **Write** the post at `landing/src/pages/blog/<slug>.mdx` in the shape of
   `BLOG-04`, in the chosen voice: follow the voice file's register,
   opening move, habits and excerpts, and keep near its stats. Check each
   product claim in the code the brief lists, and use outside material
   only as the author gave it. A claim you cannot check gets
   a `VERIFY:` marker and each missing image a `SCREENSHOT:` marker, as
   under "Placeholders" in the rules doc. Do not commit.
6. **Self-review.** Review the post with the `nhost-blog-review` skill.
   Check each finding against what it cites, since a reviewer can be wrong,
   and fix the ones that hold. A fix is a new claim: check it like any
   other. Copy the result to `.nhost-code/drafts/<slug>.reviewed.mdx`.
7. **Hand off.** Give the preview URL (see "Preview" in
   `landing/CLAUDE.md`), the post's absolute path, and a terse report: one
   table of the issues still open, by severity, placeholders included, then
   a separate list of what the self-review fixed. No status marks in the
   open-issues table. Then ask the user, as one question, to verify the
   post or comment on it (a structured question tool if the session has
   one).
8. **After the user's answer.** If they verify it, stop the landing dev
   server if this session started it, and finish. If they comment or edit
   the post, address it, then review only what changed: diff the post
   against `<slug>.reviewed.mdx`, and skip the review if they match. Fix,
   refresh the copy, and return to step 7.
