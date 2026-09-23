package serve

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
)

var (
	// errNoHandlers reports that no service in the run exposes an HTTP handler,
	// leaving the listener with nothing to serve.
	errNoHandlers = errors.New("serve: no service defines a Handler")
	// errPrefixRequired reports a service composed with others but given no
	// prefix to be mounted under.
	errPrefixRequired = errors.New("serve: a prefix is required to mount alongside other services")
	// errPrefixInvalid reports a prefix that is not a single rooted path
	// segment, e.g. one missing its leading slash or carrying a trailing one.
	errPrefixInvalid = errors.New("serve: prefix must start with \"/\" and must not end with one")
	// errPrefixDuplicate reports two services asking for the same mount prefix,
	// which http.ServeMux rejects by panicking.
	errPrefixDuplicate = errors.New("serve: duplicate mount prefix")
)

// MountByPrefix is Run's default handler composition. A single service mounted
// at the empty prefix is served directly, so a standalone binary gets its own
// handler with nothing in front of it. Otherwise every service is mounted
// beneath its prefix on a http.ServeMux, with the prefix stripped before
// dispatch so each handler keeps serving its native paths.
//
// Services with a nil Handler are skipped; at least one service must define
// one. Callers that need more than prefix mounting — host-scoped routes, a
// shared health endpoint, redirect rewriting — set Options.Compose instead.
func MountByPrefix(services []Mounted) (http.Handler, error) {
	withHandlers := make([]Mounted, 0, len(services))

	for _, service := range services {
		if service.Service.Handler != nil {
			withHandlers = append(withHandlers, service)
		}
	}

	if len(withHandlers) == 0 {
		return nil, errNoHandlers
	}

	if len(withHandlers) == 1 && withHandlers[0].Prefix == "" {
		return withHandlers[0].Service.Handler, nil
	}

	mux := http.NewServeMux()
	seen := make(map[string]struct{}, len(withHandlers))

	for _, service := range withHandlers {
		if err := validatePrefix(service, seen); err != nil {
			return nil, err
		}

		seen[service.Prefix] = struct{}{}

		mux.Handle(
			service.Prefix+"/", http.StripPrefix(service.Prefix, service.Service.Handler),
		)
	}

	return mux, nil
}

func validatePrefix(service Mounted, seen map[string]struct{}) error {
	if service.Prefix == "" {
		return fmt.Errorf("%s: %w", service.Name, errPrefixRequired)
	}

	if !strings.HasPrefix(service.Prefix, "/") || strings.HasSuffix(service.Prefix, "/") {
		return fmt.Errorf("%s: %q: %w", service.Name, service.Prefix, errPrefixInvalid)
	}

	if _, exists := seen[service.Prefix]; exists {
		return fmt.Errorf("%s: %q: %w", service.Name, service.Prefix, errPrefixDuplicate)
	}

	return nil
}
