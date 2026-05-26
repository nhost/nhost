package schemamerge_test

import (
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	"github.com/nhost/nhost/services/constellation/graph"
)

// minimalSchema returns a graph.Schema with one query field and a minimal object
// type. The query type is named via QueryType so callers can exercise both the
// "default Query" and "custom query_root" branches by tweaking the returned schema.
func minimalSchema(queryTypeName, fieldName, returnType string) *graph.Schema {
	return &graph.Schema{
		QueryType: &queryTypeName,
		Types: []*graph.ObjectType{
			{
				Name: queryTypeName,
				Fields: []*graph.Field{
					{Name: fieldName, Type: graph.NewNamedType(returnType)},
				},
			},
			{
				Name: returnType,
				Fields: []*graph.Field{
					{Name: "id", Type: graph.NewNonNullType("String")},
				},
			},
		},
	}
}

func TestMergeConnectorSchema_RenamesRootTypeToCombinedName(t *testing.T) {
	t.Parallel()

	// Source schema's query root is the default "Query"; the combined schema uses
	// "query_root", forcing the rename branch in mergeRootType.
	schema := minimalSchema("Query", "users", "User")
	combined := &graph.Schema{}
	fieldToConnector := map[string]string{}
	typeToConnector := map[string]string{}

	err := schemamerge.MergeConnectorSchema(
		schema,
		combined,
		"db",
		fieldToConnector,
		typeToConnector,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if combined.QueryType == nil || *combined.QueryType != "query_root" {
		t.Fatalf("expected combined QueryType set to 'query_root'")
	}

	// The renamed root type should be present in combined.Types under its new name.
	var foundRoot *graph.ObjectType

	for _, typ := range combined.Types {
		if typ.Name == "query_root" {
			foundRoot = typ
		}
	}

	if foundRoot == nil {
		t.Fatalf("expected renamed root type 'query_root' in combined.Types")
	}

	if got := fieldToConnector["users"]; got != "db" {
		t.Errorf("expected field 'users' owned by 'db', got %q", got)
	}

	if got := typeToConnector["User"]; got != "db" {
		t.Errorf("expected type 'User' owned by 'db', got %q", got)
	}

	if _, ok := typeToConnector["Query"]; ok {
		t.Errorf("root type should not be tracked in typeToConnector")
	}
}

func TestMergeConnectorSchema_MergesIntoExistingRoot(t *testing.T) {
	t.Parallel()

	// First connector populates combined.
	first := minimalSchema("Query", "users", "User")
	combined := &graph.Schema{}
	fieldToConnector := map[string]string{}
	typeToConnector := map[string]string{}

	if err := schemamerge.MergeConnectorSchema(
		first,
		combined,
		"db1",
		fieldToConnector,
		typeToConnector,
	); err != nil {
		t.Fatalf("first merge failed: %v", err)
	}

	// Second connector's root type should be merged into the existing 'query_root'.
	second := minimalSchema("Query", "posts", "Post")
	if err := schemamerge.MergeConnectorSchema(
		second,
		combined,
		"db2",
		fieldToConnector,
		typeToConnector,
	); err != nil {
		t.Fatalf("second merge failed: %v", err)
	}

	rootCount := 0

	var root *graph.ObjectType

	for _, typ := range combined.Types {
		if typ.Name == "query_root" {
			rootCount++
			root = typ
		}
	}

	if rootCount != 1 {
		t.Fatalf("expected exactly one 'query_root' after merge, got %d", rootCount)
	}

	if len(root.Fields) != 2 {
		t.Fatalf("expected both connectors' fields merged onto root, got %d", len(root.Fields))
	}

	if got := fieldToConnector["users"]; got != "db1" {
		t.Errorf("expected 'users' owned by db1, got %q", got)
	}

	if got := fieldToConnector["posts"]; got != "db2" {
		t.Errorf("expected 'posts' owned by db2, got %q", got)
	}
}

func TestMergeConnectorSchema_DescriptionCarriedForwardToExistingRoot(t *testing.T) {
	t.Parallel()

	combinedQuery := "query_root"
	srcQuery := "Query"

	// Seed combined.Types with an existing root type that has no description.
	combined := &graph.Schema{
		QueryType: &combinedQuery,
		Types: []*graph.ObjectType{
			{Name: "query_root", Description: ""},
		},
	}

	schema := &graph.Schema{
		QueryType: &srcQuery,
		Types: []*graph.ObjectType{
			{
				Name:        "Query",
				Description: "Root query type",
				Fields:      []*graph.Field{{Name: "x", Type: graph.NewNamedType("String")}},
			},
		},
	}

	if err := schemamerge.MergeConnectorSchema(
		schema,
		combined,
		"db",
		map[string]string{},
		map[string]string{},
	); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if combined.Types[0].Description != "Root query type" {
		t.Errorf(
			"expected description carried forward, got %q",
			combined.Types[0].Description,
		)
	}
}

func TestMergeConnectorSchema_NilTypeToConnectorIsAllowed(t *testing.T) {
	t.Parallel()

	schema := minimalSchema("Query", "users", "User")
	combined := &graph.Schema{}

	// Pass nil typeToConnector — the function must not panic and must still merge.
	err := schemamerge.MergeConnectorSchema(
		schema,
		combined,
		"db",
		map[string]string{},
		nil,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(combined.Types) < 2 {
		t.Fatalf("expected regular and root types merged, got %d", len(combined.Types))
	}
}

func TestMergeConnectorSchema_PropagatesEnumConflict(t *testing.T) {
	t.Parallel()

	combined := &graph.Schema{
		Enums: []*graph.EnumType{
			{Name: "Status", Values: []*graph.EnumValue{{Name: "A"}}},
		},
	}
	queryType := "Query"
	schema := &graph.Schema{
		QueryType: &queryType,
		Types: []*graph.ObjectType{
			{
				Name:   "Query",
				Fields: []*graph.Field{{Name: "x", Type: graph.NewNamedType("String")}},
			},
		},
		Enums: []*graph.EnumType{
			{Name: "Status", Values: []*graph.EnumValue{{Name: "B"}}},
		},
	}

	err := schemamerge.MergeConnectorSchema(
		schema,
		combined,
		"db",
		map[string]string{},
		map[string]string{},
	)
	if err == nil || !strings.Contains(err.Error(), "Status") {
		t.Fatalf("expected enum conflict error mentioning 'Status', got %v", err)
	}
}

func TestBuildValidatedSchema_HappyPath(t *testing.T) {
	t.Parallel()

	schema := minimalSchema("query_root", "users", "User")
	combined := &graph.Schema{}

	if err := schemamerge.MergeConnectorSchema(
		schema,
		combined,
		"db",
		map[string]string{},
		map[string]string{},
	); err != nil {
		t.Fatalf("merge failed: %v", err)
	}

	doc, validated, err := schemamerge.BuildValidatedSchema(combined, "admin")
	if err != nil {
		t.Fatalf("BuildValidatedSchema failed: %v", err)
	}

	if doc == nil || validated == nil {
		t.Fatalf("expected non-nil document and validated schema")
	}

	if validated.Query == nil {
		t.Errorf("expected validated schema to have a Query root")
	}
}

func TestBuildValidatedSchema_ValidationErrorOnDanglingRoot(t *testing.T) {
	t.Parallel()

	// Combined schema references a Query root type name that does not exist in
	// combined.Types — the gqlparser validator must reject this.
	queryType := "query_root"
	combined := &graph.Schema{
		QueryType: &queryType,
	}

	doc, validated, err := schemamerge.BuildValidatedSchema(combined, "user")
	if err == nil {
		t.Fatalf("expected validation error for dangling root type, got doc=%v schema=%v",
			doc, validated)
	}

	if !strings.Contains(err.Error(), "user") {
		t.Errorf("expected error to mention the role 'user', got %q", err.Error())
	}
}
