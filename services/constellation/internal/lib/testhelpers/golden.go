// Package testhelpers provides shared test utilities: JSON and GraphQL-schema
// golden file comparison with an overwrite flag for the standard -update
// pattern, and cmp.Options that normalise away GraphQL AST noise (source
// positions, slice ordering) so semantic diffs are what surface in tests.
package testhelpers

import (
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"os"
	"testing"

	"github.com/google/go-cmp/cmp"
)

// GoldenJSON compares got against the JSON golden file at path. When overwrite
// is true, got is first marshalled and written to path before the comparison.
func GoldenJSON[T any](
	tb testing.TB,
	path string,
	got T,
	overwrite bool,
) {
	tb.Helper()

	if overwrite {
		b, err := json.Marshal(
			got,
			jsontext.WithIndent("  "),
			json.FormatNilSliceAsNull(true),
			json.FormatNilMapAsNull(true),
		)
		if err != nil {
			tb.Fatalf("failed to marshal: %v", err)
		}

		if err := os.WriteFile(path, b, 0o600); err != nil { //nolint:mnd
			tb.Fatalf("failed to write golden file: %v", err)
		}
	}

	wantr, err := os.ReadFile(path)
	if err != nil {
		tb.Fatalf("failed to read golden file: %v", err)
	}

	var want T
	if err := json.Unmarshal(wantr, &want); err != nil {
		tb.Fatalf("failed to unmarshal golden file: %v", err)
	}

	if diff := cmp.Diff(want, got); diff != "" {
		tb.Errorf("mismatch (-want +got):\n%s", diff)
	}
}
