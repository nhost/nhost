package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

func TestLoadConfig(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		content string
		hasFile bool
		wantLen int
		wantErr bool
	}{
		{
			name:    "missing file returns empty map",
			content: "",
			hasFile: false,
			wantLen: 0,
			wantErr: false,
		},
		{
			name:    "valid config with entries",
			content: "allow_list:\n  - GO-2023-1901\n  - GO-2026-4730\n",
			hasFile: true,
			wantLen: 2,
			wantErr: false,
		},
		{
			name:    "empty allow list",
			content: "allow_list: []\n",
			hasFile: true,
			wantLen: 0,
			wantErr: false,
		},
		{
			name:    "invalid yaml returns error",
			content: "{{invalid yaml",
			hasFile: true,
			wantLen: 0,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			path := "/nonexistent/path/govulncheck.yaml"
			if tt.hasFile {
				path = filepath.Join(t.TempDir(), "config.yaml")

				if err := os.WriteFile(path, []byte(tt.content), 0o600); err != nil {
					t.Fatalf("writing config: %v", err)
				}
			}

			allow, err := loadConfig(path)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if len(allow) != tt.wantLen {
				t.Errorf("expected %d entries, got %d", tt.wantLen, len(allow))
			}
		})
	}
}

func TestParseMessages(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name              string
		input             string
		wantOSVCount      int
		wantFindingsCount int
		wantFindingCounts map[string]int
	}{
		{
			name:              "empty input",
			input:             "",
			wantOSVCount:      0,
			wantFindingsCount: 0,
			wantFindingCounts: nil,
		},
		{
			name: "osv message only",
			input: `{"osv":{"id":"GO-2023-0001","summary":"Vuln",` +
				`"aliases":["CVE-2023-0001"]}}` + "\n",
			wantOSVCount:      1,
			wantFindingsCount: 0,
			wantFindingCounts: nil,
		},
		{
			name: "finding message only",
			input: `{"finding":{"osv":"GO-2023-0001",` +
				`"fixed_version":"v1.2.3","trace":` +
				`[{"module":"example.com/mod",` +
				`"version":"v1.0.0"}]}}` + "\n",
			wantOSVCount:      0,
			wantFindingsCount: 1,
			wantFindingCounts: map[string]int{"GO-2023-0001": 1},
		},
		{
			name: "multiple findings per osv",
			input: `{"osv":{"id":"GO-2023-0001","summary":"A"}}
{"osv":{"id":"GO-2023-0002","summary":"B"}}
{"finding":{"osv":"GO-2023-0001","trace":[]}}
{"finding":{"osv":"GO-2023-0002","trace":[]}}
{"finding":{"osv":"GO-2023-0001","trace":[]}}
`,
			wantOSVCount:      2,
			wantFindingsCount: 2,
			wantFindingCounts: map[string]int{
				"GO-2023-0001": 2,
				"GO-2023-0002": 1,
			},
		},
		{
			name: "skips unknown fields",
			input: `{"config":{"some":"thing"}}
{"osv":{"id":"GO-2023-0001","summary":"Real"}}
{"progress":{"message":"scanning"}}
`,
			wantOSVCount:      1,
			wantFindingsCount: 0,
			wantFindingCounts: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			osvMap, findingsMap := parseMessages(
				strings.NewReader(tt.input),
			)

			if len(osvMap) != tt.wantOSVCount {
				t.Errorf("osvMap: got %d, want %d", len(osvMap), tt.wantOSVCount)
			}

			if len(findingsMap) != tt.wantFindingsCount {
				t.Errorf("findingsMap: got %d, want %d", len(findingsMap), tt.wantFindingsCount)
			}

			for id, wantCount := range tt.wantFindingCounts {
				if len(findingsMap[id]) != wantCount {
					t.Errorf("findings[%s]: got %d, want %d", id, len(findingsMap[id]), wantCount)
				}
			}
		})
	}
}

func TestCollectFixes(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name          string
		findingsMap   map[string][]*finding
		blocked       []string
		want          []string
		wantToolchain []string
	}{
		{
			name:        "no findings",
			findingsMap: map[string][]*finding{},
			blocked:     nil,
			want:        []string{},
		},
		{
			name: "single finding",
			findingsMap: map[string][]*finding{
				"GO-2023-0001": {{
					OSV:          "GO-2023-0001",
					FixedVersion: "v1.2.3",
					Trace:        []frame{{Module: "example.com/mod"}},
				}},
			},
			blocked: []string{"GO-2023-0001"},
			want:    []string{"example.com/mod@v1.2.3"},
		},
		{
			name: "dedupes by module, keeps highest semver",
			findingsMap: map[string][]*finding{
				"GO-2023-0001": {{
					OSV:          "GO-2023-0001",
					FixedVersion: "v1.2.3",
					Trace:        []frame{{Module: "example.com/mod"}},
				}},
				"GO-2023-0002": {{
					OSV:          "GO-2023-0002",
					FixedVersion: "v1.10.0",
					Trace:        []frame{{Module: "example.com/mod"}},
				}},
				"GO-2023-0003": {{
					OSV:          "GO-2023-0003",
					FixedVersion: "v1.5.0",
					Trace:        []frame{{Module: "example.com/mod"}},
				}},
			},
			blocked: []string{"GO-2023-0001", "GO-2023-0002", "GO-2023-0003"},
			want:    []string{"example.com/mod@v1.10.0"},
		},
		{
			name: "skips findings without fixed version or module",
			findingsMap: map[string][]*finding{
				"GO-2023-0001": {{
					OSV:          "GO-2023-0001",
					FixedVersion: "",
					Trace:        []frame{{Module: "example.com/a"}},
				}},
				"GO-2023-0002": {{
					OSV:          "GO-2023-0002",
					FixedVersion: "v2.0.0",
					Trace:        []frame{{Module: ""}},
				}},
				"GO-2023-0003": {{
					OSV:          "GO-2023-0003",
					FixedVersion: "v3.0.0",
					Trace:        []frame{},
				}},
				"GO-2023-0004": {{
					OSV:          "GO-2023-0004",
					FixedVersion: "v4.0.0",
					Trace:        []frame{{Module: "example.com/d"}},
				}},
			},
			blocked: []string{
				"GO-2023-0001",
				"GO-2023-0002",
				"GO-2023-0003",
				"GO-2023-0004",
			},
			want: []string{"example.com/d@v4.0.0"},
		},
		{
			name: "ignores findings not in blocked list",
			findingsMap: map[string][]*finding{
				"GO-2023-0001": {{
					OSV:          "GO-2023-0001",
					FixedVersion: "v1.0.0",
					Trace:        []frame{{Module: "example.com/allowed"}},
				}},
				"GO-2023-0002": {{
					OSV:          "GO-2023-0002",
					FixedVersion: "v2.0.0",
					Trace:        []frame{{Module: "example.com/blocked"}},
				}},
			},
			blocked: []string{"GO-2023-0002"},
			want:    []string{"example.com/blocked@v2.0.0"},
		},
		{
			name: "output is sorted",
			findingsMap: map[string][]*finding{
				"GO-2023-0001": {{
					OSV:          "GO-2023-0001",
					FixedVersion: "v1.0.0",
					Trace:        []frame{{Module: "example.com/z"}},
				}},
				"GO-2023-0002": {{
					OSV:          "GO-2023-0002",
					FixedVersion: "v1.0.0",
					Trace:        []frame{{Module: "example.com/a"}},
				}},
				"GO-2023-0003": {{
					OSV:          "GO-2023-0003",
					FixedVersion: "v1.0.0",
					Trace:        []frame{{Module: "example.com/m"}},
				}},
			},
			blocked: []string{"GO-2023-0001", "GO-2023-0002", "GO-2023-0003"},
			want: []string{
				"example.com/a@v1.0.0",
				"example.com/m@v1.0.0",
				"example.com/z@v1.0.0",
			},
		},
		{
			name: "stdlib and toolchain findings are separated, not aborting the run",
			findingsMap: map[string][]*finding{
				"GO-2023-0001": {{
					OSV:          "GO-2023-0001",
					FixedVersion: "v1.23.4",
					Trace:        []frame{{Module: "stdlib"}},
				}},
				"GO-2023-0002": {{
					OSV:          "GO-2023-0002",
					FixedVersion: "v1.23.4",
					Trace:        []frame{{Module: "toolchain"}},
				}},
				"GO-2023-0003": {{
					OSV:          "GO-2023-0003",
					FixedVersion: "v1.23.5",
					Trace:        []frame{{Module: "stdlib"}},
				}},
				"GO-2023-0004": {{
					OSV:          "GO-2023-0004",
					FixedVersion: "v1.2.3",
					Trace:        []frame{{Module: "example.com/mod"}},
				}},
			},
			blocked: []string{
				"GO-2023-0001",
				"GO-2023-0002",
				"GO-2023-0003",
				"GO-2023-0004",
			},
			want: []string{"example.com/mod@v1.2.3"},
			wantToolchain: []string{
				"stdlib@v1.23.5",
				"toolchain@v1.23.4",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, gotToolchain := collectFixes(tt.findingsMap, tt.blocked)

			if !slices.Equal(got, tt.want) {
				t.Errorf("got %v, want %v", got, tt.want)
			}

			wantToolchain := tt.wantToolchain
			if wantToolchain == nil {
				wantToolchain = []string{}
			}

			if !slices.Equal(gotToolchain, wantToolchain) {
				t.Errorf("toolchain: got %v, want %v", gotToolchain, wantToolchain)
			}
		})
	}
}

var errFakeRunner = errors.New("fake runner failure")

func TestApplyFixes(t *testing.T) {
	t.Parallel()

	formatCall := func(name string, args ...string) string {
		if len(args) == 0 {
			return name
		}

		return name + " " + strings.Join(args, " ")
	}

	tests := []struct {
		name           string
		pairs          []string
		toolchainPairs []string
		failOn         string // command string that should fail; "" means none
		wantCalls      []string
		wantErr        bool
	}{
		{
			name:           "empty pairs short-circuits before any command",
			pairs:          nil,
			toolchainPairs: nil,
			wantCalls:      nil,
			wantErr:        false,
		},
		{
			name:           "toolchain-only still short-circuits go get/tidy/vendor",
			pairs:          nil,
			toolchainPairs: []string{"stdlib@v1.23.5"},
			wantCalls:      nil,
			wantErr:        false,
		},
		{
			name:           "happy path edits each require then tidy then vendor",
			pairs:          []string{"example.com/a@v1.0.0", "example.com/b@v2.0.0"},
			toolchainPairs: nil,
			wantCalls: []string{
				"go mod edit -require=example.com/a@v1.0.0",
				"go mod edit -require=example.com/b@v2.0.0",
				"go mod tidy",
				"go mod vendor",
			},
			wantErr: false,
		},
		{
			name:           "happy path with toolchain pairs runs same go commands",
			pairs:          []string{"example.com/a@v1.0.0"},
			toolchainPairs: []string{"stdlib@v1.23.5", "toolchain@v1.23.4"},
			wantCalls: []string{
				"go mod edit -require=example.com/a@v1.0.0",
				"go mod tidy",
				"go mod vendor",
			},
			wantErr: false,
		},
		{
			name:           "first failing edit aborts before tidy/vendor",
			pairs:          []string{"example.com/a@v1.0.0", "example.com/b@v2.0.0"},
			toolchainPairs: nil,
			failOn:         "go mod edit -require=example.com/a@v1.0.0",
			wantCalls:      []string{"go mod edit -require=example.com/a@v1.0.0"},
			wantErr:        true,
		},
		{
			name:           "failing tidy aborts before vendor",
			pairs:          []string{"example.com/a@v1.0.0"},
			toolchainPairs: nil,
			failOn:         "go mod tidy",
			wantCalls: []string{
				"go mod edit -require=example.com/a@v1.0.0",
				"go mod tidy",
			},
			wantErr: true,
		},
		{
			name:           "failing vendor surfaces error after tidy",
			pairs:          []string{"example.com/a@v1.0.0"},
			toolchainPairs: nil,
			failOn:         "go mod vendor",
			wantCalls: []string{
				"go mod edit -require=example.com/a@v1.0.0",
				"go mod tidy",
				"go mod vendor",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var calls []string

			run := func(name string, args ...string) error {
				call := formatCall(name, args...)
				calls = append(calls, call)

				if tt.failOn != "" && call == tt.failOn {
					return fmt.Errorf("%w: %s", errFakeRunner, call)
				}

				return nil
			}

			err := applyFixes(tt.pairs, tt.toolchainPairs, run)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
			} else if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if !slices.Equal(calls, tt.wantCalls) {
				t.Errorf("calls: got %v, want %v", calls, tt.wantCalls)
			}
		})
	}
}

func TestClassifyFindings(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		findingsMap map[string][]*finding
		allow       map[string]bool
		wantAllowed []string
		wantBlocked []string
	}{
		{
			name:        "empty findings",
			findingsMap: map[string][]*finding{},
			allow:       map[string]bool{"GO-2023-0001": true},
			wantAllowed: nil,
			wantBlocked: nil,
		},
		{
			name: "all allowed",
			findingsMap: map[string][]*finding{
				"GO-2023-0001": {{OSV: "GO-2023-0001"}},
				"GO-2023-0002": {{OSV: "GO-2023-0002"}},
			},
			allow: map[string]bool{
				"GO-2023-0001": true,
				"GO-2023-0002": true,
			},
			wantAllowed: []string{"GO-2023-0001", "GO-2023-0002"},
			wantBlocked: nil,
		},
		{
			name: "all blocked",
			findingsMap: map[string][]*finding{
				"GO-2023-0001": {{OSV: "GO-2023-0001"}},
				"GO-2023-0002": {{OSV: "GO-2023-0002"}},
			},
			allow:       map[string]bool{},
			wantAllowed: nil,
			wantBlocked: []string{"GO-2023-0001", "GO-2023-0002"},
		},
		{
			name: "mixed allowed and blocked",
			findingsMap: map[string][]*finding{
				"GO-2023-0001": {{OSV: "GO-2023-0001"}},
				"GO-2023-0002": {{OSV: "GO-2023-0002"}},
				"GO-2023-0003": {{OSV: "GO-2023-0003"}},
			},
			allow: map[string]bool{
				"GO-2023-0002": true,
			},
			wantAllowed: []string{"GO-2023-0002"},
			wantBlocked: []string{"GO-2023-0001", "GO-2023-0003"},
		},
		{
			name: "results are sorted",
			findingsMap: map[string][]*finding{
				"GO-2023-0003": {{OSV: "GO-2023-0003"}},
				"GO-2023-0001": {{OSV: "GO-2023-0001"}},
				"GO-2023-0002": {{OSV: "GO-2023-0002"}},
			},
			allow:       map[string]bool{},
			wantAllowed: nil,
			wantBlocked: []string{
				"GO-2023-0001",
				"GO-2023-0002",
				"GO-2023-0003",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			allowed, blocked := classifyFindings(tt.findingsMap, tt.allow)

			if !slices.Equal(allowed, tt.wantAllowed) {
				t.Errorf("allowed: got %v, want %v", allowed, tt.wantAllowed)
			}

			if !slices.Equal(blocked, tt.wantBlocked) {
				t.Errorf("blocked: got %v, want %v", blocked, tt.wantBlocked)
			}
		})
	}
}
