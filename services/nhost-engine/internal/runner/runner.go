// Package runner holds the nhost-engine process supervisor: it runs the engine's
// services concurrently in a single process under one context and brings them
// down together. It deliberately carries no dependency on the individual
// service packages so the supervision logic stays unit-testable without linking
// auth/storage/constellation.
package runner

import (
	"context"
	"errors"
	"fmt"
	"sync"
)

// ErrServicePanic wraps a value recovered from a panicking supervised service,
// so a panic surfaces as an ordinary joined error instead of crashing the whole
// engine.
var ErrServicePanic = errors.New("service panicked")

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

			// sync.WaitGroup.Go re-panics after recovering internally, which
			// would crash the whole engine and skip the graceful sibling
			// shutdown below. Catch a panicking service here, turn it into an
			// error like any other failure, and let defer cancel() tear the
			// rest down together.
			defer func() {
				if r := recover(); r != nil {
					errs[i] = fmt.Errorf("%w: %v", ErrServicePanic, r)
				}
			}()

			errs[i] = svc(ctx)
		})
	}

	wg.Wait()

	return errors.Join(errs...)
}
