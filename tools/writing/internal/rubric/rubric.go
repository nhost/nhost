// Package rubric loads the judge rubric, `tools/writing/rubric/rubric.yaml`:
// the dimensions a document is scored on, the rule IDs each dimension covers,
// the anchors that say what 0, 2 and 4 look like, and per-scope weights and
// blocking dimensions. Loading validates the rubric against the defined rule
// IDs, so a rubric that cites an undefined ID never reaches a judge.
package rubric

import (
	"errors"
	"fmt"
	"maps"
	"os"
	"regexp"
	"slices"
	"strings"

	"github.com/goccy/go-yaml"
	"github.com/nhost/nhost/tools/writing/internal/ruleid"
)

// BriefFidelity is the dimension scored against a brief. It is the one
// dimension a scorecard may mark `n/a`, when no brief was supplied.
const BriefFidelity = "brief_fidelity"

// ErrInvalid means the rubric does not satisfy its schema: an unknown key, a
// missing or empty field, an undefined rule ID, or a scope that names an
// unknown dimension or misses one.
var ErrInvalid = errors.New("invalid rubric")

var errAnchorKey = errors.New("anchor keys are 0, 2 and 4")

var dimensionNameRe = regexp.MustCompile(`^[a-z]+(?:_[a-z]+)*$`)

// Rubric is a validated rubric. Build it with [Load] or [Parse].
type Rubric struct {
	Dimensions []Dimension      `yaml:"dimensions"`
	Scopes     map[string]Scope `yaml:"scopes"`
}

// Dimension is one scored dimension.
type Dimension struct {
	Name string `yaml:"name"`
	// Covers lists the rule IDs this dimension scores.
	Covers  []string `yaml:"covers"`
	Anchors Anchors  `yaml:"anchors"`
}

// Anchors describes what a score of 0, 2 and 4 looks like; 1 and 3 fall
// between them. In YAML it is a mapping with the integer keys 0, 2 and 4.
type Anchors struct {
	Zero string
	Two  string
	Four string
}

// UnmarshalYAML reads the integer-keyed mapping, rejecting any key other than
// 0, 2 and 4. A missing key is left empty for [Parse] to report.
func (a *Anchors) UnmarshalYAML(unmarshal func(any) error) error {
	var m map[int]string
	if err := unmarshal(&m); err != nil {
		return fmt.Errorf("decoding anchors: %w", err)
	}

	for _, key := range slices.Sorted(maps.Keys(m)) {
		if key != 0 && key != 2 && key != 4 {
			return fmt.Errorf("%w, got %d", errAnchorKey, key)
		}
	}

	*a = Anchors{Zero: m[0], Two: m[2], Four: m[4]}

	return nil
}

// Scope holds the scoring policy for one scope. Weights are relative: a
// dimension weighted 2 counts twice as much as one weighted 1.
type Scope struct {
	Weights map[string]float64 `yaml:"weights"`
	// Blocking lists the dimensions that make a document blocking when they
	// score 0.
	Blocking []string `yaml:"blocking"`
}

// Load reads and validates the rubric at path; see [Parse].
func Load(path string, ids ruleid.Set) (*Rubric, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("reading rubric: %w", err)
	}

	r, err := Parse(data, ids)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", path, err)
	}

	return r, nil
}

// Parse decodes a rubric strictly, so an unknown key is an error, and
// validates it: every dimension has a unique snake_case name, at least one
// covered rule ID, every ID defined in ids, and all three anchors; the
// dimensions include [BriefFidelity]; at least one scope exists, and every
// scope weights every dimension with a positive weight and blocks only known
// dimensions, each once.
func Parse(data []byte, ids ruleid.Set) (*Rubric, error) {
	var r Rubric
	if err := yaml.UnmarshalWithOptions(data, &r, yaml.Strict()); err != nil {
		return nil, fmt.Errorf("%w: %w", ErrInvalid, err)
	}

	problems := r.validateDimensions(ids)
	problems = append(problems, r.validateScopes()...)

	if len(problems) > 0 {
		return nil, fmt.Errorf("%w: %s", ErrInvalid, strings.Join(problems, "; "))
	}

	return &r, nil
}

// Scope returns the scoring policy for name, or false when the rubric has
// no such scope.
func (r *Rubric) Scope(name string) (Scope, bool) {
	t, ok := r.Scopes[name]

	return t, ok
}

// Has reports whether the rubric defines the dimension name.
func (r *Rubric) Has(name string) bool {
	return slices.ContainsFunc(r.Dimensions, func(d Dimension) bool { return d.Name == name })
}

func (r *Rubric) validateDimensions(ids ruleid.Set) []string {
	var problems []string

	if len(r.Dimensions) == 0 {
		problems = append(problems, "no dimensions")
	}

	seen := make(map[string]struct{}, len(r.Dimensions))

	for i, d := range r.Dimensions {
		if !dimensionNameRe.MatchString(d.Name) {
			problems = append(
				problems,
				fmt.Sprintf("dimension %d: name %q is not snake_case", i, d.Name),
			)

			continue
		}

		if _, ok := seen[d.Name]; ok {
			problems = append(problems, fmt.Sprintf("dimension %s: defined twice", d.Name))
		}

		seen[d.Name] = struct{}{}

		problems = append(problems, d.validate(ids)...)
	}

	if !r.Has(BriefFidelity) {
		problems = append(problems, "no "+BriefFidelity+" dimension")
	}

	return problems
}

func (d Dimension) validate(ids ruleid.Set) []string {
	var problems []string

	if len(d.Covers) == 0 {
		problems = append(problems, fmt.Sprintf("dimension %s: covers no rule ID", d.Name))
	}

	for _, id := range d.Covers {
		if !ruleid.IsID(id) || !ids.Has(id) {
			problems = append(
				problems,
				fmt.Sprintf("dimension %s: rule ID %s is not defined", d.Name, id),
			)
		}
	}

	for _, anchor := range []struct{ key, text string }{
		{"0", d.Anchors.Zero}, {"2", d.Anchors.Two}, {"4", d.Anchors.Four},
	} {
		if strings.TrimSpace(anchor.text) == "" {
			problems = append(
				problems,
				fmt.Sprintf("dimension %s: anchor %s is missing", d.Name, anchor.key),
			)
		}
	}

	return problems
}

func (r *Rubric) validateScopes() []string {
	if len(r.Scopes) == 0 {
		return []string{"no scopes"}
	}

	var problems []string

	for _, name := range sortedKeys(r.Scopes) {
		t := r.Scopes[name]

		for _, dim := range sortedKeys(t.Weights) {
			switch {
			case !r.Has(dim):
				problems = append(
					problems,
					fmt.Sprintf("scope %s: weights unknown dimension %s", name, dim),
				)
			case t.Weights[dim] <= 0:
				problems = append(
					problems,
					fmt.Sprintf("scope %s: weight of %s is not positive", name, dim),
				)
			}
		}

		for _, d := range r.Dimensions {
			if _, ok := t.Weights[d.Name]; !ok {
				problems = append(
					problems,
					fmt.Sprintf("scope %s: no weight for %s", name, d.Name),
				)
			}
		}

		for i, dim := range t.Blocking {
			switch {
			case !r.Has(dim):
				problems = append(
					problems,
					fmt.Sprintf("scope %s: blocks unknown dimension %s", name, dim),
				)
			case slices.Contains(t.Blocking[:i], dim):
				problems = append(problems, fmt.Sprintf("scope %s: blocks %s twice", name, dim))
			}
		}
	}

	return problems
}

func sortedKeys[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}

	slices.Sort(keys)

	return keys
}
