# Writing calibration set

Pairs of LLM drafts and human-approved finals, plus the held-out documents
used to check voice profiles. The judge in `tools/writing` scores drafts
against the writing rules, a scope and a voice; this set is what tells us
whether those scores track what a human reviewer actually changes.

The set lives here rather than under `.claude/writing/` so that sessions loading
the writing rules never ingest a draft full of anti-patterns. Writer agents
must not read this directory.

```text
calibration/
  docs/<pair>/        one directory per docs calibration pair
    draft.mdx         frozen copy of the unedited first LLM draft
    final.mdx         frozen copy of the human-approved page
    brief.md          what a writer would have been handed
    deltas.md         what the human changed, each change tied to a rule ID
    meta.json         scope, page type, SHAs, PR, issue, grounding paths
  voices/
    expect.yaml       held-out document per voice, with vetoed picks
```

## Pairs

A pair is the unedited first draft an LLM produced for a page, and the page as
a human approved it. Nothing between the two is kept: intermediate commits are
neither drafts nor finals.

Both files are frozen copies taken with `git show <sha>:<path>`, never SHA
references. Drafts usually live on a feature branch, and a squash merge or a
deleted branch orphans the commit. The native-queries pair is exactly that
case: both SHAs exist only on the branch of PR #5173, which was open when the
pair was added.

The other files:

- `brief.md` is what a writer would have received before any draft existed:
  audience, page type, the running example, dashboard paths, caveats,
  screenshots wanted and source paths. It is written from the issue, the PR
  title and description, and product source, never from `draft.mdx` or
  `final.mdx`. It must not hand over a correction the human made, and it must
  not mirror the draft's section order or running example, or the writer
  evaluation would be scoring leaked structure.
- `deltas.md` is a table with one row per change the human made: what the
  draft did, what the final does, the proposed rule ID, and one line stating
  what that rule must say. Each row cites exactly one ID, from the `WR-*`
  family in `.claude/writing/rules.md` or the `DOCS-*`, `BLOG-*` family in
  `.claude/writing/scopes/`. Every ID a pair cites is defined in the same
  PR that adds the pair; the rule-ID drift test in `tools/writing` enforces it.
  Two rows share an ID only when they are the same rule.
- `meta.json` holds `scope`, `pageType`, `draftSha`, `finalSha`, `pr`,
  `issue` and `grounding`. `grounding` lists the source a judge or reviewer
  checks the page's claims against. Entries are literal repo-relative paths,
  not globs: Next.js route segments such as `[orgSlug]` are part of the path.
  An entry ending in `/` is a directory and covers every file under it. Cite
  only paths that exist at the commit that adds the pair.

### Adding a pair

1. Find the first commit that added the LLM draft and the commit of the
   approved version. Do this before the PR merges, while both are reachable.
2. Create `docs/<page-slug>/` and copy both files with `git show`:

   ```sh
   git show <draft-sha>:<page-path> > docs/<page-slug>/draft.mdx
   git show <final-sha>:<page-path> > docs/<page-slug>/final.mdx
   ```

3. Write `brief.md` from the issue, the PR title and description, and product
   source, before reading either snapshot.
4. Compare the two files and write `deltas.md`. Mechanical edits and local
   rewording go in a list below the table, without IDs.
5. Write `meta.json`, locating every grounding path in the tree.
6. In the same PR, define every ID `deltas.md` cites that the rules doc or the
   scope file does not define yet.
7. Check that both copies still match their commits:

   ```sh
   diff <(git show <draft-sha>:<page-path>) docs/<page-slug>/draft.mdx
   diff <(git show <final-sha>:<page-path>) docs/<page-slug>/final.mdx
   ```

## Held-out documents

Each voice that is checked for discrimination has one held-out document. It
is chosen by a mechanical rule before the voice profile is written, then kept
out of the profile's excerpts and out of `voicestats`, so the check scores
text the profile never saw. `voices/expect.yaml` records each pick.

### Docs

The `nhost-docs` held-out page is chosen at a fixed commit, the fork point of
the PR that introduced the set (`79bfe1016b`). Among the pages under
`docs/src/content/docs/`, excluding the generated pages and the pages the
writing rules quote, take the one with the latest last-commit date; ties go
to the ascending path. The excluded paths are:

- generated: `reference/javascript/**`, `reference/cli/**`,
  `reference/deprecated/**`, `reference/configuration/**`,
  `products/database/extensions.mdx`
- quoted by the rules: `products/database/native-queries.mdx` (this pair) and
  `products/auth/sign-in-magic-link.mdx` (the docs scope's page exemplar)

From the repository root:

```sh
git ls-tree -r --name-only 79bfe1016b -- docs/src/content/docs \
  | grep -E '\.mdx?$' \
  | grep -vE '^docs/src/content/docs/(reference/(javascript|cli|deprecated|configuration)/|products/database/(extensions|native-queries)\.mdx$|products/auth/sign-in-magic-link\.mdx$)' \
  | while read -r f; do
      printf '%s %s\n' "$(git log -1 --format=%ct 79bfe1016b -- "$f")" "$f"
    done \
  | LC_ALL=C sort -k1,1nr -k2,2 \
  | head -n 5
```

The first line is the pick. The rule cannot tell a hand-written page from an
LLM-assisted one, so a maintainer confirms the pick is hand-written before it
is recorded. On a veto, take the next line of the same output and add the
vetoed page with its reason to `vetoed` in `expect.yaml`, so the choice stays
mechanical and auditable.

A docs page is live: anyone can edit it after it is chosen. `expect.yaml`
records its blob SHA (`git rev-parse 79bfe1016b:<path>`), and the voice check
compares it with the current blob before scoring, refusing a page that has
changed. A deliberate edit to the page, such as a mechanical sweep,
re-records the blob with `git hash-object <path>` and adds a `note:` saying
what changed.

### Blog

Held-out posts for the blog voices are chosen by the same kind of rule, most
recent single-author post per voice, and added to `expect.yaml` when the blog
voice profiles are written.

## Results

Scorecards from `tools/writing judge` and `calibrate` are written under
`.nhost-code/review/writing/`, which is gitignored. The durable record is
`calibration/RESULTS.md`, one row per calibration run with the rules SHA,
judge model, scores, margin and edit ratio. That file is created by the
phase that adds the judge.
