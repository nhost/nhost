package ratelimit

import (
	"testing"
	"time"
)

func TestSlidingWindowRetryAfter(t *testing.T) {
	t.Parallel()

	// Start of a one-minute window, so offsets below are offsets into it.
	windowStart := time.UnixMilli(1_700_000_040_000)

	cases := []struct {
		name string
		// fill is the time of each request made before the rejected one.
		fill     []time.Time
		at       time.Time
		wantWait time.Duration
	}{
		{
			name: "current window full",
			fill: []time.Time{
				windowStart.Add(10 * time.Second),
				windowStart.Add(10 * time.Second),
				windowStart.Add(10 * time.Second),
				windowStart.Add(10 * time.Second),
			},
			at:       windowStart.Add(10 * time.Second),
			wantWait: 50*time.Second + time.Millisecond,
		},
		{
			name: "previous window still counts",
			fill: []time.Time{
				windowStart.Add(50 * time.Second),
				windowStart.Add(50 * time.Second),
				windowStart.Add(50 * time.Second),
				windowStart.Add(50 * time.Second),
				windowStart.Add(time.Minute + 5*time.Second),
			},
			at:       windowStart.Add(time.Minute + 5*time.Second),
			wantWait: 10*time.Second + time.Millisecond,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			rl := NewSlidingWindow("test", 4, time.Minute, NewInMemoryStore())

			for i, at := range tc.fill {
				if ok, _ := rl.allowAt(t.Context(), "key", at); !ok {
					t.Fatalf("fill request %d was rejected", i)
				}
			}

			ok, wait := rl.allowAt(t.Context(), "key", tc.at)
			if ok {
				t.Fatal("expected the request to be rejected")
			}

			if wait != tc.wantWait {
				t.Fatalf("wait = %v, want %v", wait, tc.wantWait)
			}

			if ok, _ := rl.allowAt(t.Context(), "key", tc.at.Add(wait-time.Millisecond)); ok {
				t.Error("request allowed before the wait elapsed")
			}

			if ok, _ := rl.allowAt(t.Context(), "key", tc.at.Add(wait)); !ok {
				t.Error("request rejected after the wait elapsed")
			}
		})
	}
}
