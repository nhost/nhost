//go:generate mockgen -package mock -destination mock/validator.go --source=validator.go
package controller

import (
	"fmt"
	"net/url"
	"regexp"
	"slices"
	"strings"

	"github.com/gobwas/glob"
)

// compileRedirectGlobs turns each allowed redirect URL into the globs it
// matches against: one for the URL as written, and — when it carries no
// explicit port — one with the scheme's default port filled in.
func compileRedirectGlobs(allowedRedirectURLs []string) ([]glob.Glob, error) {
	regexpContainsPort := regexp.MustCompile(`https?://[^/]+(:\d+)(.*)`)
	regexpAddPort := regexp.MustCompile(`(https?://[^/]+)(.*)`)

	matches := make([]glob.Glob, 0, len(allowedRedirectURLs))

	for _, u := range allowedRedirectURLs {
		// we want to allow any subpath of the allowed URL
		switch {
		case strings.HasSuffix(u, "/**"):
		case strings.HasSuffix(u, "/*"):
			u += "*"
		case strings.HasSuffix(u, "/"):
			u += "**"
		default:
			u += "/**"
		}

		defaultPort := "80"
		if strings.HasPrefix(u, "https://") {
			defaultPort = "443"
		}

		// we need to account for default ports
		if !regexpContainsPort.MatchString(u) {
			withPort := regexpAddPort.ReplaceAllString(u, fmt.Sprintf("$1:%s$2", defaultPort))

			m, err := glob.Compile(withPort, '.', '/')
			if err != nil {
				return nil, fmt.Errorf("error compiling glob: %w", err)
			}

			matches = append(matches, m)
		}

		m, err := glob.Compile(u, '.', '/')
		if err != nil {
			return nil, fmt.Errorf("error compiling glob: %w", err)
		}

		matches = append(matches, m)
	}

	return matches, nil
}

func ValidateRedirectTo(
	allowedRedirectURLs []string,
) (
	func(redirectTo string) bool,
	error,
) {
	matches, err := compileRedirectGlobs(allowedRedirectURLs)
	if err != nil {
		return nil, err
	}

	return func(redirectTo string) bool {
		if !hasValidRedirectShape(redirectTo) {
			return false
		}

		if len(matches) == 0 {
			return true
		}

		redirectToClean := strings.Split(
			strings.Split(redirectTo, "#")[0],
			"?",
		)[0]

		for _, m := range matches {
			if m.Match(redirectToClean) || m.Match(redirectToClean+"/") {
				return true
			}
		}

		return false
	}, nil
}

// hasValidRedirectShape rejects scheme-relative targets before the allowlist
// globs ever see them.
//
// A target such as "//evil.example.com/x" is not a local path: url.Parse
// gives it a Host, URL.String() round-trips it unchanged into the Location
// header, and a browser resolves it cross-origin — carrying the refresh
// token the callback appends. Glob matching cannot catch it, because it
// starts with "/" and so matches the "/**" pattern that an empty allowlist
// entry compiles to (an unset AUTH_CLIENT_URL contributes exactly that entry,
// regardless of how AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS is configured).
//
// "///evil.example.com/x" and "/\evil.example.com/x" get the same treatment:
// url.Parse reports no Host for either, but browsers resolve both to an
// authority. Anything with an explicit scheme — including the custom schemes
// mobile apps register, e.g. "myapp://my.app" — is left to the allowlist.
func hasValidRedirectShape(redirectTo string) bool {
	u, err := url.Parse(redirectTo)
	if err != nil {
		return false
	}

	if u.Scheme != "" {
		return true
	}

	// No Opaque check is needed here: url.Parse only fills URL.Opaque for a
	// target that has a scheme (mailto:a@b.c), which the branch above already
	// accepted.
	if u.Host != "" {
		return false
	}

	return len(redirectTo) < 2 || !isSlash(redirectTo[0]) || !isSlash(redirectTo[1])
}

func isSlash(c byte) bool {
	return c == '/' || c == '\\'
}

func ValidateEmail(
	blockedEmailDomains []string,
	blockedEmails []string,
	allowedEmailDomains []string,
	allowedEmails []string,
) func(email string) bool {
	return func(email string) bool {
		parts := strings.Split(email, "@")
		if len(parts) != 2 { //nolint:mnd
			return false
		}

		domain := parts[1]

		if slices.Contains(blockedEmails, email) {
			return false
		}

		if slices.Contains(allowedEmails, email) {
			return true
		}

		if slices.Contains(blockedEmailDomains, domain) {
			return false
		}

		if slices.Contains(allowedEmailDomains, domain) {
			return true
		}

		return len(allowedEmailDomains) == 0 && len(allowedEmails) == 0
	}
}
