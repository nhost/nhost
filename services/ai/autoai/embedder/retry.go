package embedder

import (
	"context"
	"errors"
	"math/rand/v2"
	"net/http"
	"strconv"
	"time"
)

// Clock provides context-aware retry scheduling.
//
//go:generate mockgen -package mock -destination mock/clock.go . Clock
type Clock interface {
	Now() time.Time
	Sleep(ctx context.Context, delay time.Duration) error
}

const (
	defaultMaxDelay = 30 * time.Second
	defaultMaxWait  = 2 * time.Minute
	backoffFactor   = 2
)

type realClock struct{}

func (realClock) Now() time.Time { return time.Now() }
func (realClock) Sleep(ctx context.Context, delay time.Duration) error {
	timer := time.NewTimer(delay)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return failure(Canceled, "retry canceled")
	case <-timer.C:
		return nil
	}
}

// RetryPolicy bounds attempts (including the first) and cumulative sleep.
// The zero value makes exactly one attempt; a non-positive MaxWait uses a
// two-minute budget. Clock and Jitter may be supplied
// for deterministic scheduling; Jitter returns an additional nonnegative delay.
type RetryPolicy struct {
	MaxAttempts  int
	MaxWait      time.Duration
	InitialDelay time.Duration
	MaxDelay     time.Duration
	Clock        Clock
	Jitter       func(time.Duration) time.Duration
}

// WithRetry retries transient failures only. Unknown errors are normalized to
// transport failures without exposing their potentially credential-bearing text.
func WithRetry(ctx context.Context, policy RetryPolicy, fn func() error) error {
	clock := policy.Clock
	if clock == nil {
		clock = realClock{}
	}

	delay := policy.InitialDelay
	if delay <= 0 {
		delay = time.Second
	}

	maxDelay := policy.MaxDelay
	if maxDelay <= 0 {
		maxDelay = defaultMaxDelay
	}

	maxWait := policy.MaxWait
	if maxWait <= 0 {
		maxWait = defaultMaxWait
	}

	started := clock.Now()

	var waited time.Duration
	for attempt := 1; ; attempt++ {
		if ctx.Err() != nil {
			return failure(Canceled, "retry canceled")
		}

		err := classify(fn())

		if ctx.Err() != nil {
			return failure(Canceled, "retry canceled")
		}

		if err == nil {
			return nil
		}

		var status *StatusError
		if !errors.As(err, &status) || status.Class != Transient || attempt >= policy.MaxAttempts {
			return err
		}

		wait := retryDelay(policy, delay, maxDelay, status.RetryAfter, clock.Now())

		elapsed := max(waited, clock.Now().Sub(started))
		if wait > maxWait-elapsed {
			return err
		}

		if err := clock.Sleep(ctx, wait); err != nil {
			return failure(Canceled, "retry canceled")
		}

		waited += wait

		if delay > maxDelay/backoffFactor {
			delay = maxDelay
		} else {
			delay *= backoffFactor
		}
	}
}

func classify(err error) error {
	if err == nil {
		return nil
	}

	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return failure(Canceled, "request canceled")
	}

	if status, ok := errors.AsType[*StatusError](err); ok {
		return status
	}

	return failure(Transient, "transport failed")
}

func retryDelay(
	policy RetryPolicy,
	delay, maxDelay time.Duration,
	retryAfter string,
	now time.Time,
) time.Duration {
	delay = min(delay, maxDelay)

	//nolint:gosec // Scheduling jitter is not security-sensitive.
	jitter := time.Duration(rand.Int64N(int64(delay/backoffFactor) + 1))
	if policy.Jitter != nil {
		jitter = max(0, policy.Jitter(delay))
	}

	delay = min(delay, maxDelay-min(jitter, maxDelay)) + min(jitter, maxDelay)
	if seconds, err := strconv.ParseInt(retryAfter, 10, 64); err == nil && seconds >= 0 {
		// Clamp before multiplying to prevent untrusted header overflow.
		if seconds > int64(time.Duration(1<<63-1)/time.Second) {
			return time.Duration(1<<63 - 1)
		}

		return max(delay, time.Duration(seconds)*time.Second)
	}

	if date, err := http.ParseTime(retryAfter); err == nil {
		return max(delay, date.Sub(now))
	}

	return delay
}
