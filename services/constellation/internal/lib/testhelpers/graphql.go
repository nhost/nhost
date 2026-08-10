package testhelpers

import (
	"fmt"
	"os"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
)

// getGraphQLSchemaCmpOptions returns cmp.Options for comparing GraphQL schemas.
// It sorts all slices by name and ignores Position/Source fields which track
// source file locations rather than semantic differences.
func getGraphQLSchemaCmpOptions() cmp.Options {
	return cmp.Options{
		cmpopts.SortSlices(func(a, b *ast.Definition) bool {
			return a.Name < b.Name
		}),
		cmpopts.SortSlices(func(a, b *ast.DirectiveDefinition) bool {
			return a.Name < b.Name
		}),
		cmpopts.SortSlices(func(a, b *ast.FieldDefinition) bool {
			return a.Name < b.Name
		}),
		cmpopts.SortSlices(func(a, b *ast.ArgumentDefinition) bool {
			return a.Name < b.Name
		}),
		cmpopts.SortSlices(func(a, b *ast.EnumValueDefinition) bool {
			return a.Name < b.Name
		}),
		cmpopts.SortSlices(func(a, b string) bool {
			return a < b
		}),
		cmpopts.SortSlices(func(a, b ast.DirectiveLocation) bool {
			return a < b
		}),
		cmpopts.IgnoreTypes(&ast.Position{}), //nolint:exhaustruct
		cmpopts.IgnoreTypes(&ast.Source{}),   //nolint:exhaustruct
	}
}

// parseGraphQLSchema parses a GraphQL schema from a string.
func parseGraphQLSchema(name, content string) (*ast.Schema, error) {
	schema, err := gqlparser.LoadSchema(&ast.Source{ //nolint:exhaustruct
		Name:  name,
		Input: content,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to parse schema %s: %w", name, err)
	}

	return schema, nil
}

// GoldenGraphQLSchema compares a generated GraphQL schema with a golden file.
// Unlike GoldenJSON, this performs a semantic comparison of the parsed schemas,
// ignoring field ordering and source-position metadata.
func GoldenGraphQLSchema(
	tb testing.TB,
	path string,
	got string,
	overwrite bool,
) {
	tb.Helper()

	if overwrite {
		if err := os.WriteFile(path, []byte(got), 0o600); err != nil { //nolint:mnd
			tb.Fatalf("failed to write golden file: %v", err)
		}
	}

	wantBytes, err := os.ReadFile(path)
	if err != nil {
		tb.Fatalf("failed to read golden file: %v", err)
	}

	want := string(wantBytes)

	wantSchema, err := parseGraphQLSchema(path, want)
	if err != nil {
		tb.Fatalf("failed to parse golden schema: %v", err)
	}

	gotSchema, err := parseGraphQLSchema("generated", got)
	if err != nil {
		tb.Fatalf("failed to parse generated schema: %v", err)
	}

	if diff := cmp.Diff(wantSchema, gotSchema, getGraphQLSchemaCmpOptions()); diff != "" {
		tb.Errorf("schema mismatch (-want +got):\n%s", diff)
	}
}
