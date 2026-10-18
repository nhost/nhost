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

The voice comes from the resolution table in the rules doc. Run it from the
repo root in `nix develop .#writing`: `go run ./tools/writing resolve
landing/src/pages/blog/<slug>.mdx` for an existing post, or
`go run ./tools/writing resolve --scope blog --voice <slug>` for a post not
written yet. Or apply the table by hand. For a new post, the
brief's `author:` line is the voice. The voices are `nhost-blog` (the house
voice, and the default for announcements and for anyone without a profile),
`nuno-pato`, `david-barroso` and `max-serdiukov`. A byline without a profile
resolves to `nhost-blog`; a post with several authors needs a voice named.

Findings and handoff notes cite rule IDs and quote the text they apply to.
A diff alone is never a brief. Writers do not read
`tools/writing/calibration/`.

## Prose lint (Vale)

`vale` is not on a stock PATH; it comes from the landing dev shell. Run these
from the repo root as `nix develop .#landing --command pnpm --dir landing
<script>`, or from inside `nix develop .#landing`. Outside the shell they fail
with `vale: command not found`, which looks like a broken script but is not.

- `pnpm test:prose`: error-level alerts only; part of `pnpm test` and the
  landing Nix check, so it must exit 0
- `pnpm lint:prose`: every post, warnings included
- `pnpm lint:prose:changed`: only posts changed against `origin/main` (or
  `main`) plus untracked posts
- `vale --minAlertLevel=suggestion src/pages/blog/`: the suggestion tier too

Config is `landing/.vale.ini`; the styles live at the repository root in
`.vale/styles/`, shared with the docs. Two styles run on a post: `Nhost`, the
rules that apply wherever we write, and `NhostBlog`, the blog-only rules,
which cite the `BLOG-*` IDs from `.claude/writing/scopes/blog.md`. Rules,
severity tiers and their measured counts over the corpus are in
`.vale/styles/README.md`. Raise a rule's tier only with a new count there, and
remember a change under `.vale/styles/` moves the docs as well as the blog.

`landing/.vale.ini` switches off the five docs-only rules and relaxes two that
the blog has not reached zero on; it never makes a shared rule stricter than
the docs run it. It ignores imports, the `export const article` block,
`{/* */}` comments and JSX tags, so a rule that must see a link, an image path
or a comment uses `scope: raw`, plus `vocab: false` so an `accept.txt` term
(`Nhost`) inside the match cannot hide it.

Vale checks mechanical style only. The parts of the standard it cannot see,
the brief fidelity and grounding in `BLOG-02`, `BLOG-03` and `BLOG-10` above
all, are still checked by reading.

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
