// Package expect loads `tools/writing/calibration/voices/expect.yaml`, the
// record of which document is held out of each voice profile and how the
// voice discrimination check treats each voice. `voicestats` reads it to keep
// held-out documents out of every corpus; the calibration check reads it to
// know which document to score per voice.
//
// The file is decoded strictly: a key the schema does not name is an error,
// so a typo never silently drops a held-out document.
package expect

import (
	"errors"
	"fmt"
	"maps"
	"os"
	"path"
	"regexp"
	"slices"
	"strings"

	"github.com/goccy/go-yaml"
)

// ErrInvalid means the file does not satisfy its schema: an unknown key, a
// held-out block missing a field or with a malformed SHA, a skipped voice with a held-out document, or
// a skip or record-only flag without a reason.
var ErrInvalid = errors.New("invalid voice expectations")

var (
	// blobRe and commitRe also catch a SHA that YAML decoded as a number: an
	// unquoted all-digit SHA with a leading zero comes back as its octal
	// value, so `0123456` arrives as "42798".
	blobRe   = regexp.MustCompile(`^[0-9a-f]{40}$`)
	commitRe = regexp.MustCompile(`^[0-9a-f]{7,40}$`)
)

// File is a validated `expect.yaml`. Build it with [Load].
type File struct {
	// Model is the judge model the voice check is pinned to, empty until it
	// is pinned.
	Model string `yaml:"model"`
	// Voices maps a voice slug to its expectations.
	Voices map[string]Voice `yaml:"voices"`
}

// Voice holds the expectations for one voice. Exactly one of HeldOut and Skip
// is set.
type Voice struct {
	HeldOut *HeldOut `yaml:"held_out"`
	// Skip means the voice has no held-out document and the voice check
	// passes over it.
	Skip bool `yaml:"skip"`
	// RecordOnly means the voice check scores and records the held-out
	// document but asserts nothing about it.
	RecordOnly bool `yaml:"record-only"`
	// Reason says why the voice is skipped or record-only; it is required
	// when either is set and refused otherwise.
	Reason string `yaml:"reason"`
	// Vetoed lists earlier picks a maintainer rejected, in order.
	Vetoed []Veto `yaml:"vetoed"`
}

// HeldOut is the document held out of one voice profile.
type HeldOut struct {
	// Path is repository-relative.
	Path string `yaml:"path"`
	// Blob is the git blob SHA the document is expected to have.
	Blob string `yaml:"blob"`
	// Note says why Blob differs from the blob at ChosenAt, when a deliberate
	// edit re-recorded it.
	Note string `yaml:"note"`
	// ChosenAt is the commit the selection rule was run at.
	ChosenAt string `yaml:"chosen_at"`
	Rule     string `yaml:"rule"`
	Reason   string `yaml:"reason"`
}

// Veto is one rejected pick.
type Veto struct {
	Path   string `yaml:"path"`
	Reason string `yaml:"reason"`
}

// Load reads and validates an `expect.yaml` file.
func Load(file string) (*File, error) {
	data, err := os.ReadFile(file)
	if err != nil {
		return nil, fmt.Errorf("reading voice expectations: %w", err)
	}

	var f File
	if err := yaml.UnmarshalWithOptions(data, &f, yaml.Strict()); err != nil {
		return nil, fmt.Errorf("%s: %w: %w", file, ErrInvalid, err)
	}

	if err := f.validate(); err != nil {
		return nil, fmt.Errorf("%s: %w", file, err)
	}

	return &f, nil
}

// HeldOutPaths returns the held-out document of every voice, sorted, as
// clean repository-relative paths.
func (f *File) HeldOutPaths() []string {
	paths := make([]string, 0, len(f.Voices))

	for _, v := range f.Voices {
		if v.HeldOut != nil {
			paths = append(paths, path.Clean(v.HeldOut.Path))
		}
	}

	slices.Sort(paths)

	return paths
}

func (f *File) validate() error {
	if len(f.Voices) == 0 {
		return fmt.Errorf("%w: no voices", ErrInvalid)
	}

	var problems []string

	for _, slug := range slices.Sorted(maps.Keys(f.Voices)) {
		for _, p := range f.Voices[slug].problems() {
			problems = append(problems, fmt.Sprintf("voices.%s: %s", slug, p))
		}
	}

	if len(problems) > 0 {
		return fmt.Errorf("%w:\n- %s", ErrInvalid, strings.Join(problems, "\n- "))
	}

	return nil
}

func (v Voice) problems() []string {
	var problems []string

	switch {
	case v.Skip && v.HeldOut != nil:
		problems = append(problems, "skip is set, so held_out must not be")
	case !v.Skip && v.HeldOut == nil:
		problems = append(problems, "held_out is required unless skip is set")
	case v.Skip && v.RecordOnly:
		problems = append(problems, "skip and record-only are exclusive")
	}

	if (v.Skip || v.RecordOnly) != (v.Reason != "") {
		problems = append(problems, "reason is required with skip or record-only, and only then")
	}

	if v.HeldOut != nil {
		problems = append(problems, v.HeldOut.problems()...)
	}

	for i, veto := range v.Vetoed {
		if veto.Path == "" || veto.Reason == "" {
			problems = append(problems, fmt.Sprintf("vetoed %d: path and reason are required", i+1))
		}
	}

	return problems
}

func (h *HeldOut) problems() []string {
	var problems []string

	for _, field := range []struct{ name, value string }{
		{"path", h.Path},
		{"blob", h.Blob},
		{"chosen_at", h.ChosenAt},
		{"rule", h.Rule},
		{"reason", h.Reason},
	} {
		if strings.TrimSpace(field.value) == "" {
			problems = append(problems, "held_out."+field.name+" is required")
		}
	}

	if h.Blob != "" && !blobRe.MatchString(h.Blob) {
		problems = append(problems, "held_out.blob must be a 40-character hex SHA, got "+h.Blob)
	}

	if h.ChosenAt != "" && !commitRe.MatchString(h.ChosenAt) {
		problems = append(problems, "held_out.chosen_at must be a hex commit SHA, got "+h.ChosenAt)
	}

	if h.Path != "" && (path.IsAbs(h.Path) || strings.HasPrefix(path.Clean(h.Path), "..")) {
		problems = append(problems, "held_out.path must be repository-relative")
	}

	return problems
}
