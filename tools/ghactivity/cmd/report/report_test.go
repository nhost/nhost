package report_test

import (
	"testing"
	"time"

	"github.com/nhost/nhost/tools/ghactivity/cmd/report"
)

func TestParseTimestamp(t *testing.T) {
	t.Parallel()

	loc, err := time.LoadLocation("Europe/Madrid")
	if err != nil {
		t.Fatalf("loading location: %v", err)
	}

	tests := []struct {
		name string
		in   string
		want time.Time
	}{
		{
			name: "valid",
			in:   "20260101-0900",
			want: time.Date(2026, 1, 1, 9, 0, 0, 0, loc),
		},
		{
			name: "midnight",
			in:   "20260315-0000",
			want: time.Date(2026, 3, 15, 0, 0, 0, 0, loc),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := report.ParseTimestamp(tt.in, loc)
			if err != nil {
				t.Fatalf("ParseTimestamp(%q): %v", tt.in, err)
			}

			if !got.Equal(tt.want) {
				t.Errorf("ParseTimestamp(%q) = %s, want %s", tt.in, got, tt.want)
			}
		})
	}
}

func TestParseTimestampInvalid(t *testing.T) {
	t.Parallel()

	tests := []string{"", "2026-01-01", "20260101", "20260101-09:00", "garbage"}
	for _, in := range tests {
		t.Run(in, func(t *testing.T) {
			t.Parallel()

			if _, err := report.ParseTimestamp(in, time.UTC); err == nil {
				t.Errorf("ParseTimestamp(%q) = nil error, want error", in)
			}
		})
	}
}
