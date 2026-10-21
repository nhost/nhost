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

## Drafting and reviewing

Drafting a post follows the `nhost-blog-draft` skill and reviewing posts
the `nhost-blog-review` skill. When the harness has not loaded one, read
`.claude/skills/<name>/SKILL.md`.

## Preview

Look for a running `next dev` started from this worktree's
`landing/` (`lsof -nP -iTCP -sTCP:LISTEN`, then the process's working
directory). If there is none, start one from the repo root with
`nix develop .#landing --command pnpm --dir landing dev --port <free port>`
as a background process; it stays in the foreground otherwise. Note that
this session started it, so it stops it when done. The post is at
`http://localhost:<port>/blog/<slug>`.
