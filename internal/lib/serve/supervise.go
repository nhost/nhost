package serve

import (
	"context"
	"errors"
	"fmt"
	"runtime/debug"
	"sync"
	"time"
)

var (
	// ErrServicePanic wraps a value recovered from a panicking supervised service,
	// so a panic surfaces as an ordinary joined error instead of crashing the whole
	// process.
	ErrServicePanic = errors.New("service panicked")
	// errShutdownTimeout reports that a tier still had running services after its
	// shutdown grace period. Later tiers are still cancelled and awaited.
	errShutdownTimeout = errors.New("service shutdown timed out")
)

// SupervisedService is a long-running service: it blocks until its work is done
// or the context is cancelled, then returns. A nil error means a clean shutdown.
type SupervisedService func(ctx context.Context) error

// Supervise starts every service in every tier concurrently. The moment ctx is
// cancelled or any service returns — whether with an error or cleanly — shutdown
// begins in tier order: the first tier's context is cancelled and its services
// receive tierTimeout to return before the next tier is cancelled. With one tier,
// all services are cancelled and awaited together as before.
//
// The returned error joins the (non-nil) errors from every service that returns.
// If a tier exceeds tierTimeout, the result includes a shutdown-timeout error
// naming the tier and its remaining service count, then proceeds to later tiers.
// A stuck service goroutine may remain alive until process exit. The process
// supervisor's termination grace period remains the ultimate shutdown bound and
// must allow enough time for every tier when graceful completion is required.
func Supervise(
	ctx context.Context,
	tierTimeout time.Duration,
	tiers ...[]SupervisedService,
) error {
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
	results := make([]chan error, len(tiers))
	errs := make([][]error, len(tiers))

	shutdown := make(chan struct{})

	var shutdownOnce sync.Once

	triggerShutdown := func() {
		shutdownOnce.Do(func() { close(shutdown) })
	}

	for tierIndex, services := range tiers {
		tierCtx, cancel := context.WithCancel(baseCtx)
		cancels[tierIndex] = cancel
		results[tierIndex] = make(chan error, len(services))

		for _, svc := range services {
			go func() {
				// Any service returning tears down the rest: a crashed service
				// must not leave the others running headless in the same process.
				defer triggerShutdown()

				results[tierIndex] <- runService(tierCtx, svc)
			}()
		}
	}

	select {
	case <-ctx.Done():
	case <-shutdown:
	}

	for tierIndex, services := range tiers {
		errs[tierIndex] = shutdownTier(
			tierIndex, len(services), tierTimeout, cancels[tierIndex], results[tierIndex],
		)
	}

	joined := make([]error, 0, serviceCount)
	for _, tierErrs := range errs {
		joined = append(joined, tierErrs...)
	}

	return errors.Join(joined...)
}

func shutdownTier(
	tierIndex int,
	serviceCount int,
	tierTimeout time.Duration,
	cancel context.CancelFunc,
	results <-chan error,
) []error {
	cancel()

	timer := time.NewTimer(tierTimeout)
	remaining := serviceCount
	errs := make([]error, 0, serviceCount)

	for remaining > 0 {
		select {
		case err := <-results:
			errs = append(errs, err)
			remaining--
		case <-timer.C:
			return append(errs, fmt.Errorf(
				"%w: tier %d still has %d running service(s)",
				errShutdownTimeout, tierIndex, remaining,
			))
		}
	}

	if !timer.Stop() {
		select {
		case <-timer.C:
		default:
		}
	}

	return errs
}

func runService(ctx context.Context, svc SupervisedService) (err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			err = fmt.Errorf(
				"%w: %v\n%s", ErrServicePanic, recovered, debug.Stack(),
			)
		}
	}()

	return svc(ctx)
}
