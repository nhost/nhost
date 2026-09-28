package serve

import (
	"context"
	"errors"
	"fmt"
	"runtime/debug"
	"strings"
	"sync"
)

var (
	// ErrServicePanic wraps a value recovered from a panicking part of the
	// process, so a panic surfaces as an ordinary joined error instead of
	// crashing every service sharing the process.
	ErrServicePanic = errors.New("service panicked")
	// ErrShutdownTimeout reports that the shutdown budget ran out while some part
	// of the process was still stopping. That part is abandoned and the remaining
	// shutdown steps still run, with whatever budget is left, which may be none.
	ErrShutdownTimeout = errors.New("service shutdown timed out")
)

// unit is one supervised part of a running process: a listener or a service's
// background work.
type unit struct {
	// name identifies the unit in the errors the group returns.
	name string
	// run blocks until the unit's work ends, either because stop asked it to or
	// because it finished or failed on its own.
	run func() error
	// stop asks run to return and waits, within ctx, for the unit's own shutdown
	// to complete. It may be called after run has already returned.
	stop func(ctx context.Context) error
}

// group runs units in tiers. Every unit starts at once; shutdown stops the
// tiers one after another, so an earlier tier can keep relying on a later one
// while it winds down.
type group struct {
	tiers   [][]unit
	results []chan result

	// returned is closed as soon as any unit's run returns.
	returned     chan struct{}
	returnedOnce sync.Once
}

// result reports that one half of a unit, its run or its stop, has returned.
type result struct {
	unit int
	stop bool
	err  error
}

// startGroup starts every unit of every tier.
func startGroup(tiers ...[]unit) *group {
	g := &group{
		tiers:        tiers,
		results:      make([]chan result, len(tiers)),
		returned:     make(chan struct{}),
		returnedOnce: sync.Once{},
	}

	for tier, units := range tiers {
		// Room for both halves of every unit, so neither ever blocks on a
		// shutdown that already gave up on it.
		g.results[tier] = make(chan result, 2*len(units)) //nolint:mnd // run and stop

		for index, u := range units {
			go func() {
				// Any unit returning stops the rest: a crashed listener or loop
				// must not leave its peers running headless in the same process.
				defer g.returnedOnce.Do(func() { close(g.returned) })

				err := protect(u.run)
				if err != nil {
					err = fmt.Errorf("%s: %w", u.name, err)
				}

				g.results[tier] <- result{unit: index, stop: false, err: err}
			}()
		}
	}

	return g
}

// stopped is closed once any unit has returned on its own, which is the signal
// to shut the whole group down.
func (g *group) stopped() <-chan struct{} {
	return g.returned
}

// shutdown stops the tiers in order, each one fully before the next, all within
// ctx. A tier still stopping when ctx ends is reported as ErrShutdownTimeout and
// abandoned; the later tiers are still asked to stop, but with no budget left
// they are not waited for. The result joins every error the units returned.
func (g *group) shutdown(ctx context.Context) error {
	errs := make([]error, 0, len(g.tiers))

	for tier := range g.tiers {
		errs = append(errs, g.shutdownTier(ctx, tier)...)
	}

	return errors.Join(errs...)
}

func (g *group) shutdownTier(ctx context.Context, tier int) []error {
	units := g.tiers[tier]
	results := g.results[tier]

	for index, u := range units {
		go func() {
			err := protect(func() error { return u.stop(ctx) })
			if err != nil {
				err = fmt.Errorf("stopping %s: %w", u.name, err)
			}

			results <- result{unit: index, stop: true, err: err}
		}()
	}

	ran := make([]bool, len(units))
	stopped := make([]bool, len(units))

	var errs []error

	for pending := 2 * len(units); pending > 0; pending-- { //nolint:mnd // run and stop
		r, ok := receive(ctx, results)
		if !ok {
			return append(errs, stillStopping(units, ran, stopped))
		}

		if r.stop {
			stopped[r.unit] = true
		} else {
			ran[r.unit] = true
		}

		if r.err != nil {
			errs = append(errs, r.err)
		}
	}

	return errs
}

// receive returns the next result, preferring one that is already queued over
// an expired ctx, so a unit that had already returned when the budget ran out
// is not reported as stuck.
func receive(ctx context.Context, results <-chan result) (result, bool) {
	select {
	case r := <-results:
		return r, true
	default:
	}

	select {
	case r := <-results:
		return r, true
	case <-ctx.Done():
		return result{unit: 0, stop: false, err: nil}, false
	}
}

func stillStopping(units []unit, ran, stopped []bool) error {
	var names []string

	for index, u := range units {
		if !ran[index] || !stopped[index] {
			names = append(names, u.name)
		}
	}

	return fmt.Errorf("%w: %s still stopping", ErrShutdownTimeout, strings.Join(names, ", "))
}

// protect runs fn, turning a panic into an ErrServicePanic carrying the
// recovered value and the stack it was raised from.
func protect(fn func() error) (err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			err = fmt.Errorf("%w: %v\n%s", ErrServicePanic, recovered, debug.Stack())
		}
	}()

	return fn()
}
