package pgmigrate_test

import (
	"errors"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/nhost/nhost/internal/lib/pgmigrate"
)

func TestValidateBundle(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		files      fstest.MapFS
		wantTarget uint
		wantIssue  string
	}{
		{
			name: "valid",
			files: fstest.MapFS{
				"migrations/1_first.up.sql":   &fstest.MapFile{Data: []byte("SELECT 1;")},
				"migrations/1_first.down.sql": &fstest.MapFile{Data: []byte("SELECT 2;")},
			},
			wantTarget: 1,
			wantIssue:  "",
		},
		{
			name: "non-contiguous versions infer highest target",
			files: fstest.MapFS{
				"migrations/2_first.up.sql":     &fstest.MapFile{Data: []byte("SELECT 1;")},
				"migrations/2_first.down.sql":   &fstest.MapFile{Data: []byte("SELECT 2;")},
				"migrations/10_second.up.sql":   &fstest.MapFile{Data: []byte("SELECT 3;")},
				"migrations/10_second.down.sql": &fstest.MapFile{Data: []byte("SELECT 4;")},
			},
			wantTarget: 10,
			wantIssue:  "",
		},
		{
			name: "missing down migration",
			files: fstest.MapFS{
				"migrations/1_first.up.sql": &fstest.MapFile{Data: []byte("SELECT 1;")},
			},
			wantTarget: 0,
			wantIssue:  "missing its down migration",
		},
		{
			name: "blank down migration",
			files: fstest.MapFS{
				"migrations/1_first.up.sql":   &fstest.MapFile{Data: []byte("SELECT 1;")},
				"migrations/1_first.down.sql": &fstest.MapFile{Data: []byte(" \n\t")},
			},
			wantTarget: 0,
			wantIssue:  "must contain SQL beyond comments and whitespace",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			target, err := pgmigrate.ValidateBundle(tt.files, "migrations")
			if tt.wantIssue == "" {
				if err != nil {
					t.Fatalf("ValidateBundle() error = %v", err)
				}

				if target != tt.wantTarget {
					t.Fatalf("ValidateBundle() target = %d, want %d", target, tt.wantTarget)
				}

				return
			}

			if err == nil {
				t.Fatal("ValidateBundle() error = nil")
			}

			if target != 0 {
				t.Errorf("ValidateBundle() target = %d, want 0 on error", target)
			}

			if _, ok := errors.AsType[*pgmigrate.BundleError](err); !ok {
				t.Fatalf("ValidateBundle() error = %v (%T), want *BundleError", err, err)
			}

			if !strings.Contains(err.Error(), tt.wantIssue) {
				t.Fatalf("ValidateBundle() error = %q, want issue %q", err, tt.wantIssue)
			}
		})
	}
}
