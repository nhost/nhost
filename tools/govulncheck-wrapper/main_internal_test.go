package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

func TestRunGovulncheck(
	t *testing.T,
) {
	const (
		uncalled = `
{"osv":{"id":"GO-2026-6911","summary":"Imported but not called"}}
{"finding":{"osv":"GO-2026-6911","trace":[{"module":"example.com/mod"}]}}
{"finding":{"osv":"GO-2026-6911","trace":[{"module":"example.com/mod","package":"example.com/mod/pkg"}]}}
`
		called = `
{"osv":{"id":"GO-TEST-CALLED","summary":"Called"}}
{"finding":{"osv":"GO-TEST-CALLED","fixed_version":"v1.2.3","trace":[{"module":"example.com/mod","package":"example.com/mod/pkg","function":"Vulnerable"}]}}
`
	)

	tests := []struct {
		name         string
		level        string
		input        string
		exitCode     int
		wantBlocked  []string
		wantFindings int
		wantErr      bool
	}{
		{
			name:  "symbol scan ignores imported but uncalled vulnerability",
			level: "symbol", input: uncalled, exitCode: 0,
			wantBlocked: nil, wantFindings: 0, wantErr: false,
		},
		{
			name:  "symbol scan reports called vulnerability",
			level: "symbol", input: uncalled + called, exitCode: 0,
			wantBlocked: []string{"GO-TEST-CALLED"}, wantFindings: 1, wantErr: false,
		},
		{
			name:  "explicit package scan still reports imported vulnerability",
			level: "package", input: uncalled, exitCode: 0,
			wantBlocked: []string{"GO-2026-6911"}, wantFindings: 1, wantErr: false,
		},
		{
			name:  "explicit module scan still reports module vulnerability",
			level: "module", input: uncalled, exitCode: 0,
			wantBlocked: []string{"GO-2026-6911"}, wantFindings: 2, wantErr: false,
		},
		{
			name:  "failure during call graph analysis is fatal despite OSV entries",
			level: "symbol", input: uncalled, exitCode: 2,
			wantBlocked: nil, wantFindings: 0, wantErr: true,
		},
		{
			name:  "failure with symbol findings is fatal too",
			level: "symbol", input: uncalled + called, exitCode: 2,
			wantBlocked: nil, wantFindings: 0, wantErr: true,
		},
		{
			name:  "failure without findings is fatal",
			level: "symbol", input: "", exitCode: 2,
			wantBlocked: nil, wantFindings: 0, wantErr: true,
		},
	}

	shell, err := exec.LookPath("sh")
	if err != nil {
		t.Fatalf("finding shell: %v", err)
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()
			args := []string{"-scan=" + tt.level, "./..."}
			input := `{"config":{"scan_level":"` + tt.level + `"}}` + tt.input

			script := fmt.Sprintf(
				"#!%s\n[ \"$*\" = %q ] || exit 64\nprintf '%%s\\n' '%s'\nexit %d\n",
				shell, "-json "+strings.Join(args, " "), input, tt.exitCode,
			)
			if err := os.WriteFile(
				filepath.Join(dir, "govulncheck"),
				[]byte(script),
				0o700,
			); err != nil {
				t.Fatalf("writing scanner: %v", err)
			}

			t.Setenv("PATH", dir+string(os.PathListSeparator)+os.Getenv("PATH"))

			_, findings, err := runGovulncheck(args)
			if tt.wantErr {
				if err == nil ||
					!strings.Contains(err.Error(), "govulncheck failed: exit status 2") {
					t.Fatalf("expected scanner failure, got %v", err)
				}

				return
			}

			if err != nil {
				t.Fatalf("running scanner: %v", err)
			}

			_, blocked := classifyFindings(findings, nil)
			if !slices.Equal(blocked, tt.wantBlocked) {
				t.Errorf("blocked: got %v, want %v", blocked, tt.wantBlocked)
			}

			count := 0
			for _, entries := range findings {
				count += len(entries)
			}

			if count != tt.wantFindings {
				t.Errorf("findings: got %d, want %d", count, tt.wantFindings)
			}
		})
	}
}
