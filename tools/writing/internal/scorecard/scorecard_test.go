package scorecard_test

import (
	"encoding/json"
	"errors"
	"math"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/tools/writing/internal/rubric"
	"github.com/nhost/nhost/tools/writing/internal/ruleid"
	"github.com/nhost/nhost/tools/writing/internal/scorecard"
)

func load(t *testing.T, rulesDir, rubricPath string) (ruleid.Set, *rubric.Rubric) {
	t.Helper()

	ids, err := ruleid.Load(rulesDir)
	if err != nil {
		t.Fatalf("ruleid.Load: %v", err)
	}

	rb, err := rubric.Load(rubricPath, ids)
	if err != nil {
		t.Fatalf("rubric.Load: %v", err)
	}

	return ids, rb
}

func readFile(t *testing.T, path string) []byte {
	t.Helper()

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("reading %s: %v", path, err)
	}

	return data
}

func points(p float64) scorecard.Score {
	return scorecard.Score{Points: p, Mark: ""}
}

func mark(m string) scorecard.Score {
	return scorecard.Score{Points: 0, Mark: m}
}

// base is a valid docs scorecard for testdata/clean.mdx under
// testdata/rubric.yaml: (4*1 + 2*1 + 3*2) / 4 = 3, so the total is 75.
func base() scorecard.Scorecard {
	return scorecard.Scorecard{
		Document: "docs/src/content/docs/stub.mdx",
		Scope:    "docs",
		Voice:    "nhost-docs",
		Brief:    true,
		Dimensions: map[string]scorecard.Score{
			"audience_and_task": points(4),
			"brief_fidelity":    points(2),
			"factual_grounding": points(3),
		},
		Evidence: []scorecard.Evidence{
			{
				Quote:  "This page is for developers who run a project locally.",
				RuleID: "WR-CONTENT-01",
				Note:   "Names the reader.",
			},
		},
		Total:    75,
		Blocking: 0,
	}
}

func TestParse(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		json     string
		want     scorecard.Scorecard
		wantErr  error
		wantText string
	}{
		{
			name: "numbers and marks",
			json: `{"document": "draft", "scope": "blog", "voice": "nhost-blog", "brief": false,
				"dimensions": {"audience_and_task": 3, "brief_fidelity": "n/a",
					"factual_grounding": "insufficient-evidence"},
				"evidence": [{"quote": "q", "rule_id": "WR-CONTENT-01", "note": "n"}],
				"total": 37.5, "blocking": 1}`,
			want: scorecard.Scorecard{
				Document: "draft",
				Scope:    "blog",
				Voice:    "nhost-blog",
				Brief:    false,
				Dimensions: map[string]scorecard.Score{
					"audience_and_task": points(3),
					"brief_fidelity":    mark(scorecard.MarkNA),
					"factual_grounding": mark(scorecard.MarkInsufficientEvidence),
				},
				Evidence: []scorecard.Evidence{{Quote: "q", RuleID: "WR-CONTENT-01", Note: "n"}},
				Total:    37.5,
				Blocking: 1,
			},
		},
		{
			name: "unknown key",
			json: `{"document": "draft", "scope": "docs", "voice": "nhost-docs", "brief": true,
				"dimensions": {}, "evidence": [], "total": 0, "blocking": 0, "model": "x"}`,
			wantErr:  scorecard.ErrParse,
			wantText: `unknown field "model"`,
		},
		{
			name:     "missing keys",
			json:     `{"document": "draft", "scope": "docs", "brief": true, "dimensions": {}}`,
			wantErr:  scorecard.ErrParse,
			wantText: "missing voice, evidence, total, blocking",
		},
		{
			name: "score that is neither a number nor a string",
			json: `{"document": "draft", "scope": "docs", "voice": "nhost-docs", "brief": true,
				"dimensions": {"structure": true}, "evidence": [], "total": 0, "blocking": 0}`,
			wantErr:  scorecard.ErrParse,
			wantText: "score true is neither a number nor a string",
		},
		{
			name:    "not JSON",
			json:    `total: 3`,
			wantErr: scorecard.ErrParse,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := scorecard.Parse([]byte(tt.json))
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("Parse() error = %v, want %v", err, tt.wantErr)
			}

			if tt.wantText != "" && !strings.Contains(err.Error(), tt.wantText) {
				t.Errorf("Parse() error = %q, want it to contain %q", err.Error(), tt.wantText)
			}

			if diff := cmp.Diff(tt.want, got); diff != "" {
				t.Errorf("Parse() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestScoreMarshalJSON(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		score scorecard.Score
		want  string
	}{
		{name: "points", score: points(3), want: `3`},
		{name: "zero", score: points(0), want: `0`},
		{name: "n/a", score: mark(scorecard.MarkNA), want: `"n/a"`},
		{
			name:  "insufficient evidence",
			score: mark(scorecard.MarkInsufficientEvidence),
			want:  `"insufficient-evidence"`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			data, err := json.Marshal(tt.score)
			if err != nil {
				t.Fatalf("Marshal: %v", err)
			}

			if string(data) != tt.want {
				t.Errorf("Marshal() = %s, want %s", data, tt.want)
			}

			var got scorecard.Score
			if err := json.Unmarshal(data, &got); err != nil {
				t.Fatalf("Unmarshal: %v", err)
			}

			if got != tt.score {
				t.Errorf("round trip = %+v, want %+v", got, tt.score)
			}
		})
	}
}

func TestTotal(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		scope string
		dims  map[string]scorecard.Score
		want  float64
	}{
		{
			name:  "docs weights grounding twice",
			scope: "docs",
			dims:  base().Dimensions,
			want:  75,
		},
		{
			name:  "blog weights the brief three times",
			scope: "blog",
			dims:  base().Dimensions,
			want:  65,
		},
		{
			name:  "n/a brief dropped from sum and weights, docs",
			scope: "docs",
			dims: map[string]scorecard.Score{
				"audience_and_task": points(4),
				"brief_fidelity":    mark(scorecard.MarkNA),
				"factual_grounding": points(3),
			},
			want: 250.0 / 3,
		},
		{
			name:  "n/a brief dropped from sum and weights, blog",
			scope: "blog",
			dims: map[string]scorecard.Score{
				"audience_and_task": points(4),
				"brief_fidelity":    mark(scorecard.MarkNA),
				"factual_grounding": points(3),
			},
			want: 87.5,
		},
		{
			name:  "insufficient evidence counts as 0",
			scope: "docs",
			dims: map[string]scorecard.Score{
				"audience_and_task": points(4),
				"brief_fidelity":    points(2),
				"factual_grounding": mark(scorecard.MarkInsufficientEvidence),
			},
			want: 37.5,
		},
		{
			name:  "all fours",
			scope: "blog",
			dims: map[string]scorecard.Score{
				"audience_and_task": points(4),
				"brief_fidelity":    points(4),
				"factual_grounding": points(4),
			},
			want: 100,
		},
		{
			name:  "nothing scored",
			scope: "docs",
			dims:  map[string]scorecard.Score{"brief_fidelity": mark(scorecard.MarkNA)},
			want:  0,
		},
	}

	_, rb := load(t, filepath.Join("testdata", "rules"), filepath.Join("testdata", "rubric.yaml"))

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			scope, ok := rb.Scope(tt.scope)
			if !ok {
				t.Fatalf("no scope %q", tt.scope)
			}

			if got := scorecard.Total(scope, tt.dims); math.Abs(got-tt.want) > 1e-9 {
				t.Errorf("Total() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestBlocking(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		scope string
		dims  map[string]scorecard.Score
		doc   string
		want  int
	}{
		{
			name:  "nothing blocking",
			scope: "docs",
			dims:  base().Dimensions,
			doc:   "clean.mdx",
			want:  0,
		},
		{
			name:  "blocking dimension at 0",
			scope: "docs",
			dims: map[string]scorecard.Score{
				"audience_and_task": points(4),
				"brief_fidelity":    points(0),
				"factual_grounding": points(0),
			},
			doc:  "clean.mdx",
			want: 1,
		},
		{
			name:  "the blog blocks on the brief instead",
			scope: "blog",
			dims: map[string]scorecard.Score{
				"audience_and_task": points(4),
				"brief_fidelity":    points(0),
				"factual_grounding": points(0),
			},
			doc:  "clean.mdx",
			want: 1,
		},
		{
			name:  "n/a brief never blocks",
			scope: "blog",
			dims: map[string]scorecard.Score{
				"audience_and_task": points(0),
				"brief_fidelity":    mark(scorecard.MarkNA),
				"factual_grounding": points(0),
			},
			doc:  "clean.mdx",
			want: 0,
		},
		{
			name:  "insufficient evidence does not block",
			scope: "docs",
			dims: map[string]scorecard.Score{
				"audience_and_task": points(4),
				"brief_fidelity":    points(2),
				"factual_grounding": mark(scorecard.MarkInsufficientEvidence),
			},
			doc:  "clean.mdx",
			want: 0,
		},
		{
			name:  "each placeholder and Aside counts",
			scope: "docs",
			dims:  base().Dimensions,
			doc:   "placeholders.mdx",
			want:  4,
		},
		{
			name:  "dimension and placeholders add up",
			scope: "docs",
			dims: map[string]scorecard.Score{
				"audience_and_task": points(4),
				"brief_fidelity":    points(2),
				"factual_grounding": points(0),
			},
			doc:  "placeholders.mdx",
			want: 5,
		},
	}

	_, rb := load(t, filepath.Join("testdata", "rules"), filepath.Join("testdata", "rubric.yaml"))

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			scope, ok := rb.Scope(tt.scope)
			if !ok {
				t.Fatalf("no scope %q", tt.scope)
			}

			doc := readFile(t, filepath.Join("testdata", tt.doc))
			if got := scorecard.Blocking(scope, tt.dims, doc); got != tt.want {
				t.Errorf("Blocking() = %d, want %d", got, tt.want)
			}
		})
	}
}

func TestValidate(t *testing.T) { //nolint:maintidx // one flat table of cases
	t.Parallel()

	tests := []struct {
		name   string
		mutate func(sc *scorecard.Scorecard)
		scope  string
		doc    string
		// want lists the problems Validate must report; empty means valid.
		want []string
	}{
		{
			name:   "valid",
			mutate: func(*scorecard.Scorecard) {},
		},
		{
			name:   "valid against the resolved scope",
			mutate: func(*scorecard.Scorecard) {},
			scope:  "docs",
		},
		{
			name: "quote across a line break and extra spaces",
			mutate: func(sc *scorecard.Scorecard) {
				sc.Evidence[0].Quote = "who run a project locally.   After it, you can create a native query."
			},
		},
		{
			name: "brief_fidelity n/a without a brief, total rounded",
			mutate: func(sc *scorecard.Scorecard) {
				sc.Brief = false
				sc.Dimensions["brief_fidelity"] = mark(scorecard.MarkNA)
				sc.Total = 83.3
			},
		},
		{
			name: "blog scope",
			mutate: func(sc *scorecard.Scorecard) {
				sc.Scope = "blog"
				sc.Total = 65
			},
		},
		{
			name: "insufficient evidence counts as 0",
			mutate: func(sc *scorecard.Scorecard) {
				sc.Dimensions["factual_grounding"] = mark(scorecard.MarkInsufficientEvidence)
				sc.Total = 37.5
			},
		},
		{
			name: "blocking dimension at 0",
			mutate: func(sc *scorecard.Scorecard) {
				sc.Dimensions["factual_grounding"] = points(0)
				sc.Total = 37.5
				sc.Blocking = 1
			},
		},
		{
			name: "placeholders counted",
			mutate: func(sc *scorecard.Scorecard) {
				sc.Evidence[0].Quote = "SCREENSHOT: /images/products/database/stub/list.png"
				sc.Blocking = 4
			},
			doc: "placeholders.mdx",
		},
		{
			name: "hallucinated quote",
			mutate: func(sc *scorecard.Scorecard) {
				sc.Evidence[0].Quote = "This page is for developers who run a project in the cloud."
			},
			want: []string{
				`evidence 0: quote not found in the document: "This page is for developers who run a project in the cloud."`,
			},
		},
		{
			name:   "empty quote",
			mutate: func(sc *scorecard.Scorecard) { sc.Evidence[0].Quote = " \n " },
			want:   []string{"evidence 0: quote is empty"},
		},
		{
			name:   "undefined rule ID",
			mutate: func(sc *scorecard.Scorecard) { sc.Evidence[0].RuleID = "WR-CONTENT-02" },
			want:   []string{`evidence 0: rule_id "WR-CONTENT-02" is not a defined rule ID`},
		},
		{
			name:   "malformed rule ID",
			mutate: func(sc *scorecard.Scorecard) { sc.Evidence[0].RuleID = "WR-CONTENT-01: opening" },
			want: []string{
				`evidence 0: rule_id "WR-CONTENT-01: opening" is not a defined rule ID`,
			},
		},
		{
			name:   "empty note",
			mutate: func(sc *scorecard.Scorecard) { sc.Evidence[0].Note = "" },
			want:   []string{"evidence 0: note is empty"},
		},
		{
			name:   "score above 4",
			mutate: func(sc *scorecard.Scorecard) { sc.Dimensions["audience_and_task"] = points(5) },
			want:   []string{"dimension audience_and_task: score 5 is not an integer from 0 to 4"},
		},
		{
			name:   "negative score",
			mutate: func(sc *scorecard.Scorecard) { sc.Dimensions["audience_and_task"] = points(-1) },
			want:   []string{"dimension audience_and_task: score -1 is not an integer from 0 to 4"},
		},
		{
			name:   "fractional score",
			mutate: func(sc *scorecard.Scorecard) { sc.Dimensions["audience_and_task"] = points(2.5) },
			want: []string{
				"dimension audience_and_task: score 2.5 is not an integer from 0 to 4",
			},
		},
		{
			name:   "missing dimension",
			mutate: func(sc *scorecard.Scorecard) { delete(sc.Dimensions, "factual_grounding") },
			want:   []string{"dimension factual_grounding: missing"},
		},
		{
			name:   "dimension the rubric does not have",
			mutate: func(sc *scorecard.Scorecard) { sc.Dimensions["voice_match"] = points(3) },
			want:   []string{"dimension voice_match: not in the rubric"},
		},
		{
			name: "n/a on another dimension",
			mutate: func(sc *scorecard.Scorecard) {
				sc.Dimensions["audience_and_task"] = mark(scorecard.MarkNA)
			},
			want: []string{`dimension audience_and_task: "n/a" is only allowed for brief_fidelity`},
		},
		{
			name: "n/a brief_fidelity with a brief",
			mutate: func(sc *scorecard.Scorecard) {
				sc.Dimensions["brief_fidelity"] = mark(scorecard.MarkNA)
			},
			want: []string{`dimension brief_fidelity: "n/a" is only allowed when brief is false`},
		},
		{
			name:   "brief_fidelity scored without a brief",
			mutate: func(sc *scorecard.Scorecard) { sc.Brief = false },
			want:   []string{`dimension brief_fidelity: must be "n/a" when brief is false, got 2`},
		},
		{
			name: "brief_fidelity insufficient without a brief",
			mutate: func(sc *scorecard.Scorecard) {
				sc.Brief = false
				sc.Dimensions["brief_fidelity"] = mark(scorecard.MarkInsufficientEvidence)
			},
			want: []string{
				`dimension brief_fidelity: must be "n/a" when brief is false, got "insufficient-evidence"`,
			},
		},
		{
			name:   "unknown mark",
			mutate: func(sc *scorecard.Scorecard) { sc.Dimensions["factual_grounding"] = mark("skip") },
			want: []string{
				`dimension factual_grounding: unknown mark "skip", want a score, "n/a" or "insufficient-evidence"`,
			},
		},
		{
			name:   "total that does not match",
			mutate: func(sc *scorecard.Scorecard) { sc.Total = 80 },
			want:   []string{"total 80 does not match the recomputed 75.0"},
		},
		{
			name:   "total rounded too far",
			mutate: func(sc *scorecard.Scorecard) { sc.Total = 75.1 },
			want:   []string{"total 75.1 does not match the recomputed 75.0"},
		},
		{
			name: "blocking dimension at 0 not counted",
			mutate: func(sc *scorecard.Scorecard) {
				sc.Dimensions["factual_grounding"] = points(0)
				sc.Total = 37.5
			},
			want: []string{
				"blocking 0 does not match the recomputed 1 " +
					"(blocking dimensions at 0: factual_grounding; placeholders and <Aside>: 0)",
			},
		},
		{
			name: "placeholders not counted",
			mutate: func(sc *scorecard.Scorecard) {
				sc.Evidence[0].Quote = "Requires a recent version."
			},
			doc: "placeholders.mdx",
			want: []string{
				"blocking 0 does not match the recomputed 4 " +
					"(blocking dimensions at 0: none; placeholders and <Aside>: 4)",
			},
		},
		{
			name:   "scope the rubric does not have",
			mutate: func(sc *scorecard.Scorecard) { sc.Scope = "landing" },
			want:   []string{`scope "landing" is not in the rubric`},
		},
		{
			name:   "scope other than the resolved one",
			mutate: func(*scorecard.Scorecard) {},
			scope:  "blog",
			want:   []string{`scope "docs" does not match the resolved scope "blog"`},
		},
		{
			name: "every problem is listed",
			mutate: func(sc *scorecard.Scorecard) {
				sc.Dimensions["audience_and_task"] = points(5)
				sc.Evidence[0].Quote = "invented"
				sc.Total = 1
			},
			want: []string{
				"dimension audience_and_task: score 5 is not an integer from 0 to 4",
				`evidence 0: quote not found in the document: "invented"`,
			},
		},
	}

	ids, rb := load(t, filepath.Join("testdata", "rules"), filepath.Join("testdata", "rubric.yaml"))

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			sc := base()
			tt.mutate(&sc)

			doc := tt.doc
			if doc == "" {
				doc = "clean.mdx"
			}

			err := scorecard.Validate(
				sc,
				rb,
				tt.scope,
				ids,
				readFile(t, filepath.Join("testdata", doc)),
			)
			if len(tt.want) == 0 {
				if err != nil {
					t.Fatalf("Validate() error = %v, want nil", err)
				}

				return
			}

			if !errors.Is(err, scorecard.ErrInvalid) {
				t.Fatalf("Validate() error = %v, want %v", err, scorecard.ErrInvalid)
			}

			want := "invalid scorecard:\n- " + strings.Join(tt.want, "\n- ")
			if diff := cmp.Diff(want, err.Error()); diff != "" {
				t.Errorf("Validate() error mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

// TestValidateNativeQueries validates hand-written scorecards for the
// calibration final against the real rubric and rules, the same check as
// `writing validate`.
func TestValidateNativeQueries(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		file string
		want string
	}{
		{name: "real quotes, defined IDs, correct total", file: "pass.json"},
		{
			name: "one quote altered by a word",
			file: "altered-quote.json",
			want: "invalid scorecard:\n- evidence 1: quote not found in the document: " +
				"\"In our example, we have one `post_summary` logical model with fields " +
				"`id`, `title`, `body`, `views`, and `popularity`.\"",
		},
		{
			name: "score out of range",
			file: "out-of-range.json",
			want: "invalid scorecard:\n- dimension audience_and_task: score 5 is not an integer from 0 to 4",
		},
	}

	ids, rb := load(
		t,
		filepath.Join("..", "..", "..", "..", ".claude", "writing"),
		filepath.Join("..", "..", "rubric", "rubric.yaml"),
	)
	doc := readFile(
		t,
		filepath.Join("..", "..", "calibration", "docs", "native-queries", "final.mdx"),
	)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			sc, err := scorecard.Parse(
				readFile(t, filepath.Join("testdata", "native-queries", tt.file)),
			)
			if err != nil {
				t.Fatalf("Parse: %v", err)
			}

			err = scorecard.Validate(sc, rb, "docs", ids, doc)

			var got string
			if err != nil {
				got = err.Error()
			}

			if diff := cmp.Diff(tt.want, got); diff != "" {
				t.Errorf("Validate() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
