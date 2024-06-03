//go:generate mockgen -package mock -destination mock/validator.go --source=validator.go
package controller

import (
	"fmt"
	"regexp"
	"slices"
	"strings"

	"github.com/gobwas/glob"
)

func ValidateRedirectTo( //nolint:cyclop
	allowedRedirectURLs []string,
) (
	func(redirectTo string) bool,
	error,
) {
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
			u := regexpAddPort.ReplaceAllString(u, fmt.Sprintf("$1:%s$2", defaultPort))
			m, err := glob.Compile(u, '.', '/')
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

	return func(redirectTo string) bool {
		if len(matches) == 0 {
			return true
		}

		redirectToClean := strings.Split(
			strings.Split(redirectTo, "#")[0],
			"?")[0]

		for _, m := range matches {
			if m.Match(redirectToClean) || m.Match(redirectToClean+"/") {
				return true
			}
		}
		return false
	}, nil
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
