package report_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/nhost/nhost/tools/ghactivity/cmd/report"
	"github.com/urfave/cli/v3"
)

func TestFlagsMergeStatus(t *testing.T) {
	tests := []struct {
		name string
		env  string
		args []string
		want string
	}{
		{name: "default", want: "Ready to merge"},
		{name: "environment override", env: "Ship it", want: "Ship it"},
		{
			name: "flag overrides environment",
			env:  "Ship it",
			args: []string{"--merge-status", "Merge queue"},
			want: "Merge queue",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("GHACTIVITY_MERGE_STATUS", tt.env)

			if tt.env == "" {
				if err := os.Unsetenv("GHACTIVITY_MERGE_STATUS"); err != nil {
					t.Fatalf("unsetting merge-status environment: %v", err)
				}
			}

			var got string

			cmd := &cli.Command{
				Name:  "gh-activity",
				Flags: report.Flags(),
				Action: func(_ context.Context, c *cli.Command) error {
					got = c.String("merge-status")
					return nil
				},
			}

			args := append(
				[]string{"gh-activity", "--org", "nhost", "--since", "20260520-0900"},
				tt.args...)
			if err := cmd.Run(context.Background(), args); err != nil {
				t.Fatalf("parsing flags: %v", err)
			}

			if got != tt.want {
				t.Fatalf("merge-status = %q, want %q", got, tt.want)
			}
		})
	}
}

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
