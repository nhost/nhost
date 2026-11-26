package schemamerge_test

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	"github.com/nhost/nhost/services/constellation/graph"
)

func TestBuildComposedSchema_DefaultRoots(t *testing.T) {
	t.Parallel()

	for _, tt := range []struct {
		name          string
		types         []*graph.ObjectType
		queryName     string
		fallback      bool
		wantMutations bool
	}{
		{
			name: "existing implicit query", queryName: "Query",
			types: []*graph.ObjectType{{Name: "Query", Fields: []*graph.Field{
				{Name: "greeting", Type: graph.NewNamedType("String")},
			}}},
		},
		{
			name: "implicit mutation and type name collision", queryName: "query_root_",
			fallback: true, wantMutations: true,
			types: []*graph.ObjectType{
				{Name: "Mutation", Fields: []*graph.Field{
					{Name: "create", Type: graph.NewNamedType("query_root")},
				}},
				{Name: "query_root", Fields: []*graph.Field{
					{Name: "id", Type: graph.NewNamedType("ID")},
				}},
			},
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			unused := &graph.ObjectType{Name: "Unused"}
			combined := &graph.Schema{RestrictedReadRoots: true, Types: append(tt.types, unused)}

			_, validated, fallback, err := schemamerge.BuildComposedSchema(combined, "reader")
			if err != nil {
				t.Fatalf("validating role: %v", err)
			}

			if validated.Query == nil || validated.Query.Name != tt.queryName ||
				fallback != tt.fallback || (validated.Mutation != nil) != tt.wantMutations {
				t.Fatalf(
					"wrong roots: query=%v mutation=%v fallback=%t",
					validated.Query,
					validated.Mutation,
					fallback,
				)
			}

			if validated.Types["Unused"] != nil || len(combined.Types) != len(tt.types)+1 ||
				combined.Types[len(tt.types)] != unused || combined.QueryType != nil {
				t.Fatal("composition did not prune its own copy")
			}
		})
	}
}
