/*
Simple library for retry mechanism

slightly inspired by [Try::Tiny::Retry](https://metacpan.org/pod/Try::Tiny::Retry)

SYNOPSIS

http get with retry:

	url := "http://example.com"
	var body []byte

	err := retry.Do(
		func() error {
			resp, err := http.Get(url)
			if err != nil {
				return err
			}
			defer resp.Body.Close()
			body, err = ioutil.ReadAll(resp.Body)
			if err != nil {
				return err
			}

			return nil
		},
	)

	fmt.Println(body)

[next examples](https://github.com/avast/retry-go/tree/master/examples)


SEE ALSO

* [giantswarm/retry-go](https://github.com/giantswarm/retry-go) - slightly complicated interface.

* [sethgrid/pester](https://github.com/sethgrid/pester) - only http retry for http calls with retries and backoff

* [cenkalti/backoff](https://github.com/cenkalti/backoff) - Go port of the exponential backoff algorithm from Google's HTTP Client Library for Java. Really complicated interface.

* [rafaeljesus/retry-go](https://github.com/rafaeljesus/retry-go) - looks good, slightly similar as this package, don't have 'simple' `Retry` method

* [matryer/try](https://github.com/matryer/try) - very popular package, nonintuitive interface (for me)


BREAKING CHANGES

* 4.0.0
	* infinity retry is possible by set `Attempts(0)` by PR [#49](https://github.com/avast/retry-go/pull/49)
* 3.0.0
	* `DelayTypeFunc` accepts a new parameter `err` - this breaking change affects only your custom Delay Functions. This change allow [make delay functions based on error](examples/delay_based_on_error_test.go).
* 1.0.2 -> 2.0.0
	* argument of `retry.Delay` is final delay (no multiplication by `retry.Units` anymore)
	* function `retry.Units` are removed
	* [more about this breaking change](https://github.com/avast/retry-go/issues/7)
* 0.3.0 -> 1.0.0
	* `retry.Retry` function are changed to `retry.Do` function
	* `retry.RetryCustom` (OnRetry) and `retry.RetryCustomWithOpts` functions are now implement via functions produces Options (aka `retry.OnRetry`)


*/
package retry

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// Function signature of retryable function
type RetryableFunc func() error

// Default timer is a wrapper around time.After
type timerImpl struct{}

func (t *timerImpl) After(d time.Duration) <-chan time.Time {
	return time.After(d)
}

func Do(retryableFunc RetryableFunc, opts ...Option) error {
	var n uint

	// default
	config := newDefaultRetryConfig()

	// apply opts
	for _, opt := range opts {
		opt(config)
	}

	if err := config.context.Err(); err != nil {
		return err
	}

	// Setting attempts to 0 means we'll retry until we succeed
	if config.attempts == 0 {
		for err := retryableFunc(); err != nil; err = retryableFunc() {
			n++

			config.onRetry(n, err)
			select {
			case <-time.After(delay(config, n, err)):
			case <-config.context.Done():
				return nil
			}
		}

		return nil
	}

	var errorLog Error
	if !config.lastErrorOnly {
		errorLog = make(Error, config.attempts)
	} else {
		errorLog = make(Error, 1)
	}

	lastErrIndex := n
	for n < config.attempts {
		err := retryableFunc()

		if err != nil {
			errorLog[lastErrIndex] = unpackUnrecoverable(err)

			if !config.retryIf(err) {
				break
			}

			config.onRetry(n, err)

			// if this is last attempt - don't wait
			if n == config.attempts-1 {
				break
			}

			select {
			case <-config.timer.After(delay(config, n, err)):
			case <-config.context.Done():
				if config.lastErrorOnly {
					return config.context.Err()
				}
				errorLog[n] = config.context.Err()
				return errorLog
			}

		} else {
			return nil
		}

		n++
		if !config.lastErrorOnly {
			lastErrIndex = n
		}
	}

	if config.lastErrorOnly {
		return errorLog[lastErrIndex]
	}
	return errorLog
}

func newDefaultRetryConfig() *Config {
	return &Config{
		attempts:      uint(10),
		delay:         100 * time.Millisecond,
		maxJitter:     100 * time.Millisecond,
		onRetry:       func(n uint, err error) {},
		retryIf:       IsRecoverable,
		delayType:     CombineDelay(BackOffDelay, RandomDelay),
		lastErrorOnly: false,
		context:       context.Background(),
		timer:         &timerImpl{},
	}
}

// Error type represents list of errors in retry
type Error []error

// Error method return string representation of Error
// It is an implementation of error interface
func (e Error) Error() string {
	logWithNumber := make([]string, lenWithoutNil(e))
	for i, l := range e {
		if l != nil {
			logWithNumber[i] = fmt.Sprintf("#%d: %s", i+1, l.Error())
		}
	}

	return fmt.Sprintf("All attempts fail:\n%s", strings.Join(logWithNumber, "\n"))
}

func lenWithoutNil(e Error) (count int) {
	for _, v := range e {
		if v != nil {
			count++
		}
	}

	return
}

// WrappedErrors returns the list of errors that this Error is wrapping.
// It is an implementation of the `errwrap.Wrapper` interface
// in package [errwrap](https://github.com/hashicorp/errwrap) so that
// `retry.Error` can be used with that library.
func (e Error) WrappedErrors() []error {
	return e
}

type unrecoverableError struct {
	error
}

func (e unrecoverableError) Unwrap() error {
	return e.error
}

// Unrecoverable wraps an error in `unrecoverableError` struct
func Unrecoverable(err error) error {
	return unrecoverableError{err}
}

// IsRecoverable checks if error is an instance of `unrecoverableError`
func IsRecoverable(err error) bool {
	_, isUnrecoverable := err.(unrecoverableError)
	return !isUnrecoverable
}

func unpackUnrecoverable(err error) error {
	if unrecoverable, isUnrecoverable := err.(unrecoverableError); isUnrecoverable {
		return unrecoverable.error
	}

	return err
}

func delay(config *Config, n uint, err error) time.Duration {
	delayTime := config.delayType(n, err, config)
	if config.maxDelay > 0 && delayTime > config.maxDelay {
		delayTime = config.maxDelay
	}

	return delayTime
}
