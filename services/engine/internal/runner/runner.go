// Package runner holds the engine process supervisor: it runs the engine's
// services concurrently in a single process and brings them down in ordered
// tiers. It deliberately carries no dependency on the individual service
// packages so the supervision logic stays unit-testable without linking
// auth/storage/constellation.
package runner

import (
	"context"
	"errors"
	"fmt"
	"runtime/debug"
	"sync"
)

// ErrServicePanic wraps a value recovered from a panicking supervised service,
// so a panic surfaces as an ordinary joined error instead of crashing the whole
// engine.
var ErrServicePanic = errors.New("service panicked")

// Service is a long-running service: it blocks until its work is done or the
// context is cancelled, then returns. A nil error means a clean shutdown.
type Service func(ctx context.Context) error

// Supervise starts every service in every tier concurrently. The moment ctx is
// cancelled or any service returns — whether with an error or cleanly — shutdown
// begins in tier order: the first tier's context is cancelled and every service
// in it must return before the next tier's context is cancelled. With one tier,
// all services are cancelled and awaited together as before.
//
// The returned error joins the (non-nil) errors from every service, so a
// failure is never masked by a peer's clean exit.
func Supervise(ctx context.Context, tiers ...[]Service) error {
	serviceCount := 0
	for _, services := range tiers {
		serviceCount += len(services)
	}

	if serviceCount == 0 {
		return nil
	}

	// Parent cancellation initiates the ordered sequence below rather than
	// reaching every tier at once. WithoutCancel preserves values for services
	// while making each tier's explicit cancellation its only shutdown signal.
	baseCtx := context.WithoutCancel(ctx)

	cancels := make([]context.CancelFunc, len(tiers))
	waitGroups := make([]*sync.WaitGroup, len(tiers))
	errs := make([][]error, len(tiers))

	shutdown := make(chan struct{})

	var shutdownOnce sync.Once

	triggerShutdown := func() {
		shutdownOnce.Do(func() { close(shutdown) })
	}

	for tierIndex, services := range tiers {
		tierCtx, cancel := context.WithCancel(baseCtx)
		cancels[tierIndex] = cancel
		errs[tierIndex] = make([]error, len(services))

		wg := &sync.WaitGroup{}
		waitGroups[tierIndex] = wg

		for serviceIndex, svc := range services {
			wg.Go(func() {
				// Any service returning tears down the rest: a crashed service
				// must not leave the others running headless in the same process.
				defer triggerShutdown()

				// sync.WaitGroup.Go re-panics after recovering internally, which
				// would crash the whole engine and skip graceful sibling shutdown.
				// Catch a panicking service here and treat it like any other failure.
				defer func() {
					if r := recover(); r != nil {
						errs[tierIndex][serviceIndex] = fmt.Errorf(
							"%w: %v\n%s", ErrServicePanic, r, debug.Stack(),
						)
					}
				}()

				errs[tierIndex][serviceIndex] = svc(tierCtx)
			})
		}
	}

	select {
	case <-ctx.Done():
	case <-shutdown:
	}

	for tierIndex := range tiers {
		cancels[tierIndex]()
		waitGroups[tierIndex].Wait()
	}

	joined := make([]error, 0, serviceCount)
	for _, tierErrs := range errs {
		joined = append(joined, tierErrs...)
	}

	return errors.Join(joined...)
}
