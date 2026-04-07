package main

import (
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
