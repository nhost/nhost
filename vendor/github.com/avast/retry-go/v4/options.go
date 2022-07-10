package retry

import (
	"context"
	"math"
	"math/rand"
	"time"
)

// Function signature of retry if function
type RetryIfFunc func(error) bool

// Function signature of OnRetry function
// n = count of attempts
type OnRetryFunc func(n uint, err error)

// DelayTypeFunc is called to return the next delay to wait after the retriable function fails on `err` after `n` attempts.
type DelayTypeFunc func(n uint, err error, config *Config) time.Duration

// Timer represents the timer used to track time for a retry.
type Timer interface {
	After(time.Duration) <-chan time.Time
}

type Config struct {
	attempts      uint
	delay         time.Duration
	maxDelay      time.Duration
	maxJitter     time.Duration
	onRetry       OnRetryFunc
	retryIf       RetryIfFunc
	delayType     DelayTypeFunc
	lastErrorOnly bool
	context       context.Context
	timer         Timer

	maxBackOffN uint
}

// Option represents an option for retry.
type Option func(*Config)

func emptyOption(c *Config) {}

// return the direct last error that came from the retried function
// default is false (return wrapped errors with everything)
func LastErrorOnly(lastErrorOnly bool) Option {
	return func(c *Config) {
		c.lastErrorOnly = lastErrorOnly
	}
}

// Attempts set count of retry. Setting to 0 will retry until the retried function succeeds.
// default is 10
func Attempts(attempts uint) Option {
	return func(c *Config) {
		c.attempts = attempts
	}
}

// Delay set delay between retry
// default is 100ms
func Delay(delay time.Duration) Option {
	return func(c *Config) {
		c.delay = delay
	}
}

// MaxDelay set maximum delay between retry
// does not apply by default
func MaxDelay(maxDelay time.Duration) Option {
	return func(c *Config) {
		c.maxDelay = maxDelay
	}
}

// MaxJitter sets the maximum random Jitter between retries for RandomDelay
func MaxJitter(maxJitter time.Duration) Option {
	return func(c *Config) {
		c.maxJitter = maxJitter
	}
}

// DelayType set type of the delay between retries
// default is BackOff
func DelayType(delayType DelayTypeFunc) Option {
	if delayType == nil {
		return emptyOption
	}
	return func(c *Config) {
		c.delayType = delayType
	}
}

// BackOffDelay is a DelayType which increases delay between consecutive retries
func BackOffDelay(n uint, _ error, config *Config) time.Duration {
	// 1 << 63 would overflow signed int64 (time.Duration), thus 62.
	const max uint = 62

	if config.maxBackOffN == 0 {
		if config.delay <= 0 {
			config.delay = 1
		}

		config.maxBackOffN = max - uint(math.Floor(math.Log2(float64(config.delay))))
	}

	if n > config.maxBackOffN {
		n = config.maxBackOffN
	}

	return config.delay << n
}

// FixedDelay is a DelayType which keeps delay the same through all iterations
func FixedDelay(_ uint, _ error, config *Config) time.Duration {
	return config.delay
}

// RandomDelay is a DelayType which picks a random delay up to config.maxJitter
func RandomDelay(_ uint, _ error, config *Config) time.Duration {
	return time.Duration(rand.Int63n(int64(config.maxJitter)))
}

// CombineDelay is a DelayType the combines all of the specified delays into a new DelayTypeFunc
func CombineDelay(delays ...DelayTypeFunc) DelayTypeFunc {
	const maxInt64 = uint64(math.MaxInt64)

	return func(n uint, err error, config *Config) time.Duration {
		var total uint64
		for _, delay := range delays {
			total += uint64(delay(n, err, config))
			if total > maxInt64 {
				total = maxInt64
			}
		}

		return time.Duration(total)
	}
}

// OnRetry function callback are called each retry
//
// log each retry example:
//
//	retry.Do(
//		func() error {
//			return errors.New("some error")
//		},
//		retry.OnRetry(func(n uint, err error) {
//			log.Printf("#%d: %s\n", n, err)
//		}),
//	)
func OnRetry(onRetry OnRetryFunc) Option {
	if onRetry == nil {
		return emptyOption
	}
	return func(c *Config) {
		c.onRetry = onRetry
	}
}

// RetryIf controls whether a retry should be attempted after an error
// (assuming there are any retry attempts remaining)
//
// skip retry if special error example:
//
//	retry.Do(
//		func() error {
//			return errors.New("special error")
//		},
//		retry.RetryIf(func(err error) bool {
//			if err.Error() == "special error" {
//				return false
//			}
//			return true
//		})
//	)
//
// By default RetryIf stops execution if the error is wrapped using `retry.Unrecoverable`,
// so above example may also be shortened to:
//
//	retry.Do(
//		func() error {
//			return retry.Unrecoverable(errors.New("special error"))
//		}
//	)
func RetryIf(retryIf RetryIfFunc) Option {
	if retryIf == nil {
		return emptyOption
	}
	return func(c *Config) {
		c.retryIf = retryIf
	}
}

// Context allow to set context of retry
// default are Background context
//
// example of immediately cancellation (maybe it isn't the best example, but it describes behavior enough; I hope)
//
//	ctx, cancel := context.WithCancel(context.Background())
//	cancel()
//
//	retry.Do(
//		func() error {
//			...
//		},
//		retry.Context(ctx),
//	)
func Context(ctx context.Context) Option {
	return func(c *Config) {
		c.context = ctx
	}
}

// WithTimer provides a way to swap out timer module implementations.
// This primarily is useful for mocking/testing, where you may not want to explicitly wait for a set duration
// for retries.
//
// example of augmenting time.After with a print statement
//
// type struct MyTimer {}
// func (t *MyTimer) After(d time.Duration) <- chan time.Time {
//     fmt.Print("Timer called!")
//     return time.After(d)
// }
//
//
// retry.Do(
//     func() error { ... },
//	   retry.WithTimer(&MyTimer{})
// )
//
func WithTimer(t Timer) Option {
	return func(c *Config) {
		c.timer = t
	}
}
