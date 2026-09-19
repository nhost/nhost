package pgmigrate_test

import (
	"strings"
	"testing"
	"testing/fstest"

	"github.com/nhost/nhost/internal/lib/pgmigrate"
)

func TestValidateBundle(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		files     fstest.MapFS
		wantIssue string
	}{
		{
			name: "valid",
			files: fstest.MapFS{
				"migrations/1_first.up.sql":   &fstest.MapFile{Data: []byte("SELECT 1;")},
				"migrations/1_first.down.sql": &fstest.MapFile{Data: []byte("SELECT 2;")},
			},
			wantIssue: "",
		},
		{
			name: "missing down migration",
			files: fstest.MapFS{
				"migrations/1_first.up.sql": &fstest.MapFile{Data: []byte("SELECT 1;")},
			},
			wantIssue: "missing its down migration",
		},
		{
			name: "blank down migration",
			files: fstest.MapFS{
				"migrations/1_first.up.sql":   &fstest.MapFile{Data: []byte("SELECT 1;")},
				"migrations/1_first.down.sql": &fstest.MapFile{Data: []byte(" \n\t")},
			},
			wantIssue: "must contain SQL beyond comments and whitespace",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			err := pgmigrate.ValidateBundle(tt.files, "migrations")
			if tt.wantIssue == "" {
				if err != nil {
					t.Fatalf("ValidateBundle() error = %v", err)
				}

				return
			}

			if err == nil {
				t.Fatal("ValidateBundle() error = nil")
			}

			if !strings.Contains(err.Error(), tt.wantIssue) {
				t.Fatalf("ValidateBundle() error = %q, want issue %q", err, tt.wantIssue)
			}
		})
	}
}
