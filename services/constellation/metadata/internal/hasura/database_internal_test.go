package hasura

import (
	"context"
	json "encoding/json/v2"
	"errors"
	"io/fs"
	"path/filepath"
	"strings"
	"testing"

	"github.com/goccy/go-yaml"
)

// TestParseIncludePath covers all the recognised prefixes plus the no-match
// fallthrough.
func TestParseIncludePath(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		input    string
		wantPath string
		wantOK   bool
	}{
		{
			name:     "bang include with space",
			input:    "!include path/to/file.yaml",
			wantPath: "path/to/file.yaml",
			wantOK:   true,
		},
		{
			name:     "bang without space",
			input:    "!path/to/file.yaml",
			wantPath: "path/to/file.yaml",
			wantOK:   true,
		},
		{
			name:     "no match plain string",
			input:    "just a plain string",
			wantPath: "",
			wantOK:   false,
		},
		{
			name:     "no match empty string",
			input:    "",
			wantPath: "",
			wantOK:   false,
		},
		{
			name:     "leading whitespace bang include",
			input:    "   !include file.yaml",
			wantPath: "file.yaml",
			wantOK:   true,
		},
		{
			name:     "trailing whitespace bang include",
			input:    "!include file.yaml   ",
			wantPath: "file.yaml",
			wantOK:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			gotPath, gotOK := parseIncludePath(tt.input)
			if gotPath != tt.wantPath {
				t.Errorf("path = %q, want %q", gotPath, tt.wantPath)
			}

			if gotOK != tt.wantOK {
				t.Errorf("ok = %v, want %v", gotOK, tt.wantOK)
			}
		})
	}
}

// TestResolveIncludeOrInline_StringIncludePath exercises the string -> include
// path branch that ultimately calls loadIncludedFile.
func TestResolveIncludeOrInline_StringIncludePath(t *testing.T) {
	t.Parallel()

	ctx := withReadFile(context.Background(), func(path string) ([]byte, error) {
		if filepath.ToSlash(path) == "/base/tables.yaml" {
			return []byte(`
- table:
    name: users
    schema: public
- table:
    name: posts
    schema: public
`), nil
		}

		return nil, &fs.PathError{Op: "open", Path: path, Err: fs.ErrNotExist}
	})

	ctx = withBaseDir(ctx, "/base")

	var dst []TableMetadata

	err := resolveIncludeOrInline(ctx, "!include tables.yaml", &dst, "tables")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(dst) != 2 {
		t.Fatalf("expected 2 tables, got %d", len(dst))
	}

	if dst[0].Table.Name != "users" {
		t.Errorf("tables[0].Name = %q, want %q", dst[0].Table.Name, "users")
	}

	if dst[1].Table.Name != "posts" {
		t.Errorf("tables[1].Name = %q, want %q", dst[1].Table.Name, "posts")
	}
}

// TestResolveIncludeOrInline_StringNoMatch covers the string branch with a
// payload that does not match any include-directive prefix: dst remains
// untouched and the call returns nil.
func TestResolveIncludeOrInline_StringNoMatch(t *testing.T) {
	t.Parallel()

	var dst []TableMetadata

	err := resolveIncludeOrInline(
		context.Background(), "just a plain string", &dst, "tables",
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if dst != nil {
		t.Errorf("expected dst to remain nil, got %+v", dst)
	}
}

// TestResolveIncludeOrInline_StringLoadFailure exercises the wrapped
// fs.ErrNotExist returned when an include directive points at a missing file.
func TestResolveIncludeOrInline_StringLoadFailure(t *testing.T) {
	t.Parallel()

	ctx := withReadFile(context.Background(), func(path string) ([]byte, error) {
		return nil, &fs.PathError{Op: "open", Path: path, Err: fs.ErrNotExist}
	})

	ctx = withBaseDir(ctx, "/base")

	var dst []TableMetadata

	err := resolveIncludeOrInline(ctx, "!include missing.yaml", &dst, "tables")
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	if !errors.Is(err, fs.ErrNotExist) {
		t.Errorf("expected wrapped fs.ErrNotExist, got %v", err)
	}
}

// TestResolveIncludeOrInline_InlineArray covers the []any branch where the
// payload is inline data that gets re-marshalled then unmarshalled into dst.
func TestResolveIncludeOrInline_InlineArray(t *testing.T) {
	t.Parallel()

	raw := []any{
		map[string]any{
			"table": map[string]any{
				"name":   "inline_table",
				"schema": "public",
			},
		},
	}

	var dst []TableMetadata

	err := resolveIncludeOrInline(context.Background(), raw, &dst, "tables")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(dst) != 1 {
		t.Fatalf("expected 1 table, got %d", len(dst))
	}

	if dst[0].Table.Name != "inline_table" {
		t.Errorf("Name = %q, want %q", dst[0].Table.Name, "inline_table")
	}
}

// TestResolveIncludeOrInline_InlineArrayUnmarshalFailure covers the wrap
// context emitted when the inline payload is well-formed YAML but has a shape
// incompatible with the destination slice element type.
func TestResolveIncludeOrInline_InlineArrayUnmarshalFailure(t *testing.T) {
	t.Parallel()

	raw := []any{"not a table object"}

	var dst []TableMetadata

	err := resolveIncludeOrInline(context.Background(), raw, &dst, "tables")
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	if !strings.Contains(err.Error(), "unmarshaling tables data") {
		t.Errorf("expected wrap context %q, got %v", "unmarshaling tables data", err)
	}
}

// TestResolveIncludeOrInline_UnknownType covers the no-op fallthrough where
// the raw payload is neither a string nor a []any.
func TestResolveIncludeOrInline_UnknownType(t *testing.T) {
	t.Parallel()

	var dst []TableMetadata

	if err := resolveIncludeOrInline(context.Background(), 42, &dst, "tables"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if dst != nil {
		t.Errorf("expected dst to remain nil, got %+v", dst)
	}

	if err := resolveIncludeOrInline(context.Background(), nil, &dst, "tables"); err != nil {
		t.Fatalf("unexpected error on nil: %v", err)
	}

	if dst != nil {
		t.Errorf("expected dst to remain nil after nil call, got %+v", dst)
	}
}

// databaseURLCase is one input/output expectation pair used by both the YAML
// and JSON test tables for DatabaseURL.
type databaseURLCase struct {
	name            string
	input           string
	wantURL         string
	wantFromEnv     string
	wantErr         bool
	wantWrapContext string
}

func runDatabaseURLTest(
	t *testing.T,
	tc databaseURLCase,
	unmarshal func([]byte, any) error,
) {
	t.Helper()

	var d DatabaseURL

	err := unmarshal([]byte(tc.input), &d)
	if (err != nil) != tc.wantErr {
		t.Fatalf("unmarshal err = %v, wantErr=%v", err, tc.wantErr)
	}

	if tc.wantErr {
		if err != nil && !strings.Contains(err.Error(), tc.wantWrapContext) {
			t.Errorf("expected wrap context %q, got %v", tc.wantWrapContext, err)
		}

		return
	}

	if d.URL != tc.wantURL {
		t.Errorf("URL = %q, want %q", d.URL, tc.wantURL)
	}

	if d.FromEnv != tc.wantFromEnv {
		t.Errorf("FromEnv = %q, want %q", d.FromEnv, tc.wantFromEnv)
	}
}

// TestDatabaseURL_UnmarshalYAML covers both the direct-string shape and the
// from_env mapping shape, plus the malformed-input wrap context.
func TestDatabaseURL_UnmarshalYAML(t *testing.T) {
	t.Parallel()

	tests := []databaseURLCase{
		{
			name:            "direct url",
			input:           `"postgres://user:pass@localhost:5432/mydb"`,
			wantURL:         "postgres://user:pass@localhost:5432/mydb",
			wantFromEnv:     "",
			wantErr:         false,
			wantWrapContext: "",
		},
		{
			name:            "from env mapping",
			input:           "from_env: PG_URL",
			wantURL:         "",
			wantFromEnv:     "PG_URL",
			wantErr:         false,
			wantWrapContext: "",
		},
		{
			name:            "empty mapping",
			input:           "{}",
			wantURL:         "",
			wantFromEnv:     "",
			wantErr:         false,
			wantWrapContext: "",
		},
		{
			name: "malformed yaml sequence",
			// The string branch rejects this (it's not a YAML scalar), and the
			// mapping fallback also rejects it because it's a sequence; the
			// wrap context surfaces from the second branch.
			input:           "[1, 2, 3]",
			wantURL:         "",
			wantFromEnv:     "",
			wantErr:         true,
			wantWrapContext: "unmarshaling database URL mapping",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			runDatabaseURLTest(t, tt, yaml.Unmarshal)
		})
	}
}

// TestDatabaseURL_UnmarshalJSON_DirectURL covers the plain-string shape where
// the JSON payload is a bare URL literal rather than a from_env mapping.
func TestDatabaseURL_UnmarshalJSON_DirectURL(t *testing.T) {
	t.Parallel()

	var d DatabaseURL
	if err := json.Unmarshal(
		[]byte(`"postgres://user:pass@localhost:5432/mydb"`),
		&d,
	); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if d.URL != "postgres://user:pass@localhost:5432/mydb" {
		t.Errorf(
			"URL = %q, want %q",
			d.URL,
			"postgres://user:pass@localhost:5432/mydb",
		)
	}

	if d.FromEnv != "" {
		t.Errorf("FromEnv = %q, want empty", d.FromEnv)
	}
}

// TestDatabaseURL_UnmarshalJSON_MalformedArray surfaces the wrap context
// emitted when the JSON payload is neither a string nor an object — the
// inner json.Unmarshal call in the mapping branch fails.
func TestDatabaseURL_UnmarshalJSON_MalformedArray(t *testing.T) {
	t.Parallel()

	var d DatabaseURL

	err := json.Unmarshal([]byte(`[1,2,3]`), &d)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	if !strings.Contains(err.Error(), "unmarshaling database URL") {
		t.Errorf(
			"expected wrap context %q, got %v",
			"unmarshaling database URL",
			err,
		)
	}
}
