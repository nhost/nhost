package nhostclient_test

import (
	"errors"
	"testing"
	"time"

	"github.com/nhost/cli/nhostclient"
)

var errTest = errors.New("test error")

func TestStandardRetry(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name          string
		maxAttempts   int
		multiplier    int
		funcType      func(t *testing.T, calls *int) nhostclient.Func
		expectedCalls int
		expectedError error
		expectedDelay time.Duration
	}{
		{
			name:        "success",
			maxAttempts: 3,
			multiplier:  1,
			funcType: func(t *testing.T, calls *int) nhostclient.Func {
				t.Helper()
				return func(attempt int) error {
					*calls++
					if attempt != *calls {
						t.Errorf("expected attempt %d, got %d", *calls, attempt)
					}
					return nil
				}
			},
			expectedCalls: 1,
			expectedDelay: 0,
			expectedError: nil,
		},
		{
			name:        "success after three attempts",
			maxAttempts: 5,
			multiplier:  1,
			funcType: func(t *testing.T, calls *int) nhostclient.Func {
				t.Helper()
				return func(attempt int) error {
					*calls++
					if attempt != *calls {
						t.Errorf("expected attempt %d, got %d", *calls, attempt)
					}
					if *calls < 3 {
						return errTest
					}
					return nil
				}
			},
			expectedCalls: 3,
			expectedDelay: 3 * time.Second,
			expectedError: nil,
		},
		{
			name:        "fail after four attempts",
			maxAttempts: 4,
			multiplier:  1,
			funcType: func(t *testing.T, calls *int) nhostclient.Func {
				t.Helper()
				return func(attempt int) error {
					*calls++
					if attempt != *calls {
						t.Errorf("expected attempt %d, got %d", *calls, attempt)
					}
					return errTest
				}
			},
			expectedError: errTest,
			expectedCalls: 4,
			expectedDelay: 6 * time.Second,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			retryer := nhostclient.NewBasicRetryer(tc.maxAttempts, tc.multiplier)

			start := time.Now()
			calls := 0

			err := retryer.Retry(tc.funcType(t, &calls))
			if !errors.Is(err, tc.expectedError) {
				t.Errorf("expected error %v, got %v", tc.expectedError, err)
			}

			// check starting time is within 50ms of expected delay
			delay := time.Since(start)
			if delay < tc.expectedDelay || delay > tc.expectedDelay+50*time.Millisecond {
				t.Errorf("expected delay %v, got %v", tc.expectedDelay, delay)
			}

			if calls != tc.expectedCalls {
				t.Errorf("expected %d calls, got %d", tc.expectedCalls, calls)
			}
		})
	}
}
