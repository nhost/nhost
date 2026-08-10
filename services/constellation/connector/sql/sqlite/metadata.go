package sqlite

import (
	"github.com/nhost/nhost/services/constellation/metadata"
)

// FlattenMetadata rewrites every schema-qualified reference in the given
// database metadata so it uses an empty schema. SQLite has no schemas: its
// introspector returns all tables under Schemas[""], so metadata that was
// authored for Postgres (with schemas like "auth", "public", "storage") must
// be transformed before BuildRoots / schema generation can resolve table
// lookups.
//
// The transform is in-place. It walks:
//   - TableMetadata.Table
//   - Object/Array relationships' FK and manual configurations
//   - Remote relationships' to_source target table
//   - SelectPermissionConfig.Filter, InsertPermissionConfig.Check/Set,
//     UpdatePermissionConfig.Filter/Check/Set, DeletePermissionConfig.Filter
//     (recursively zeroing `_table.schema` inside any `_exists` clause)
//   - FunctionMetadata.Function
func FlattenMetadata(db *metadata.DatabaseMetadata) {
	for i := range db.Tables {
		tbl := &db.Tables[i]
		tbl.Table.Schema = ""

		for j := range tbl.ObjectRelationships {
			flattenRelationshipUsing(&tbl.ObjectRelationships[j].Using)
		}

		for j := range tbl.ArrayRelationships {
			flattenRelationshipUsing(&tbl.ArrayRelationships[j].Using)
		}

		for j := range tbl.RemoteRelationships {
			def := &tbl.RemoteRelationships[j].Definition
			if def.ToSource != nil {
				def.ToSource.Table.Schema = ""
			}
		}

		for j := range tbl.SelectPermissions {
			flattenExistsSchemas(tbl.SelectPermissions[j].Permission.Filter)
		}

		for j := range tbl.InsertPermissions {
			flattenExistsSchemas(tbl.InsertPermissions[j].Permission.Check)
			flattenExistsSchemas(tbl.InsertPermissions[j].Permission.Set)
		}

		for j := range tbl.UpdatePermissions {
			flattenExistsSchemas(tbl.UpdatePermissions[j].Permission.Filter)
			flattenExistsSchemas(tbl.UpdatePermissions[j].Permission.Check)
			flattenExistsSchemas(tbl.UpdatePermissions[j].Permission.Set)
		}

		for j := range tbl.DeletePermissions {
			flattenExistsSchemas(tbl.DeletePermissions[j].Permission.Filter)
		}
	}

	for i := range db.Functions {
		db.Functions[i].Function.Schema = ""
	}
}

func flattenRelationshipUsing(using *metadata.RelationshipUsing) {
	if using.ForeignKeyConstraint != nil {
		using.ForeignKeyConstraint.Table.Schema = ""
	}

	if using.ManualConfiguration != nil {
		using.ManualConfiguration.RemoteTable.Schema = ""
	}
}

// flattenExistsSchemas walks a permission filter/check tree (map[string]any
// with arbitrary nesting) and zeros out the schema in every `_exists._table`
// reference.
func flattenExistsSchemas(v any) {
	switch x := v.(type) {
	case map[string]any:
		if t, ok := x["_table"].(map[string]any); ok {
			t["schema"] = ""
		}

		for _, child := range x {
			flattenExistsSchemas(child)
		}
	case []any:
		for _, item := range x {
			flattenExistsSchemas(item)
		}
	}
}
