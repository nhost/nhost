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
