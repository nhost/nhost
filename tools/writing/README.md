# writing

The Go tool behind the Nhost docs and blog writing standard. The standard is
defined in `.claude/writing/`: the shared rules in `rules.md`, a scope
per destination in `scopes/` and a voice profile per voice in
`voices/`. This tool applies the mechanical parts of it so that people and
agents get the same answer.

## Commands

### `resolve`

Prints, as JSON, the scope and voice a document is written and reviewed
against, following the resolution table in `rules.md`.

```sh
writing resolve [--scope docs|blog] [--voice <slug>] [--rules-dir <dir>] [<path>]
```

| Flag | Default | Description |
| --- | --- | --- |
| `--scope` | from the path | `docs` or `blog`. Required when no path is given or the path is outside `docs/src/content/docs/` and `landing/src/pages/blog/`. |
| `--voice` | from the byline or the scope | Slug of a profile in `voices/`. Wins over the byline; `--voice nhost-blog` gives any post the neutral house voice. |
| `--rules-dir` | `<git root>/.claude/writing` | Directory holding the writing rules and `voices/`. |

```sh
go run ./tools/writing resolve docs/src/content/docs/products/auth/sign-in-magic-link.mdx
```

```json
{"scope":"docs","voice":"nhost-docs","excluded":false,"reason":"docs default"}
```

A generated page prints `"excluded":true` and no voice; skip it. A blog post
with zero or several authors and no `--voice`, a path outside both trees with
no `--scope`, or a `--voice` that names no profile prints the fix to stderr
and exits 1:

```text
--voice required: 2 authors listed (David Barroso, Nuno Pato)
```

### `validate`

Checks a judge scorecard against the rubric, the defined rule IDs and the
document it scores. It never trusts the scorecard's arithmetic: it
recomputes `total` and `blocking` and reports any difference. It only reads;
it never rewrites the scorecard.

```sh
writing validate --against <file> [--scope docs|blog] [--rules-dir <dir>] [--rubric <file>] <scorecard.json>
```

| Flag | Default | Description |
| --- | --- | --- |
| `--against` | required | The document the scorecard scores. Every evidence quote must appear in it. |
| `--scope` | the scorecard's `scope` | The scope the caller resolved; the scorecard must declare the same one. |
| `--rules-dir` | `<git root>/.claude/writing` | Where the rule IDs are defined. |
| `--rubric` | `<git root>/tools/writing/rubric/rubric.yaml` | The rubric to score against. |

A valid scorecard prints `ok:` with its total and blocking count and exits 0;
any dimension marked `insufficient-evidence` is noted first. Otherwise every
problem is listed and the command exits 1:

```text
score.json: invalid scorecard:
- dimension audience_and_task: score 5 is not an integer from 0 to 4
- evidence 1: quote not found in the document: "In our example, we have one `post_summary` logical model"
```

The checks:

- Every rubric dimension is present, and no other. A score is an integer
  from 0 to 4, `insufficient-evidence`, or, for `brief_fidelity` only and
  only when `brief` is `false`, `n/a`; without a brief, `brief_fidelity`
  must be `n/a`.
- Every `rule_id` is a rule ID defined in `rules.md` or
  `scopes/*.md`, and every `note` is non-empty.
- Every `quote` appears in the document after both are whitespace-normalised:
  runs of spaces, tabs and newlines collapse to one space and the ends are
  trimmed. A quote that is not there is a hallucination and rejects the
  scorecard.
- `total` is within 0.05 of the recomputed total, so a judge may round it to
  one decimal place.
- `blocking` equals the recomputed count.

### `editratio`

Prints the share of lines that changed between two versions of a document,
`(insertions + deletions) / (lines in a + lines in b)`, from a minimal line
diff, to three decimal places: 0 is identical, 1 is no line in common. It
matches `git diff --numstat`.

```sh
go run ./tools/writing editratio tools/writing/calibration/docs/native-queries/draft.mdx tools/writing/calibration/docs/native-queries/final.mdx
```

```text
0.458
```

That is the native-queries baseline: 109 insertions and 111 deletions over
241 and 239 lines.

### `voicestats`

Measures the corpus of one voice profile, so a profile's stats table is
reproducible from the command rather than asserted.

```sh
writing voicestats --voice <slug> [--format table|json] [--rules-dir <dir>] [--expect <file>] <file>...
```

| Flag | Default | Description |
| --- | --- | --- |
| `--voice` | required | Slug of the profile whose corpus to measure. The profile must exist. |
| `--format` | `table` | `table` prints Markdown; `json` prints one stable JSON object. |
| `--rules-dir` | `<git root>/.claude/writing` | Directory holding `voices/`. |
| `--expect` | `<git root>/tools/writing/calibration/voices/expect.yaml` | The held-out documents to set aside. |

Pass every candidate and let the filter choose; from the repository root:

```sh
go run ./tools/writing voicestats --voice nuno-pato landing/src/pages/blog/*.mdx
find docs/src/content/docs -type f \( -name '*.mdx' -o -name '*.md' \) -print0 | sort -z \
  | xargs -0 go run ./tools/writing voicestats --voice nhost-docs
```

The filter resolves each file as `resolve` would, with no flags:

- A named voice keeps the files that resolve to it.
- `nhost-blog`, the house voice, keeps the blog posts that resolve without
  error to a profiled author, so it is the average of the current team's
  posts and a named author's profile is the deviation from it. A post that
  resolves to `nhost-blog` itself has an unprofiled byline and is skipped
  as `unprofiled author`; it still resolves to the house voice for review.
- When the profile has a `since:`, a post dated before it, or with no
  `date` in `export const article`, is skipped.
- A path that is any voice's held-out document in `expect.yaml` is set
  aside and listed as held out.

Everything else is skipped with a reason, never an error: co-authored posts
(`--voice required`), generated pages, files outside both trees and other
voices' documents. Held-out and skipped paths go to stderr, one per line,
and into the output, after the stats.

Before measuring, each document loses its leading `---` frontmatter,
`{/* */}` comments, fenced code blocks, `import` lines and `export` blocks
outside fences, and JSX or HTML tags; the text between tags stays. The rest
splits into paragraphs at blank lines, headings, list items, table rows and
`:::` directive lines; each list item is a paragraph of its own, and
headings, table rows and directive lines are not prose. A paragraph splits
into sentences after each `.`, `!` or `?` followed by whitespace, so `e.g.`
followed by a space ends a sentence. Links and images are reduced to their
text, and `**`, `__` and backticks are dropped. Over the pooled sentences of
the corpus, so a long document weighs more than a short one:

| Stat | Definition |
| --- | --- |
| Words | Whitespace-separated words in prose sentences, not in headings, tables or code. |
| Mean and median sentence length | Words per sentence. |
| First person plural sentences | Sentences containing `we`, `our` or `let's` in any case, or `us` in lower case, so the `US` of a region does not count. |
| Second person sentences | Sentences containing `you` or `your`. |
| First person plural per second person | The first count over the second; `n/a` (JSON `null`) with no second-person sentence. |
| Imperative openings | Share of sentences whose first word, in lower case, is one of `run`, `open`, `create`, `add`, `set`, `click`, `install`, `use`, `go`, `select`, `copy`, `paste`, `enable`, `configure`, `deploy`, `start`, `check`, `make`, `call`, `define`, `update`, `remove`, `delete`, `navigate`, `choose`, `enter`, `save`, `import`, `export`, `edit`, `replace`, `see`, `note`, `try`. |
| Questions | Share of sentences ending in `?`. |
| Headings per 1k words | `##`, `###` and `####` lines outside fences, per 1,000 words. |
| Bold spans per 1k words | `**...**` spans on one line outside fences, headings and tables included. |
| List items per 1k words | Lines starting with `-`, `*`, `+`, `N.` or `N)` and a space, outside fences. |
| Code blocks per 1k words | Fenced blocks, counted at their opening line. |

The table prints each rate with the count behind it. The JSON object has
`voice`, `corpus` (the kept paths), `held_out`, `skipped` (`path` and
`reason`) and `stats`, whose rates are rounded to four decimal places.

## The rubric

[`rubric/rubric.yaml`](rubric/rubric.yaml) is the one rubric for docs and
blog. It has eight dimensions: `audience_and_task`, `brief_fidelity`,
`running_example`, `factual_grounding`, `structure`, `scope_conventions`,
`voice_match` and `antipatterns`. Each lists the rule IDs it scores under
`covers` and the anchors a judge applies for 0, 2 and 4; 1 and 3 fall
between them. The `scopes` section gives each scope a weight per
dimension and its blocking dimensions:

| Scope | Weighted high (2) | Blocking |
| --- | --- | --- |
| `docs` | `running_example` | `factual_grounding` |
| `blog` | `brief_fidelity`, `voice_match` | `brief_fidelity` |

Weights are relative, 1 by default. The rubric is loaded strictly: an
unknown key, a missing anchor, an undefined rule ID, or a scope that
weights an unknown dimension or misses one is an error. A rubric scope
needs no scope file of its own, though `docs` and `blog` both have one.

## Scorecards

A judge emits one scorecard per document:

```json
{
  "document": "docs/src/content/docs/products/database/native-queries.mdx",
  "scope": "docs",
  "voice": "nhost-docs",
  "brief": false,
  "dimensions": {
    "audience_and_task": 4,
    "brief_fidelity": "n/a",
    "running_example": 4,
    "factual_grounding": 4,
    "structure": 3,
    "scope_conventions": 4,
    "voice_match": 3,
    "antipatterns": "insufficient-evidence"
  },
  "evidence": [
    {"quote": "In our example, we have a `post_summary` logical model", "rule_id": "WR-CONTENT-03", "note": "The running example is named and carried on."}
  ],
  "total": 81.25,
  "blocking": 0
}
```

- `document` is the repository-relative path, or `draft` for text that is
  not in the tree. `brief` says whether a brief was supplied.
- `total` is the weighted mean of the dimensions for the scope, scaled from
  0 to 4 onto 0 to 100. An `n/a` dimension is dropped from both the sum and
  the weights; an `insufficient-evidence` dimension counts as 0. Above, the
  docs weights give `(4 + 2×4 + 4 + 3 + 4 + 3 + 0) / 8 × 25 = 81.25`.
- `blocking` counts hard-rule violations: each of the scope's blocking
  dimensions scored 0, plus each `SCREENSHOT:` placeholder, `VERIFY:` marker
  and `<Aside` in the document, the same tokens the `Nhost.*` Vale rules
  match. `n/a` and `insufficient-evidence` never block.
- Every key is required and an unknown key is an error.

Commands that write scorecards put them in
`.nhost-code/review/writing/<slug>-<sha|draft>.json`, which is gitignored.
They are working files. The durable record of a calibration run is
`calibration/RESULTS.md`.

## The drift test

Rule IDs join the rules doc, the scopes, the rubric, the calibration
deltas, the Vale messages and review findings. `drift_test.go` holds all but
the findings to the IDs defined in `.claude/writing/rules.md` and
`.claude/writing/scopes/*.md`, read with the ID grep from the rules
doc. It fails, naming the ID or the file, when:

- an ID is defined twice;
- the rubric cites an undefined ID anywhere, or fails to load;
- a row of any `calibration/docs/*/deltas.md` cites no ID or an undefined
  one;
- the message of a `.vale/styles/Nhost/*.yml` rule cites no ID or an
  undefined one;
- a voice profile under `.claude/writing/voices/` cites any ID;
- the embedded exclusion list or resolution table differs by a byte from
  its `text` or `markdown` fence in `rules.md`.

To change a rule ID, change its definition and every citation in the same
commit; the test reads the real files, so it runs in the Nix check too.

## Running it

From the repository root, with Go on the path:

```sh
go run ./tools/writing resolve <path>
```

Or in the tool's dev shell, or as a built binary:

```sh
nix develop '.#writing'
nix build '.#writing' && ./result/bin/writing resolve --scope docs
```

## Calibration

The calibration pairs and held-out documents live in
[`calibration/`](calibration/README.md).
