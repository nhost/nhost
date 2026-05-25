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

	md := &metadata.DatabaseMetadata{
		Tables: []metadata.TableMetadata{
			{
				Table:  metadata.TableSource{Schema: "public", Name: "muscle_groups"},
				IsEnum: true,
			},
			{
				Table: metadata.TableSource{
					Schema: "public", Name: "exercise_secondary_muscle_groups",
				},
				Configuration: metadata.TableConfiguration{
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
			"muscle_groups": {
				Schema:       "public",
				Name:         "muscle_groups",
				IsInsertable: true,
				IsUpdatable:  true,
				PrimaryKeys:  []string{"value"},
				Columns: []introspection.Column{
					{Name: "value", Type: "text"},
				},
			},
			"exercise_secondary_muscle_groups": {
				Schema:       "public",
				Name:         "exercise_secondary_muscle_groups",
				IsInsertable: true,
				IsUpdatable:  true,
				PrimaryKeys:  []string{"exercise_id", "muscle_group"},
				Columns: []introspection.Column{
					{Name: "exercise_id", Type: "uuid"},
					{Name: "muscle_group", Type: "text"},
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

	sch, err := GenerateForRole(objects, roleAdmin, md, Capabilities{
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

	t.Run("update_by_pk mutation pk_columns arg", func(t *testing.T) {
		t.Parallel()
		assertArgType(
			t,
			findObject(sch, "mutation_root"),
			"update_"+parent+"_by_pk",
			"pk_columns",
			pkColsInput,
		)
	})
}

// TestPkArgs_EnumFKResolvedToEnumType_NullableIntrospection combines the
// composite-PK + enum-FK shape from TestPkArgs_EnumFKResolvedToEnumType with
// the SQLite implicit-NOT-NULL-PK nullability shape from
// TestPkArgs_NullableIntrospectedColumnStillNonNull: every PK column is
// introspected with IsNullable=true, including the enum-FK PK column. All
// four PK-arg paths must still emit NonNull(<named>) — NonNull(uuid) for the
// scalar PK column and NonNull(muscle_groups_enum) for the enum-FK PK column.
// Without the forceNonNull plumbing through the enum-FK resolution path,
// this configuration silently demotes the enum-typed arg to a nullable type.
func TestPkArgs_EnumFKResolvedToEnumType_NullableIntrospection(t *testing.T) {
	t.Parallel()

	md := &metadata.DatabaseMetadata{
		Tables: []metadata.TableMetadata{
			{
				Table:  metadata.TableSource{Schema: "public", Name: "muscle_groups"},
				IsEnum: true,
			},
			{
				Table: metadata.TableSource{
					Schema: "public", Name: "exercise_secondary_muscle_groups",
				},
				Configuration: metadata.TableConfiguration{
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
			"muscle_groups": {
				Schema:       "public",
				Name:         "muscle_groups",
				IsInsertable: true,
				IsUpdatable:  true,
				PrimaryKeys:  []string{"value"},
				Columns: []introspection.Column{
					{Name: "value", Type: "text"},
				},
			},
			"exercise_secondary_muscle_groups": {
				Schema:       "public",
				Name:         "exercise_secondary_muscle_groups",
				IsInsertable: true,
				IsUpdatable:  true,
				PrimaryKeys:  []string{"exercise_id", "muscle_group"},
				Columns: []introspection.Column{
					// Both PK columns introspected as nullable — mirrors the
					// SQLite quirk applied to a composite PK whose second
					// column is an enum FK.
					{Name: "exercise_id", Type: "uuid", IsNullable: true},
					{Name: "muscle_group", Type: "text", IsNullable: true},
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

	sch, err := GenerateForRole(objects, roleAdmin, md, Capabilities{
		Kind: KindPostgres,
	})
	if err != nil {
		t.Fatalf("GenerateForRole returned error: %v", err)
	}

	const (
		wantEnum    = "muscle_groups_enum"
		wantScalar  = "uuid"
		parent      = "exerciseSecondaryMuscleGroups"
		enumArg     = "muscle_group"
		scalarArg   = "exercise_id"
		queryByPk   = parent + "_by_pk"
		deleteByPk  = "delete_" + parent + "_by_pk"
		pkColsInput = parent + "_pk_columns_input"
	)

	t.Run("by_pk query enum-FK arg", func(t *testing.T) {
		t.Parallel()
		assertArgType(t, findObject(sch, "query_root"), queryByPk, enumArg, wantEnum)
	})

	t.Run("by_pk query scalar arg", func(t *testing.T) {
		t.Parallel()
		assertArgType(t, findObject(sch, "query_root"), queryByPk, scalarArg, wantScalar)
	})

	t.Run("by_pk subscription enum-FK arg", func(t *testing.T) {
		t.Parallel()
		assertArgType(
			t, findObject(sch, "subscription_root"), queryByPk, enumArg, wantEnum,
		)
	})

	t.Run("by_pk subscription scalar arg", func(t *testing.T) {
		t.Parallel()
		assertArgType(
			t, findObject(sch, "subscription_root"), queryByPk, scalarArg, wantScalar,
		)
	})

	t.Run("delete_by_pk mutation enum-FK arg", func(t *testing.T) {
		t.Parallel()
		assertArgType(
			t, findObject(sch, "mutation_root"), deleteByPk, enumArg, wantEnum,
		)
	})

	t.Run("delete_by_pk mutation scalar arg", func(t *testing.T) {
		t.Parallel()
		assertArgType(
			t, findObject(sch, "mutation_root"), deleteByPk, scalarArg, wantScalar,
		)
	})

	t.Run("pk_columns_input enum-FK field", func(t *testing.T) {
		t.Parallel()
		assertInputFieldType(t, sch, pkColsInput, enumArg, wantEnum)
	})

	t.Run("pk_columns_input scalar field", func(t *testing.T) {
		t.Parallel()
		assertInputFieldType(t, sch, pkColsInput, scalarArg, wantScalar)
	})
}

// TestPkArgs_NullableIntrospectedColumnStillNonNull locks in that PK columns
// introspected as IsNullable=true (the SQLite `TYPE PRIMARY KEY` quirk —
// `PRAGMA table_xinfo.notnull` is 0 unless the column is declared with an
// explicit `NOT NULL` or is `INTEGER PRIMARY KEY`) still resolve to NonNull
// in every PK-arg path. Regression test for the `getColumnGraphQLType`
// `forceNonNull` parameter: without it, PK args silently demoted from `T!`
// to `T`, breaking the `_by_pk` / `delete_*_by_pk` / `*_pk_columns_input`
// schema contract.
func TestPkArgs_NullableIntrospectedColumnStillNonNull(t *testing.T) {
	t.Parallel()

	md := &metadata.DatabaseMetadata{
		Tables: []metadata.TableMetadata{
			{
				Table: metadata.TableSource{Schema: "public", Name: "items"},
			},
		},
	}

	objects := introspection.NewObjects()
	objects.Schemas["public"] = &introspection.Schema{
		Tables: map[string]*introspection.Table{
			"items": {
				Schema:       "public",
				Name:         "items",
				IsInsertable: true,
				IsUpdatable:  true,
				PrimaryKeys:  []string{"id"},
				Columns: []introspection.Column{
					// SQLite reports IsNullable=true for a bare `id TEXT
					// PRIMARY KEY` declaration. Hasura still expects `T!`
					// on every PK-arg path.
					{Name: "id", Type: "text", IsNullable: true},
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

	const (
		parent      = "items"
		argName     = "id"
		wantNamed   = "String"
		queryByPk   = parent + "_by_pk"
		deleteByPk  = "delete_" + parent + "_by_pk"
		pkColsInput = parent + "_pk_columns_input"
	)

	t.Run("by_pk query arg", func(t *testing.T) {
		t.Parallel()
		assertArgType(t, findObject(sch, "query_root"), queryByPk, argName, wantNamed)
	})

	t.Run("by_pk subscription arg", func(t *testing.T) {
		t.Parallel()
		assertArgType(t, findObject(sch, "subscription_root"), queryByPk, argName, wantNamed)
	})

	t.Run("delete_by_pk mutation arg", func(t *testing.T) {
		t.Parallel()
		assertArgType(t, findObject(sch, "mutation_root"), deleteByPk, argName, wantNamed)
	})

	t.Run("pk_columns_input field", func(t *testing.T) {
		t.Parallel()
		assertInputFieldType(t, sch, pkColsInput, argName, wantNamed)
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
