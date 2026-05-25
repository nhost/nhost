package schema

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// TestPkArgs_EnumFKResolvedToEnumType locks in that a primary-key column whose
// FK targets an enum table is exposed as the corresponding `<enum>_enum` type
// — not the underlying scalar — in every PK-arg path: the `_by_pk` query
// field, the `_by_pk` subscription field, the `delete_*_by_pk` mutation
// field, and the `_pk_columns_input` referenced by `update_*_by_pk`.
//
// Regression test for the bug where these four paths bypassed the enum
// lookup and emitted `String!` for composite-PK tables. The reproducer
// mirrors the minimum shape that triggers it: a composite PK whose second
// column FKs into a table marked `IsEnum: true`.
func TestPkArgs_EnumFKResolvedToEnumType(t *testing.T) {
	t.Parallel()

	md := &metadata.DatabaseMetadata{ //nolint:exhaustruct
		Tables: []metadata.TableMetadata{
			{ //nolint:exhaustruct
				Table:  metadata.TableSource{Schema: "public", Name: "muscle_groups"},
				IsEnum: true,
			},
			{ //nolint:exhaustruct
				Table: metadata.TableSource{
					Schema: "public", Name: "exercise_secondary_muscle_groups",
				},
				Configuration: metadata.TableConfiguration{ //nolint:exhaustruct
					CustomName: "exerciseSecondaryMuscleGroups",
				},
			},
		},
	}

	objects := introspection.NewObjects()
	objects.EnumValues["public.muscle_groups"] = []introspection.EnumValue{
		{Value: "chest"},
		{Value: "back"},
	}
	objects.Schemas["public"] = &introspection.Schema{
		Tables: map[string]*introspection.Table{
			"muscle_groups": { //nolint:exhaustruct
				Schema:       "public",
				Name:         "muscle_groups",
				IsInsertable: true,
				IsUpdatable:  true,
				PrimaryKeys:  []string{"value"},
				Columns: []introspection.Column{
					{Name: "value", Type: "text"}, //nolint:exhaustruct
				},
			},
			"exercise_secondary_muscle_groups": { //nolint:exhaustruct
				Schema:       "public",
				Name:         "exercise_secondary_muscle_groups",
				IsInsertable: true,
				IsUpdatable:  true,
				PrimaryKeys:  []string{"exercise_id", "muscle_group"},
				Columns: []introspection.Column{
					{Name: "exercise_id", Type: "uuid"},   //nolint:exhaustruct
					{Name: "muscle_group", Type: "text"}, //nolint:exhaustruct
				},
				ForeignKeys: []introspection.ForeignKey{
					{
						ColumnName:        "muscle_group",
						ForeignSchema:     "public",
						ForeignTable:      "muscle_groups",
						ForeignColumnName: "value",
					},
				},
			},
		},
	}

	sch, err := GenerateForRole(objects, roleAdmin, md, Capabilities{ //nolint:exhaustruct
		Kind: KindPostgres,
	})
	if err != nil {
		t.Fatalf("GenerateForRole returned error: %v", err)
	}

	const (
		wantEnum    = "muscle_groups_enum"
		parent      = "exerciseSecondaryMuscleGroups"
		argName     = "muscle_group"
		queryByPk   = parent + "_by_pk"
		deleteByPk  = "delete_" + parent + "_by_pk"
		pkColsInput = parent + "_pk_columns_input"
	)

	t.Run("by_pk query arg", func(t *testing.T) {
		t.Parallel()
		assertArgType(t, findObject(sch, "query_root"), queryByPk, argName, wantEnum)
	})

	t.Run("by_pk subscription arg", func(t *testing.T) {
		t.Parallel()
		assertArgType(t, findObject(sch, "subscription_root"), queryByPk, argName, wantEnum)
	})

	t.Run("delete_by_pk mutation arg", func(t *testing.T) {
		t.Parallel()
		assertArgType(t, findObject(sch, "mutation_root"), deleteByPk, argName, wantEnum)
	})

	t.Run("pk_columns_input field", func(t *testing.T) {
		t.Parallel()
		assertInputFieldType(t, sch, pkColsInput, argName, wantEnum)
	})
}

func findObject(sch *graph.Schema, name string) *graph.ObjectType {
	for _, o := range sch.Types {
		if o.Name == name {
			return o
		}
	}

	return nil
}

func assertArgType(
	t *testing.T,
	obj *graph.ObjectType,
	fieldName, argName, wantNamed string,
) {
	t.Helper()

	if obj == nil {
		t.Fatalf("object type for field %q is nil", fieldName)
	}

	for _, f := range obj.Fields {
		if f.Name != fieldName {
			continue
		}

		for _, a := range f.Arguments {
			if a.Name != argName {
				continue
			}

			if got := nonNullNamedTypeName(a.Type); got != wantNamed {
				t.Fatalf(
					"%s.%s arg %q: got %s, want NonNull(%s)",
					obj.Name, fieldName, argName, formatType(a.Type), wantNamed,
				)
			}

			return
		}

		t.Fatalf("%s.%s has no argument %q", obj.Name, fieldName, argName)
	}

	t.Fatalf("%s has no field %q", obj.Name, fieldName)
}

func assertInputFieldType(
	t *testing.T,
	sch *graph.Schema,
	inputName, fieldName, wantNamed string,
) {
	t.Helper()

	for _, in := range sch.Inputs {
		if in.Name != inputName {
			continue
		}

		for _, f := range in.Fields {
			if f.Name != fieldName {
				continue
			}

			if got := nonNullNamedTypeName(f.Type); got != wantNamed {
				t.Fatalf(
					"%s.%s: got %s, want NonNull(%s)",
					inputName, fieldName, formatType(f.Type), wantNamed,
				)
			}

			return
		}

		t.Fatalf("%s has no field %q", inputName, fieldName)
	}

	t.Fatalf("schema has no input type %q", inputName)
}

// nonNullNamedTypeName returns the named-type name only when typ is
// NonNull(NamedType(X)); any other shape (nullable, list, nil) yields the
// empty string so the assertion fails with a useful diff.
func nonNullNamedTypeName(typ *graph.Type) string {
	if typ == nil || !typ.NonNull || typ.Elem != nil {
		return ""
	}

	return typ.NamedType
}

func formatType(typ *graph.Type) string {
	if typ == nil {
		return "<nil>"
	}

	if typ.Elem != nil {
		inner := formatType(typ.Elem)
		if typ.NonNull {
			return "[" + inner + "]!"
		}

		return "[" + inner + "]"
	}

	if typ.NonNull {
		return typ.NamedType + "!"
	}

	return typ.NamedType
}
