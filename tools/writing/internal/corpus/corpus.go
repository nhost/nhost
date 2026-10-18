// Package corpus selects the documents a voice profile is measured from. Every
// candidate goes through [resolve.Resolver.Resolve], so a voice's corpus is
// exactly the documents that resolve to it; nothing here re-derives a voice
// from a byline or a path.
//
// A named voice keeps the documents that resolve to it. The house voice,
// [resolve.BlogVoice], pools the blog posts that resolve without error to a
// profiled author, so it measures the team average that a named author's
// profile deviates from. A post that resolves to the house voice itself has
// an unprofiled byline and is in no corpus. Either way, a profile's `since:`
// window then narrows the corpus, and held-out documents are set aside. A
// candidate that fails any test is skipped with a reason, never an error:
// co-authored posts and generated pages are expected in any glob of the tree.
package corpus

import (
	"errors"
	"fmt"
	"path"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/nhost/nhost/tools/writing/internal/resolve"
)

// Document is one candidate: its repository-relative path and its source.
type Document struct {
	Path   string
	Source []byte
}

// Skip is a candidate left out of the corpus and why.
type Skip struct {
	Path   string `json:"path"`
	Reason string `json:"reason"`
}

// Selection is the outcome of [Select]. Kept and HeldOut are sorted by path,
// and Skipped by path and reason.
type Selection struct {
	Kept []Document
	// HeldOut lists candidates that belong to the corpus but are held out of
	// it by the voice expectations.
	HeldOut []string
	Skipped []Skip
}

// Select picks the corpus of voice from docs. heldOut lists the held-out
// documents of every voice, as repository-relative paths. The voice must have
// a profile, since its window is read from it.
func Select(
	r *resolve.Resolver,
	voice string,
	heldOut []string,
	docs []Document,
) (Selection, error) {
	profile, ok := r.Profile(voice)
	if !ok {
		return Selection{}, fmt.Errorf("%w: %q has no profile", resolve.ErrUnknownVoice, voice)
	}

	held := make(map[string]struct{}, len(heldOut))
	for _, p := range heldOut {
		held[cleanPath(p)] = struct{}{}
	}

	s := selector{profile: profile, resolver: r}
	sel := Selection{Kept: nil, HeldOut: nil, Skipped: nil}
	seen := make(map[string]struct{}, len(docs))

	for _, doc := range docs {
		doc.Path = cleanPath(doc.Path)

		if _, dup := seen[doc.Path]; dup {
			sel.Skipped = append(sel.Skipped, Skip{Path: doc.Path, Reason: "listed twice"})

			continue
		}

		seen[doc.Path] = struct{}{}

		reason, err := s.skipReason(doc)
		if err != nil {
			return Selection{}, err
		}

		_, isHeld := held[doc.Path]

		switch {
		case reason != "":
			sel.Skipped = append(sel.Skipped, Skip{Path: doc.Path, Reason: reason})
		case isHeld:
			sel.HeldOut = append(sel.HeldOut, doc.Path)
		default:
			sel.Kept = append(sel.Kept, doc)
		}
	}

	slices.SortFunc(sel.Kept, func(a, b Document) int { return strings.Compare(a.Path, b.Path) })
	slices.Sort(sel.HeldOut)
	slices.SortFunc(sel.Skipped, func(a, b Skip) int {
		if c := strings.Compare(a.Path, b.Path); c != 0 {
			return c
		}

		return strings.Compare(a.Reason, b.Reason)
	})

	return sel, nil
}

// unprofiledAuthor is the skip reason for a blog post whose single author has
// no profile: it resolves to the house voice for review, but the house corpus
// is the profiled authors' posts only.
const unprofiledAuthor = "unprofiled author"

type selector struct {
	profile  resolve.Profile
	resolver *resolve.Resolver
}

// skipReason returns why doc is not in the profile's corpus, or "" when it
// is. Only an unexpected resolve error, one that is not about the document
// itself, is returned as an error.
func (s selector) skipReason(doc Document) (string, error) {
	result, err := s.resolver.Resolve(doc.Path, "", doc.Source, "")

	switch {
	case errors.Is(err, resolve.ErrVoiceRequired), errors.Is(err, resolve.ErrScopeRequired):
		return "resolve error: " + err.Error(), nil
	case err != nil:
		return "", fmt.Errorf("resolving %s: %w", doc.Path, err)
	case result.Excluded:
		return "excluded: " + result.Reason, nil
	}

	switch {
	case s.profile.Slug != resolve.BlogVoice:
		if result.Voice != s.profile.Slug {
			return "resolves to " + result.Voice, nil
		}
	case result.Scope != resolve.ScopeBlog:
		return "not a blog post: resolves to scope " + result.Scope, nil
	case result.Voice == resolve.BlogVoice:
		return unprofiledAuthor, nil
	}

	if !s.profile.Since.IsZero() {
		date, err := resolve.ArticleDate(doc.Source)
		if errors.Is(err, resolve.ErrNoDate) {
			return err.Error(), nil
		}

		if err != nil {
			return "", fmt.Errorf("reading the date of %s: %w", doc.Path, err)
		}

		if date.Before(s.profile.Since) {
			return fmt.Sprintf(
				"dated %s, before since %s",
				date.Format(time.DateOnly), s.profile.Since.Format(time.DateOnly),
			), nil
		}
	}

	return "", nil
}

func cleanPath(p string) string {
	return path.Clean(filepath.ToSlash(p))
}
