package schema

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
)

func TestGenerateForRole_SmallintColumnsUseInt(t *testing.T) {
	t.Parallel()

	md := &metadata.DatabaseMetadata{
		Tables: []metadata.TableMetadata{
			{
				Table: metadata.TableSource{Schema: "public", Name: "metrics"},
			},
		},
	}

	objects := introspection.NewObjects()
	objects.Schemas["public"] = &introspection.Schema{
		Tables: map[string]*introspection.Table{
			"metrics": {
				Schema:       "public",
				Name:         "metrics",
				IsInsertable: true,
				IsUpdatable:  true,
				PrimaryKeys:  []string{"id"},
				Columns: []introspection.Column{
					{Name: "id", Type: "int2"},
					{Name: "rating", Type: "smallint"},
				},
			},
		},
	}

	sch, err := GenerateForRole(objects, roleAdmin, md, Capabilities{
		Kind: KindPostgres,
	})
	if err != nil {
		t.Fatalf("GenerateForRole returned error: %v", err)
	}

	assertSchemaValid(t, sch, roleAdmin)
	assertObjectFieldNamedType(t, sch, "metrics", "id", "Int")
	assertObjectFieldNamedType(t, sch, "metrics", "rating", "Int")
	assertInputFieldNamedType(t, sch, "metrics_bool_exp", "id", "Int_comparison_exp")
	assertInputFieldNamedType(t, sch, "metrics_bool_exp", "rating", "Int_comparison_exp")
	assertScalarMissing(t, sch, "smallint")
	assertInputMissing(t, sch, "smallint_comparison_exp")
}

func assertObjectFieldNamedType(
	t *testing.T,
	sch *graph.Schema,
	objectName string,
	fieldName string,
	wantNamed string,
) {
	t.Helper()

	objectType := findObject(sch, objectName)
	if objectType == nil {
		t.Fatalf("schema has no object type %q", objectName)
	}

	for _, field := range objectType.Fields {
		if field.Name != fieldName {
			continue
		}

		if baseNamedTypeName(field.Type) != wantNamed {
			t.Fatalf(
				"%s.%s: got %s, want %s",
				objectName, fieldName, formatType(field.Type), wantNamed,
			)
		}

		return
	}

	t.Fatalf("%s has no field %q", objectName, fieldName)
}

func assertInputFieldNamedType(
	t *testing.T,
	sch *graph.Schema,
	inputName string,
	fieldName string,
	wantNamed string,
) {
	t.Helper()

	for _, inputType := range sch.Inputs {
		if inputType.Name != inputName {
			continue
		}

		for _, field := range inputType.Fields {
			if field.Name != fieldName {
				continue
			}

			if baseNamedTypeName(field.Type) != wantNamed {
				t.Fatalf(
					"%s.%s: got %s, want %s",
					inputName, fieldName, formatType(field.Type), wantNamed,
				)
			}

			return
		}

		t.Fatalf("%s has no field %q", inputName, fieldName)
	}

	t.Fatalf("schema has no input type %q", inputName)
}

func assertScalarMissing(t *testing.T, sch *graph.Schema, scalarName string) {
	t.Helper()

	for _, scalarType := range sch.Scalars {
		if scalarType.Name == scalarName {
			t.Fatalf("schema unexpectedly has scalar %q", scalarName)
		}
	}
}

func assertInputMissing(t *testing.T, sch *graph.Schema, inputName string) {
	t.Helper()

	for _, inputType := range sch.Inputs {
		if inputType.Name == inputName {
			t.Fatalf("schema unexpectedly has input type %q", inputName)
		}
	}
}

func baseNamedTypeName(typ *graph.Type) string {
	if typ == nil {
		return ""
	}

	for typ.Elem != nil {
		typ = typ.Elem
	}

	return typ.NamedType
}
