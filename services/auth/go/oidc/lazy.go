package oidc

import (
	"context"
	"fmt"
	"sync"
	"time"
)

const (
	lazyInitialBackoff = time.Second
	lazyMaxBackoff     = time.Minute
	lazyBackoffFactor  = 2
	// lazyBuildTimeout bounds a detached build. A build is at most a couple
	// of outbound requests (discovery + JWKS), each already capped by the
	// hardened client's own timeout.
	lazyBuildTimeout = 30 * time.Second
)

// lazyMemo memoizes the result of a one-time construction. A success is
// cached forever; a failure is negative-cached until an exponential-backoff
// deadline (1s doubling to 60s) so repeated callers cannot amplify outbound
// traffic toward a failing upstream.
//
// It is a single-flight, not a critical section: at most one build runs at a
// time, and the lock is never held across it. Concurrent callers either get
// the memoized value / negative-cached error immediately, or wait on the
// in-flight build and give up as soon as their own context ends — a client
// that disconnected must not keep a goroutine parked behind an IdP that is
// blackholing packets.
//
// The caller that starts a build sees it through even if its own context is
// already cancelled: the build populates a cache shared by everyone, and
// aborting it would negative-cache the resulting error for every other
// caller until the backoff expires.
type lazyMemo[T any] struct {
	build func(ctx context.Context) (T, error)

	mu        sync.Mutex
	value     T
	built     bool
	lastErr   error
	nextRetry time.Time
	backoff   time.Duration
	// inFlight is non-nil while a build is running and is closed when it
	// finishes, so waiters can select on it alongside their own context.
	inFlight chan struct{}
}

func newLazyMemo[T any](build func(ctx context.Context) (T, error)) *lazyMemo[T] {
	var zero T

	return &lazyMemo[T]{
		build:     build,
		mu:        sync.Mutex{},
		value:     zero,
		built:     false,
		lastErr:   nil,
		nextRetry: time.Time{},
		backoff:   0,
		inFlight:  nil,
	}
}

func (m *lazyMemo[T]) get(ctx context.Context) (T, error) { //nolint:ireturn,nolintlint
	var zero T

	for {
		m.mu.Lock()

		if m.built {
			value := m.value
			m.mu.Unlock()

			return value, nil
		}

		if time.Now().Before(m.nextRetry) {
			err := m.lastErr
			m.mu.Unlock()

			return zero, err
		}

		if inFlight := m.inFlight; inFlight != nil {
			m.mu.Unlock()

			select {
			case <-inFlight:
				// The build finished; loop to read what it recorded.
				continue
			case <-ctx.Done():
				return zero, fmt.Errorf("waiting for provider metadata: %w", ctx.Err())
			}
		}

		done := make(chan struct{})
		m.inFlight = done
		m.mu.Unlock()

		return m.runBuild(ctx, done)
	}
}

func (m *lazyMemo[T]) runBuild( //nolint:ireturn,nolintlint
	ctx context.Context, done chan struct{},
) (T, error) {
	// The build populates a cache shared by every caller, so it runs on a
	// detached context: the caller that happens to start it must not be able
	// to abort it — and negative-cache the resulting error for everyone else
	// — by cancelling its own request.
	buildCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), lazyBuildTimeout)
	defer cancel()

	// Deferred, so the single-flight slot is released and waiters are woken
	// however runBuild exits. Doing it inline after the build would, on any
	// non-returning exit, leave m.inFlight pointing at a channel nobody ever
	// closes — and every later get for this memo would park on it until its
	// own context ended, with nothing short of a restart recovering it.
	//
	// Registered after the cancel above, so it runs before it; the result
	// section below takes m.mu itself and its deferred unlock runs first, so
	// waiters never wake before the result is recorded.
	defer func() {
		m.mu.Lock()
		m.inFlight = nil
		m.mu.Unlock()

		close(done)
	}()

	value, err := m.buildRecovered(buildCtx)

	m.mu.Lock()
	defer m.mu.Unlock()

	if err != nil {
		if m.backoff == 0 {
			m.backoff = lazyInitialBackoff
		} else {
			m.backoff = min(m.backoff*lazyBackoffFactor, lazyMaxBackoff)
		}

		m.nextRetry = time.Now().Add(m.backoff)
		m.lastErr = err

		var zero T

		return zero, err
	}

	m.value = value
	m.built = true
	m.lastErr = nil

	return value, nil
}

// buildRecovered turns a panic out of build into a build error. The build
// closures reach third-party code that parses key material fetched from an
// attacker-influenceable jwks_uri, so a panic there has to land in the
// negative cache with the usual backoff: propagating it would leave the next
// request to start another fresh build against the same failing upstream,
// which is exactly the amplification the negative cache exists to prevent.
func (m *lazyMemo[T]) buildRecovered( //nolint:ireturn,nolintlint
	ctx context.Context,
) (T, error) {
	var (
		value T
		err   error
	)

	func() {
		defer func() {
			if r := recover(); r != nil {
				var zero T

				value = zero
				err = fmt.Errorf("%w: %v", ErrBuildPanic, r)
			}
		}()

		value, err = m.build(ctx)
	}()

	return value, err
}
