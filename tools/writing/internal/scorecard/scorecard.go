// Package scorecard defines the judge scorecard, the JSON a judge emits for one
// document, and validates a scorecard against the rubric, the defined rule IDs
// and the document it scores. Validation recomputes the total and the
// blocking count instead of trusting them, and rejects any evidence quote
// that does not appear in the document.
package scorecard

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"regexp"
	"slices"
	"strings"

	"github.com/nhost/nhost/tools/writing/internal/rubric"
	"github.com/nhost/nhost/tools/writing/internal/ruleid"
)

// Marks a dimension can carry instead of a score.
const (
	// MarkNA is only valid for [rubric.BriefFidelity] when no brief was
	// supplied; the dimension is dropped from the total.
	MarkNA = "n/a"
	// MarkInsufficientEvidence means the judge could not quote evidence for
	// the dimension; it counts as 0 in the total and never as blocking.
	MarkInsufficientEvidence = "insufficient-evidence"
)

const (
	maxPoints = 4
	// totalScale maps the 0..4 weighted mean onto 0..100.
	totalScale = 100.0 / maxPoints
	// totalTolerance is how far a scorecard's total may be from the
	// recomputed one, so a judge may round it to one decimal; the extra
	// 1e-9 absorbs float error at exactly 0.05.
	totalTolerance = 0.05 + 1e-9
)

var (
	// ErrParse means the scorecard is not valid JSON of the scorecard shape.
	ErrParse = errors.New("cannot parse scorecard")
	// ErrInvalid means the scorecard does not hold against the rubric or the
	// document; the error lists every problem.
	ErrInvalid = errors.New("invalid scorecard")
)

// hardRuleRe matches what makes a document blocking whatever its scores: a
// shipped placeholder or an `<Aside>`. The patterns are the tokens of the
// Vale rules `Nhost.ScreenshotPlaceholder`, `Nhost.VerifyMarker` and
// `Nhost.Aside`.
var hardRuleRe = regexp.MustCompile(`SCREENSHOT:|VERIFY:|<Aside\b`)

// Scorecard is a judge's verdict on one document.
type Scorecard struct {
	// Document is the repository-relative path scored, or `draft`.
	Document string `json:"document"`
	Scope    string `json:"scope"`
	Voice    string `json:"voice"`
	// Brief reports whether a brief was supplied.
	Brief bool `json:"brief"`
	// Dimensions holds one score per rubric dimension.
	Dimensions map[string]Score `json:"dimensions"`
	Evidence   []Evidence       `json:"evidence"`
	// Total is the weighted mean of the dimensions for Scope, 0 to 100.
	Total float64 `json:"total"`
	// Blocking counts hard-rule violations; see [Blocking].
	Blocking int `json:"blocking"`
}

// Evidence is one quoted finding.
type Evidence struct {
	// Quote is verbatim text from the document; whitespace may differ.
	Quote  string `json:"quote"`
	RuleID string `json:"rule_id"`
	Note   string `json:"note"`
}

// Score is a dimension's score: Points from 0 to 4 when Mark is empty, else
// [MarkNA] or [MarkInsufficientEvidence]. In JSON it is a number or a string.
type Score struct {
	Points float64
	Mark   string
}

// MarshalJSON writes the mark as a string, or the points as a number.
func (s Score) MarshalJSON() ([]byte, error) {
	if s.Mark != "" {
		return json.Marshal(s.Mark) //nolint:wrapcheck // encoding a plain string
	}

	return json.Marshal(s.Points) //nolint:wrapcheck // encoding a plain number
}

// UnmarshalJSON reads a number as points and a string as a mark. Whether
// either is allowed is decided by [Validate], so every problem is reported.
func (s *Score) UnmarshalJSON(data []byte) error {
	var v any
	if err := json.Unmarshal(data, &v); err != nil {
		return fmt.Errorf("decoding score: %w", err)
	}

	switch v := v.(type) {
	case float64:
		*s = Score{Points: v, Mark: ""}
	case string:
		*s = Score{Points: 0, Mark: v}
	default:
		return fmt.Errorf("%w: score %s is neither a number nor a string", ErrParse, data)
	}

	return nil
}

// Parse decodes a scorecard strictly: every key of the shape is required and
// an unknown key is an error.
func Parse(data []byte) (Scorecard, error) {
	var keys map[string]json.RawMessage
	if err := json.Unmarshal(data, &keys); err != nil {
		return Scorecard{}, fmt.Errorf("%w: %w", ErrParse, err)
	}

	var missing []string

	for _, key := range []string{
		"document", "scope", "voice", "brief", "dimensions", "evidence", "total", "blocking",
	} {
		if _, ok := keys[key]; !ok {
			missing = append(missing, key)
		}
	}

	if len(missing) > 0 {
		return Scorecard{}, fmt.Errorf("%w: missing %s", ErrParse, strings.Join(missing, ", "))
	}

	dec := json.NewDecoder(bytes.NewReader(data))
	dec.DisallowUnknownFields()

	var sc Scorecard
	if err := dec.Decode(&sc); err != nil {
		return Scorecard{}, fmt.Errorf("%w: %w", ErrParse, err)
	}

	return sc, nil
}

// Total returns the weighted mean of dims under t, scaled from 0..4 to
// 0..100. [MarkNA] dimensions are dropped from both the sum and the weights;
// [MarkInsufficientEvidence] counts as 0.
func Total(t rubric.Scope, dims map[string]Score) float64 {
	var sum, weights float64

	for name, score := range dims {
		if score.Mark == MarkNA {
			continue
		}

		w := t.Weights[name]
		weights += w

		if score.Mark == "" {
			sum += w * score.Points
		}
	}

	if weights == 0 {
		return 0
	}

	return sum / weights * totalScale
}

// Blocking counts the hard-rule violations: each blocking dimension of t
// scored 0, plus each `SCREENSHOT:` or `VERIFY:` placeholder and each
// `<Aside` in doc. A dimension marked [MarkInsufficientEvidence] is not
// counted, since nothing shows it failing.
func Blocking(t rubric.Scope, dims map[string]Score, doc []byte) int {
	return len(zeroBlocking(t, dims)) + len(hardRuleRe.FindAllIndex(doc, -1))
}

func zeroBlocking(t rubric.Scope, dims map[string]Score) []string {
	var zero []string

	for _, name := range t.Blocking {
		if s, ok := dims[name]; ok && s.Mark == "" && s.Points == 0 {
			zero = append(zero, name)
		}
	}

	return zero
}

// Validate checks sc against the rubric, the defined rule IDs and doc, the
// document it scores. scope is the scope the caller resolved, or empty to
// accept the scorecard's own. It reports every problem at once: a scope the
// rubric lacks; a missing, unknown or out-of-range dimension; `n/a` anywhere
// but on brief_fidelity without a brief; evidence with an undefined rule ID,
// an empty note or a quote that does not appear in doc after collapsing
// whitespace; and a total or blocking count that differs from the recomputed
// one.
func Validate(sc Scorecard, rb *rubric.Rubric, scope string, ids ruleid.Set, doc []byte) error {
	var problems []string

	if scope != "" && scope != sc.Scope {
		problems = append(
			problems,
			fmt.Sprintf("scope %q does not match the resolved scope %q", sc.Scope, scope),
		)
	}

	t, ok := rb.Scope(sc.Scope)
	if !ok {
		problems = append(problems, fmt.Sprintf("scope %q is not in the rubric", sc.Scope))
	}

	dimProblems := validateDimensions(sc, rb)
	problems = append(problems, dimProblems...)
	problems = append(problems, validateEvidence(sc.Evidence, ids, doc)...)

	if ok && len(dimProblems) == 0 {
		problems = append(problems, checkTotals(sc, t, doc)...)
	}

	if len(problems) > 0 {
		return fmt.Errorf("%w:\n- %s", ErrInvalid, strings.Join(problems, "\n- "))
	}

	return nil
}

func validateDimensions(sc Scorecard, rb *rubric.Rubric) []string {
	var problems []string

	for _, d := range rb.Dimensions {
		score, ok := sc.Dimensions[d.Name]
		if !ok {
			problems = append(problems, fmt.Sprintf("dimension %s: missing", d.Name))

			continue
		}

		if p := checkScore(d.Name, score, sc.Brief); p != "" {
			problems = append(problems, fmt.Sprintf("dimension %s: %s", d.Name, p))
		}
	}

	for _, name := range sortedNames(sc.Dimensions) {
		if !rb.Has(name) {
			problems = append(problems, fmt.Sprintf("dimension %s: not in the rubric", name))
		}
	}

	return problems
}

func checkScore(name string, s Score, brief bool) string {
	noBrief := name == rubric.BriefFidelity && !brief

	switch s.Mark {
	case "":
		if s.Points < 0 || s.Points > maxPoints || s.Points != math.Trunc(s.Points) {
			return fmt.Sprintf("score %v is not an integer from 0 to %d", s.Points, maxPoints)
		}

		if noBrief {
			return fmt.Sprintf("must be %q when brief is false, got %v", MarkNA, s.Points)
		}
	case MarkNA:
		if name != rubric.BriefFidelity {
			return fmt.Sprintf("%q is only allowed for %s", MarkNA, rubric.BriefFidelity)
		}

		if brief {
			return fmt.Sprintf("%q is only allowed when brief is false", MarkNA)
		}
	case MarkInsufficientEvidence:
		if noBrief {
			return fmt.Sprintf("must be %q when brief is false, got %q", MarkNA, s.Mark)
		}
	default:
		return fmt.Sprintf(
			"unknown mark %q, want a score, %q or %q",
			s.Mark,
			MarkNA,
			MarkInsufficientEvidence,
		)
	}

	return ""
}

func validateEvidence(evidence []Evidence, ids ruleid.Set, doc []byte) []string {
	var problems []string

	text := normalize(string(doc))

	for i, e := range evidence {
		if !ruleid.IsID(e.RuleID) || !ids.Has(e.RuleID) {
			problems = append(
				problems,
				fmt.Sprintf("evidence %d: rule_id %q is not a defined rule ID", i, e.RuleID),
			)
		}

		if strings.TrimSpace(e.Note) == "" {
			problems = append(problems, fmt.Sprintf("evidence %d: note is empty", i))
		}

		quote := normalize(e.Quote)

		switch {
		case quote == "":
			problems = append(problems, fmt.Sprintf("evidence %d: quote is empty", i))
		case !strings.Contains(text, quote):
			problems = append(
				problems,
				fmt.Sprintf("evidence %d: quote not found in the document: %q", i, e.Quote),
			)
		}
	}

	return problems
}

func checkTotals(sc Scorecard, t rubric.Scope, doc []byte) []string {
	var problems []string

	if total := Total(t, sc.Dimensions); math.Abs(sc.Total-total) > totalTolerance {
		problems = append(
			problems,
			fmt.Sprintf("total %v does not match the recomputed %.1f", sc.Total, total),
		)
	}

	if blocking := Blocking(t, sc.Dimensions, doc); sc.Blocking != blocking {
		problems = append(problems, fmt.Sprintf(
			"blocking %d does not match the recomputed %d (blocking dimensions at 0: %s; placeholders and <Aside>: %d)",
			sc.Blocking,
			blocking,
			orNone(zeroBlocking(t, sc.Dimensions)),
			len(hardRuleRe.FindAllIndex(doc, -1)),
		))
	}

	return problems
}

// normalize collapses every run of whitespace to one space and trims the
// ends, so a quote matches across line wrapping and indentation.
func normalize(s string) string {
	return strings.Join(strings.Fields(s), " ")
}

func orNone(names []string) string {
	if len(names) == 0 {
		return "none"
	}

	return strings.Join(names, ", ")
}

func sortedNames(m map[string]Score) []string {
	names := make([]string, 0, len(m))
	for name := range m {
		names = append(names, name)
	}

	slices.Sort(names)

	return names
}
