// Package runner holds the nhost-engine command-line dispatch and the process
// supervisor: it turns the `--`-separated multi-service argument grammar into a
// set of service invocations and runs the selected services concurrently in a
// single process under one context. It deliberately carries no dependency on
// the individual service packages so the parsing and supervision logic stays
// unit-testable without linking auth/storage/constellation.
package runner

import (
	"context"
	"errors"
	"fmt"
	"sync"
)

// separator is the standalone token that delimits one service invocation from
// the next on the command line.
const separator = "--"

// Invocation is a single service selected on the command line: the service name
// (e.g. "auth") plus the arguments that follow it, up to the next separator.
type Invocation struct {
	Name string
	Args []string
}

var (
	// ErrEmptySegment is returned when two separators are adjacent (or a
	// separator trails the arguments), leaving a service segment with no name.
	ErrEmptySegment = errors.New("empty service segment: a service name must follow \"--\"")
	// ErrUnknownService is returned when a segment begins with a token that is
	// not a recognized service name.
	ErrUnknownService = errors.New("unknown service")
	// ErrDuplicateService is returned when the same service is requested more
	// than once in a single invocation.
	ErrDuplicateService = errors.New("service requested more than once")
)

// Split parses the argument list (already stripped of the program name) into
// the shared flags that precede the first service and the ordered list of
// service invocations.
//
// isService reports whether a token names a runnable service. It is used to
// locate the boundary between the shared flags and the first service in the
// leading segment: everything up to the first recognized service name is
// treated as shared flags. A standalone "--" may terminate the shared flags
// explicitly, in which case the leading segment is shared-only and every
// service starts in a later segment.
//
// Split does not validate the shared flags or the per-service flags; that is
// left to the shared flag parser and each service's own CLI, respectively.
func Split(
	args []string,
	isService func(string) bool,
) ([]string, []Invocation, error) {
	segments := splitOnSeparator(args)

	var (
		shared      []string
		invocations []Invocation
	)

	// Leading segment: shared flags followed by an optional first service.
	lead := segments[0]
	serviceStart := -1

	for i, tok := range lead {
		if isService(tok) {
			serviceStart = i

			break
		}
	}

	if serviceStart < 0 {
		// No service name in the leading segment: it is entirely shared flags.
		// This is the "-- after shared flags" form; services (if any) come from
		// the following segments.
		shared = lead
	} else {
		shared = lead[:serviceStart]
		invocations = append(invocations, Invocation{
			Name: lead[serviceStart],
			Args: argsOrNil(lead[serviceStart+1:]),
		})
	}

	for _, seg := range segments[1:] {
		if len(seg) == 0 {
			return nil, nil, ErrEmptySegment
		}

		if !isService(seg[0]) {
			return nil, nil, fmt.Errorf("%w: %q", ErrUnknownService, seg[0])
		}

		invocations = append(invocations, Invocation{Name: seg[0], Args: argsOrNil(seg[1:])})
	}

	if err := ensureNoDuplicates(invocations); err != nil {
		return nil, nil, err
	}

	return shared, invocations, nil
}

// splitOnSeparator divides args into segments delimited by standalone "--"
// tokens. It always returns at least one (possibly empty) leading segment so
// callers can treat segments[0] as the shared-flags region unconditionally.
func splitOnSeparator(args []string) [][]string {
	segments := [][]string{{}}

	for _, tok := range args {
		if tok == separator {
			segments = append(segments, []string{})

			continue
		}

		last := len(segments) - 1
		segments[last] = append(segments[last], tok)
	}

	return segments
}

// argsOrNil normalizes an empty argument slice to nil so an invocation with no
// following flags compares equal regardless of how the slice was produced.
func argsOrNil(args []string) []string {
	if len(args) == 0 {
		return nil
	}

	return args
}

func ensureNoDuplicates(invocations []Invocation) error {
	seen := make(map[string]struct{}, len(invocations))

	for _, inv := range invocations {
		if _, dup := seen[inv.Name]; dup {
			return fmt.Errorf("%w: %q", ErrDuplicateService, inv.Name)
		}

		seen[inv.Name] = struct{}{}
	}

	return nil
}

// Service is a long-running service: it blocks until its work is done or the
// context is cancelled, then returns. A nil error means a clean shutdown.
type Service func(ctx context.Context) error

// Supervise runs every service concurrently under a child of ctx and waits for
// all of them to return. The moment any service returns — whether with an error
// or cleanly — the child context is cancelled so the remaining services shut
// down too. This makes the process behave as a unit: a fatal error in one
// service, or a shutdown signal on ctx, brings the whole engine down together.
//
// The returned error joins the (non-nil) errors from every service, so a
// failure is never masked by a peer's clean exit.
func Supervise(ctx context.Context, services []Service) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	var wg sync.WaitGroup

	errs := make([]error, len(services))

	for i, svc := range services {
		wg.Go(func() {
			// Any service returning tears down the rest: a crashed service must
			// not leave the others running headless in the same process.
			defer cancel()

			errs[i] = svc(ctx)
		})
	}

	wg.Wait()

	return errors.Join(errs...)
}
