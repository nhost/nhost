// Package resolve decides which writing scope and which voice apply to a
// document, implementing the resolution table in
// `.claude/writing/rules.md` ("Resolving the scope and the voice").
// The judge, the writer and the reviewer all resolve through [Resolver.Resolve],
// so they agree on the rules, scope and voice a document is held to.
//
// Rows are tried in order and the first match wins. The scope comes from the
// scope flag, else from the path (`docs/src/content/docs/**` is `docs`,
// `landing/src/pages/blog/**` is `blog`). A path on the generated-page
// exclusion list is reported as excluded and gets no voice. The voice comes
// from the voice flag, which must name a profile's `slug:`; else, for a blog
// post with exactly one frontmatter author, from the profile whose `byline:`
// equals that author, falling back to `nhost-blog`; else, for docs,
// `nhost-docs`. Zero or several blog authors are an error, never a guess.
//
// `nhost-docs` and `nhost-blog` are scope defaults: the default rows return
// them whether or not `voices/nhost-docs.md` or `voices/nhost-blog.md` exists.
// A voice flag, by contrast, only resolves when a profile with that `slug:`
// exists. Default voices carry no `byline:`, so they never match an author.
//
// The exclusion list and the table are embedded from `exclusions.txt` and
// `resolution.md`, byte-identical copies of the two fenced blocks in the rules
// doc; [ExclusionList] and [TableMarkdown] expose them so a drift test can
// hold them to the rules doc.
package resolve

import (
	"errors"
	"fmt"
	"path"
	"path/filepath"
	"strings"
)

// The scope default voices. Each is returned by its default row of the
// resolution table whether or not its profile file exists, and neither takes a
// `byline:`. BlogVoice is also the house voice: its corpus pools the posts in
// its `since:` window that resolve to a profiled author.
const (
	DocsVoice = "nhost-docs"
	BlogVoice = "nhost-blog"
)

// The two scopes, as [Result.Scope] reports them.
const (
	ScopeDocs = "docs"
	ScopeBlog = "blog"
)

const (
	docsTree = "docs/src/content/docs/"
	blogTree = "landing/src/pages/blog/"

	reasonGeneratedPage = "generated page"
	reasonVoiceFlag     = "voice flag"
	reasonByline        = "byline match"
	reasonUnprofiled    = "unprofiled author"
	reasonDocsDefault   = "docs default"
)

var (
	// ErrScopeRequired means no scope flag was given and the path, if any,
	// is in neither the docs nor the blog tree.
	ErrScopeRequired = errors.New("--scope required")
	// ErrInvalidScope means the scope flag is neither `docs` nor `blog`.
	ErrInvalidScope = errors.New("--scope must be docs or blog")
	// ErrVoiceRequired means a blog post lists zero or several authors and no
	// voice flag was given.
	ErrVoiceRequired = errors.New("--voice required")
	// ErrUnknownVoice means the voice flag names no profile's `slug:`.
	ErrUnknownVoice = errors.New("--voice names no voice profile")
)

// Result is the outcome of resolving one document. Reason names the row of
// the resolution table that decided the result: `generated page`,
// `voice flag`, `byline match`, `unprofiled author` or `docs default`. The
// scope rows only feed the later rows, so they never appear as a reason.
type Result struct {
	Scope    string `json:"scope"`
	Voice    string `json:"voice"`
	Excluded bool   `json:"excluded"`
	Reason   string `json:"reason"`
}

// Resolve applies the resolution table. docPath is repository-relative with
// forward or OS separators, or empty when there is no document yet. scope and
// voiceFlag are the flag values, empty when not given; a brief's `author:`
// slug is passed as voiceFlag. frontmatter is the document source, or at least
// its `export const article = {...}` block; only the blog `authors` list is
// read from it, and it may be nil.
func (r *Resolver) Resolve(
	docPath, scope string,
	frontmatter []byte,
	voiceFlag string,
) (Result, error) {
	docPath = cleanPath(docPath)

	scope, err := resolveScope(docPath, strings.TrimSpace(scope))
	if err != nil {
		return Result{}, err
	}

	if rel, ok := strings.CutPrefix(docPath, docsTree); ok && isGenerated(rel) {
		return Result{
			Scope:    ScopeDocs,
			Voice:    "",
			Excluded: true,
			Reason:   reasonGeneratedPage,
		}, nil
	}

	if voiceFlag = strings.TrimSpace(voiceFlag); voiceFlag != "" {
		if _, ok := r.profiles[voiceFlag]; !ok {
			return Result{}, fmt.Errorf(
				"%w: %q is not a slug under %s (known: %s)",
				ErrUnknownVoice, voiceFlag, r.voicesDir, strings.Join(r.knownSlugs(), ", "),
			)
		}

		return newResult(scope, voiceFlag, reasonVoiceFlag), nil
	}

	if scope == ScopeDocs {
		return newResult(ScopeDocs, DocsVoice, reasonDocsDefault), nil
	}

	return r.resolveBlogVoice(frontmatter)
}

func (r *Resolver) resolveBlogVoice(frontmatter []byte) (Result, error) {
	authors := parseAuthors(frontmatter)

	if len(authors) == 0 {
		return Result{}, fmt.Errorf(
			"%w: no author listed in export const article", ErrVoiceRequired,
		)
	}

	if len(authors) > 1 {
		return Result{}, fmt.Errorf(
			"%w: %d authors listed (%s)",
			ErrVoiceRequired, len(authors), strings.Join(authors, ", "),
		)
	}

	if slug, ok := r.bylines[authors[0]]; ok {
		return newResult(ScopeBlog, slug, reasonByline), nil
	}

	return newResult(ScopeBlog, BlogVoice, reasonUnprofiled), nil
}

func newResult(scope, voice, reason string) Result {
	return Result{Scope: scope, Voice: voice, Excluded: false, Reason: reason}
}

func resolveScope(docPath, scope string) (string, error) {
	switch scope {
	case ScopeDocs, ScopeBlog:
		return scope, nil
	case "":
	default:
		return "", fmt.Errorf("%w: got %q", ErrInvalidScope, scope)
	}

	switch {
	case strings.HasPrefix(docPath, docsTree):
		return ScopeDocs, nil
	case strings.HasPrefix(docPath, blogTree):
		return ScopeBlog, nil
	case docPath == "":
		return "", fmt.Errorf("%w: no path given", ErrScopeRequired)
	default:
		return "", fmt.Errorf(
			"%w: %s is outside the docs and blog trees", ErrScopeRequired, docPath,
		)
	}
}

func cleanPath(docPath string) string {
	if docPath == "" {
		return ""
	}

	return path.Clean(filepath.ToSlash(docPath))
}
