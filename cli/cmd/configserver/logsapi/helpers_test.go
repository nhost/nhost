package logsapi_test

import (
	"errors"
	"testing"
	"time"

	"github.com/nhost/nhost/cli/cmd/configserver/logsapi"
)

func TestTimeRangeCheck(t *testing.T) {
	t.Parallel()

	now := time.Now()
	oneHourAgo := now.Add(-time.Hour)
	twoHoursAgo := now.Add(-2 * time.Hour)

	tests := []struct {
		name      string
		from      *time.Time
		to        *time.Time
		wantError error
	}{
		{
			name:      "valid range",
			from:      &twoHoursAgo,
			to:        &oneHourAgo,
			wantError: nil,
		},
		{
			name:      "inverted range",
			from:      &oneHourAgo,
			to:        &twoHoursAgo,
			wantError: logsapi.ErrInvalidTimestampRange,
		},
		{
			name:      "nil from defaults to hour ago",
			from:      nil,
			to:        &now,
			wantError: nil,
		},
		{
			name:      "nil to defaults to now",
			from:      &twoHoursAgo,
			to:        nil,
			wantError: nil,
		},
		{
			name:      "both nil",
			from:      nil,
			to:        nil,
			wantError: nil,
		},
		{
			name:      "equal times",
			from:      &now,
			to:        &now,
			wantError: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			from, to, err := logsapi.TimeRangeCheck(tt.from, tt.to)
			if !errors.Is(err, tt.wantError) {
				t.Fatalf("error = %v, want %v", err, tt.wantError)
			}

			if err != nil {
				return
			}

			if from == nil {
				t.Fatal("from is nil after TimeRangeCheck")
			}

			if to == nil {
				t.Fatal("to is nil after TimeRangeCheck")
			}

			if to.Before(*from) {
				t.Errorf("to (%v) is before from (%v)", to, from)
			}
		})
	}
}
