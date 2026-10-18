# writing - Go Development Guide

**Important**: Always load the root `CLAUDE.md` at the repository root for general monorepo conventions before working on this project.

**Design rules**: Repo-wide Go rules live in `.claude/docs/go-design-rules.md` — load that first. Only writing-specific patterns are documented below.

`writing` is the Go tool behind the Nhost docs and blog writing standard. The standard itself is prose in `.claude/writing/`: shared rules in `rules.md`, one scope per destination in `scopes/`, one voice profile per voice in `voices/`. The tool turns the mechanical parts of that standard into commands the judge, the writer and the reviewer share: `resolve`, `validate`, `editratio` and `voicestats`, plus the judge rubric in `rubric/rubric.yaml`.

## Core Principles

- **`.claude/writing` is the source of truth.** Rule IDs, the generated-page exclusion list and the resolution table are defined there. The tool embeds copies and tests hold them to the rules doc; it never defines a rule, a voice or an exclusion of its own. To change the table or the exclusion list, edit `rules.md` first, then copy the fence contents into the embedded file byte for byte.
- **One resolution function.** Everything that needs a scope or a voice goes through `resolve.Resolver.Resolve`. Never re-derive a voice from a byline or a scope from a path elsewhere. `voicestats` selects a voice's corpus by resolving every candidate (`internal/corpus`), so a profile is measured from exactly the posts that resolve to it.
- **Never guess a named person.** Zero or several blog authors are an error that asks for `--voice`. An unprofiled single author gets the neutral `nhost-blog` house voice, never the closest profile.
- **The rubric cites only defined IDs.** Every ID in `rubric/rubric.yaml` must be defined in `rules.md` or a `scopes/*.md` file. `rubric.Load` rejects an undefined ID and the drift test fails on one anywhere in the file, comments included, so a `BLOG-*` ID is attached only once the blog scope defines it.
- **Never trust a scorecard's arithmetic.** `validate` recomputes `total` and `blocking` and checks every quote against the document; it reports and exits 1, it never rewrites the scorecard.
- **Few dependencies.** Standard library, `urfave/cli/v3`, and the vendored `github.com/goccy/go-yaml` for `rubric.yaml` and `calibration/voices/expect.yaml`, decoded with `yaml.Strict()` so an unknown key is an error. Voice headers and blog frontmatter are still read line by line and by regex; do not add a YAML or MDX parser for them.

## Directory Structure

```
tools/writing/
├── main.go                     # cli.Command and `resolve`; repoPath (flag or <git root> default), git-root discovery, path normalisation
├── commands.go                 # `validate` and `editratio`
├── voicestats.go               # `voicestats`: flags, help text with the metric definitions, Markdown and JSON output
├── main_internal_test.go       # findRepoRoot, defaultRepoPath and repoRelative
├── voicestats_internal_test.go # the Markdown table and the help's verb wrapping
├── drift_test.go               # the rule-ID drift test over the real rules, rubric, deltas, Vale styles and voices
├── rubric/
│   └── rubric.yaml             # the one judge rubric: dimensions, covered IDs, anchors, per-scope weights and blocking
├── internal/
│   ├── ruleid/                 # Definitions and Citations (the ID and citation greps), Load: the set of defined IDs
│   ├── rubric/                 # Load/Parse: strict decoding and validation of rubric.yaml against the defined IDs
│   ├── scorecard/              # Scorecard, Score, Parse, Total, Blocking, Validate
│   │   └── testdata/           # stub rules and rubric; native-queries/ holds scorecards for the calibration final
│   ├── textstats/              # EditRatio (line-level LCS diff) and Measure, the voicestats metrics
│   │   └── testdata/voice/     # MDX and Markdown with hand-counted sentences
│   ├── corpus/                 # Select: a voice's corpus, by resolving every candidate
│   │   └── testdata/           # stub rules dir and blog posts laid out as the tree, never landing/ or docs/
│   ├── expect/                 # Load: strict decoding and validation of calibration/voices/expect.yaml
│   └── resolve/
│       ├── resolve.go          # Resolver.Resolve, Result, sentinel errors: the resolution table in code
│       ├── voices.go           # New and Profile: slug:, byline: and since: headers from <rules-dir>/voices/*.md
│       ├── frontmatter.go      # authors list and ArticleDate, inside the balanced braces of `export const article = {...}`
│       ├── embed.go            # embedded exclusion list and table, ExclusionList, TableMarkdown, glob matching
│       ├── exclusions.txt      # copy of the `text` fence under "Coverage and generated pages"
│       ├── resolution.md       # copy of the `markdown` fence under "Resolving the scope and the voice"
│       ├── resolve_test.go     # one table case per row of the resolution table, plus profile-loading errors
│       └── testdata/           # stub rules dirs and blog fixtures; never the real .claude/writing or landing/
├── calibration/                # calibration pairs and held-out documents (see calibration/README.md)
├── project.nix                 # Nix build; fileset is the whole tool dir plus .claude/writing and the Nhost Vale styles
└── Makefile                    # Standard shared Makefile targets
```

## The Resolution Contract

`Resolve(path, scope, frontmatter, voiceFlag)` implements the table in `rules.md` row by row, first match wins:

1. Scope from `--scope`, else from the path (`docs/src/content/docs/**` or `landing/src/pages/blog/**`), else an `ErrScopeRequired` error.
2. A path on the exclusion list returns `excluded: true`, scope `docs`, no voice.
3. `--voice <slug>` wins when a profile with that `slug:` exists, and is `ErrUnknownVoice` otherwise. A brief's `author:` slug is passed here.
4. Blog with exactly one author: the profile whose `byline:` equals the author's `name`, else `nhost-blog` with reason `unprofiled author`. Zero or several authors: `ErrVoiceRequired`.
5. Docs: `nhost-docs`.

`nhost-docs` and `nhost-blog` are scope defaults: rows 4 and 5 return them even when their profile file is absent, and a profile with either slug must not carry a `byline:`. `Result.Reason` is a machine-stable string naming the deciding row (`generated page`, `voice flag`, `byline match`, `unprofiled author`, `docs default`); callers may branch on it.

Paths given to `Resolve` are repository-relative. The CLI rewrites a path relative to the working directory, or absolute, against the git root it finds by walking up to a `.git` file or directory. A missing document is resolved with empty frontmatter, so a writer can resolve a page before creating it.

## Voice Corpora

`voicestats` measures a profile from its corpus; `internal/corpus.Select` picks that corpus and `internal/textstats.Measure` measures it. The README holds the metric definitions; change them there and in the command's help together.

- A named voice keeps the candidates that resolve to it. `nhost-blog` (`resolve.BlogVoice`) pools the blog posts that resolve without error to a profiled author, so it is the team average a named profile deviates from. A post that resolves to `nhost-blog` itself has an unprofiled byline and is skipped with `unprofiled author`: `resolve` still gives it the house voice for review, but it is in no corpus.
- A profile's `since:` window then applies, whichever profile carries it. Today only `nhost-blog` does.
- Every held-out path in `calibration/voices/expect.yaml` is set aside from every corpus, not only its own voice's: the discrimination check scores each held-out document against every profile.
- A candidate that fails is skipped with a reason, never an error. Only a missing file, an unknown `--voice` or a broken profile or `expect.yaml` fails the command.

`expect.yaml` lives in its own package because the voice calibration check reads the same file. `blob` and `chosen_at` must be hex SHAs. That check also guards a YAML trap: goccy decodes an unquoted all-digit value as a number, so `0123456` comes back as the octal `42798`. A SHA that does not match the pattern is reported, never silently trusted.

## Scorecards and the Rubric

A scorecard has every rubric dimension, each an integer 0 to 4, `insufficient-evidence`, or `n/a` (only `brief_fidelity`, and only when `brief` is false, in which case it must be). `total` is the weighted mean for the scope scaled to 0..100, with `n/a` dropped from both sum and weights and `insufficient-evidence` counted as 0; `blocking` is the number of blocking dimensions at 0 plus every `SCREENSHOT:`, `VERIFY:` and `<Aside` in the document (the `Nhost.*` Vale tokens). The README has the full shape.

Rubric anchors are keyed by the integers `0`, `2` and `4`; `Anchors.UnmarshalYAML` rejects any other key, because struct tags cannot match integer keys under strict decoding.

## Testing

- Package tests read only `testdata/`, by paths relative to the package directory: the Nix check runs without `.git`, `landing/` or `docs/src/`.
- Two tests read real files instead, by relative path and never through `findRepoRoot`: `drift_test.go` (`../../.claude/writing`, `../../.vale/styles/Nhost`, `rubric/`, `calibration/`) and `TestValidateNativeQueries` in `internal/scorecard`. `project.nix` ships exactly those paths into the sandbox; a new input outside `tools/writing` needs a fileset line there.
- The drift test lives at the tool root because it holds the tool as a whole to the repository, not one package to its contract.
- `golangci-lint run --fix` runs `misspell` over tests too, so a deliberate typo in a test string (an unknown YAML key, say) gets "corrected" while its fixture keeps the typo. Use an unknown key that is a real word, such as `picked_by`.
- `testdata/rules/voices/` holds stub `nhost-docs`, `nhost-blog` and author profiles; `testdata/authors-only/` proves the defaults resolve without their profile files; `testdata/bad/*` holds one broken header per directory.
- Every row of the resolution table needs a case in `TestResolve`. Changing the table in the rules doc without a matching case is a review finding.

## Development Workflow

1. Run the tool from the repository root: `go run ./tools/writing resolve <path>`.
2. Run `go test ./tools/writing/...`, then the mandatory post-change checks from `.claude/docs/go-design-rules.md`, scoped as `golines -w --base-formatter=gofumpt tools/writing && golangci-lint run --fix ./tools/writing/...`. Run them inside `nix develop .#writing -c ...` when the `golangci-lint` on your `PATH` was built with an older Go: it refuses the module's Go 1.27.0 with `can't load config`.
3. `make check` in `tools/writing` runs the Nix check, which also fails on unformatted code and on any `go generate` diff.
4. Run `go mod vendor` and `make check` one after the other, never in parallel. A `make check` that overlaps a `go mod vendor` rewrite fails with `cannot read directory ".../vendor/<module>"`, and the run straight after can fail the same way. Rerun it once the vendor tree has settled.
