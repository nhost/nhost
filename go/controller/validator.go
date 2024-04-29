//go:generate mockgen -package mock -destination mock/validator.go --source=validator.go
package controller

import (
	"fmt"
	"net/url"
	"regexp"
	"slices"
	"strings"
)

type urlMatcher struct {
	Scheme   string
	Hostname *regexp.Regexp
	Port     string
	Path     string
}

func newURLMatcher(u *url.URL) (urlMatcher, error) {
	if u.Scheme == "" {
		return urlMatcher{}, fmt.Errorf( //nolint:goerr113
			"scheme is required for allowed redirect URL",
		)
	}

	port := u.Port()
	if port == "" && u.Scheme == "http" {
		port = "80"
	} else if port == "" && u.Scheme == "https" {
		port = "443"
	}

	r := regexp.QuoteMeta(u.Hostname())
	r = "^" + strings.ReplaceAll(r, `\*`, `(\w+|\w+-\w+)+`) + `$`
	re, err := regexp.Compile(r)
	if err != nil {
		return urlMatcher{}, fmt.Errorf("error compiling regex: %w", err)
	}

	return urlMatcher{
		Scheme:   u.Scheme,
		Hostname: re,
		Port:     port,
		Path:     u.Path,
	}, nil
}

func (m urlMatcher) Matches(scheme, host, port, path string) bool {
	return m.Scheme == scheme &&
		m.Port == port &&
		m.Hostname.MatchString(host) &&
		strings.HasPrefix(path, m.Path)
}

func ValidateRedirectTo( //nolint:cyclop
	allowedRedirectURLs []*url.URL,
) (
	func(redirectTo string) bool,
	error,
) {
	matchers := make([]urlMatcher, len(allowedRedirectURLs))
	for i, u := range allowedRedirectURLs {
		m, err := newURLMatcher(u)
		if err != nil {
			return nil, err
		}

		matchers[i] = m
	}

	return func(redirectTo string) bool {
		u, err := url.Parse(redirectTo)
		if err != nil {
			return false
		}

		if u.Scheme == "" || u.Hostname() == "" {
			return false
		}

		if len(allowedRedirectURLs) == 0 {
			return true
		}

		port := u.Port()
		if port == "" && u.Scheme == "http" {
			port = "80"
		} else if port == "" && u.Scheme == "https" {
			port = "443"
		}

		for _, m := range matchers {
			if m.Matches(u.Scheme, u.Hostname(), port, u.Path) {
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
		if len(parts) != 2 { //nolint:gomnd
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
