package resolve

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"
)

// ErrInvalidProfile means a voice profile's header cannot be used: it is
// missing, has no `slug:`, repeats another profile's slug or byline, gives a
// scope default voice a byline, or has a `since:` value that does not parse.
var ErrInvalidProfile = errors.New("invalid voice profile")

const headerFence = "---"

// Profile is the header of one voice profile, the leading `---` block of
// `<rules-dir>/voices/<slug>.md`.
type Profile struct {
	Slug string
	// Byline is the frontmatter author name that resolves to this profile,
	// empty for a scope default voice.
	Byline string
	// Since is the first day of the profile's corpus window, zero when the
	// profile has no `since:`. Posts dated earlier are not part of its corpus.
	Since time.Time
}

// Resolver resolves documents against the voice profiles found in a rules
// directory. Build it with [New].
type Resolver struct {
	voicesDir string
	// profiles maps every profile's `slug:` to its header.
	profiles map[string]Profile
	// bylines maps a profile's `byline:` to its slug.
	bylines map[string]string
}

// New reads the header of every `<rulesDir>/voices/*.md` profile. rulesDir is
// the directory holding the writing rules, `.claude/writing` in the repository.
func New(rulesDir string) (*Resolver, error) {
	voicesDir := filepath.Join(rulesDir, "voices")

	entries, err := os.ReadDir(voicesDir)
	if err != nil {
		return nil, fmt.Errorf("reading voice profiles: %w", err)
	}

	r := &Resolver{
		voicesDir: voicesDir,
		profiles:  make(map[string]Profile),
		bylines:   make(map[string]string),
	}

	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".md" {
			continue
		}

		if err := r.addProfile(filepath.Join(voicesDir, entry.Name())); err != nil {
			return nil, err
		}
	}

	return r, nil
}

// Profile returns the header of the profile with the given slug, and false
// when no profile has it. A scope default voice without a profile file is
// not found.
func (r *Resolver) Profile(slug string) (Profile, bool) {
	p, ok := r.profiles[slug]
	if !ok {
		return Profile{Slug: "", Byline: "", Since: time.Time{}}, false
	}

	return p, true
}

func (r *Resolver) addProfile(file string) error {
	data, err := os.ReadFile(file)
	if err != nil {
		return fmt.Errorf("reading voice profile: %w", err)
	}

	p, err := parseHeader(data)
	if err != nil {
		return fmt.Errorf("%s: %w", file, err)
	}

	if _, ok := r.profiles[p.Slug]; ok {
		return fmt.Errorf("%s: %w: slug %q is used twice", file, ErrInvalidProfile, p.Slug)
	}

	r.profiles[p.Slug] = p

	if p.Byline == "" {
		return nil
	}

	if p.Slug == DocsVoice || p.Slug == BlogVoice {
		return fmt.Errorf(
			"%s: %w: %s is a scope default and takes no byline", file, ErrInvalidProfile, p.Slug,
		)
	}

	if other, ok := r.bylines[p.Byline]; ok {
		return fmt.Errorf(
			"%s: %w: byline %q is also used by %s", file, ErrInvalidProfile, p.Byline, other,
		)
	}

	r.bylines[p.Byline] = p.Slug

	return nil
}

func (r *Resolver) knownSlugs() []string {
	slugs := make([]string, 0, len(r.profiles))
	for slug := range r.profiles {
		slugs = append(slugs, slug)
	}

	slices.Sort(slugs)

	return slugs
}

// parseHeader reads the top-level `slug:`, `byline:` and `since:` keys of the
// leading `---` block. Other keys, indented lines such as list items, and `#`
// comment lines are ignored, so no YAML parser is needed.
func parseHeader(data []byte) (Profile, error) {
	scanner := bufio.NewScanner(bytes.NewReader(data))

	if !scanner.Scan() || strings.TrimSpace(scanner.Text()) != headerFence {
		return Profile{}, fmt.Errorf("%w: no leading %s header", ErrInvalidProfile, headerFence)
	}

	var (
		p      Profile
		closed bool
	)

	for scanner.Scan() {
		line := strings.TrimRight(scanner.Text(), " \t\r")
		if line == headerFence {
			closed = true

			break
		}

		if err := p.setKey(line); err != nil {
			return Profile{}, err
		}
	}

	if err := scanner.Err(); err != nil {
		return Profile{}, fmt.Errorf("scanning header: %w", err)
	}

	switch {
	case !closed:
		return Profile{}, fmt.Errorf("%w: unterminated %s header", ErrInvalidProfile, headerFence)
	case p.Slug == "":
		return Profile{}, fmt.Errorf("%w: header has no slug", ErrInvalidProfile)
	default:
		return p, nil
	}
}

// setKey records one `key: value` header line. Keys the resolver does not use
// are ignored, and so are indented and comment lines, since a key is only read
// from the start of a line.
func (p *Profile) setKey(line string) error {
	key, value, _ := strings.Cut(line, ":")
	value = headerValue(value)

	switch key {
	case "slug":
		p.Slug = value
	case "byline":
		p.Byline = value
	case "since":
		since, err := time.Parse(time.DateOnly, value)
		if err != nil {
			return fmt.Errorf("%w: since %q is not a YYYY-MM-DD date", ErrInvalidProfile, value)
		}

		p.Since = since
	}

	return nil
}

// headerValue trims a header value and strips its quotes, dropping a trailing
// ` # comment`: after the closing quote of a quoted value, or from the first
// ` #` of an unquoted one.
func headerValue(value string) string {
	value = strings.TrimSpace(value)

	if value != "" && (value[0] == '"' || value[0] == '\'') {
		if end := strings.IndexByte(value[1:], value[0]); end >= 0 {
			return value[1 : end+1]
		}

		return value
	}

	if i := strings.Index(value, " #"); i >= 0 {
		value = strings.TrimSpace(value[:i])
	}

	return value
}
