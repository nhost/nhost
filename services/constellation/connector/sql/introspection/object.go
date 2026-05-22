// Package introspection defines the data types produced by database
// introspection: schemas, tables, columns, constraints, and functions.
package introspection

import (
	"errors"
	"fmt"
)

// ErrInvalidEnumTable is the sentinel returned for any validation failure
// against the enum-table shape expected by the GraphQL schema generator.
// The wrapping fmt.Errorf carries the offending table identity and a
// specific reason.
var ErrInvalidEnumTable = errors.New("invalid enum table")

// EnumValue represents a single value in an enum table.
type EnumValue struct {
	// Value is the primary-key column value; this becomes the GraphQL enum
	// member name.
	Value string
	// Comment is the description text surfaced as the GraphQL enum value's
	// description (not a SQL `COMMENT ON` value).
	Comment string
}

// Objects represents the database structure with schemas, tables, columns, and functions.
// All three maps are required; construct with NewObjects to ensure they are initialised.
type Objects struct {
	// Schemas maps the schema name to its Schema value.
	Schemas map[string]*Schema
	// EnumValues maps "schema.table" to the list of enum values for that enum table.
	EnumValues map[string][]EnumValue
	// Functions maps "schema.function_name" to the function metadata.
	Functions map[string]*Function
}

// NewObjects returns an Objects with all three required maps initialised to empty.
// Callers should use this constructor rather than a struct literal so that the
// lookup helpers (GetTable, GetEnumValues, GetFunction) can rely on non-nil maps.
func NewObjects() *Objects {
	return &Objects{
		Schemas:    map[string]*Schema{},
		EnumValues: map[string][]EnumValue{},
		Functions:  map[string]*Function{},
	}
}

// GetTable returns the table with the given schema and name, or false if not found.
func (o *Objects) GetTable(schemaName, tableName string) (*Table, bool) {
	schema, ok := o.Schemas[schemaName]
	if !ok {
		return nil, false
	}

	table, ok := schema.Tables[tableName]
	if !ok {
		return nil, false
	}

	return table, true
}

// GetEnumValues returns the enum values for a given enum table.
func (o *Objects) GetEnumValues(schemaName, tableName string) ([]EnumValue, bool) {
	key := schemaName + "." + tableName
	values, ok := o.EnumValues[key]

	return values, ok
}

// GetFunction returns a function by schema and name.
func (o *Objects) GetFunction(schemaName, funcName string) (*Function, bool) {
	key := schemaName + "." + funcName
	fn, ok := o.Functions[key]

	return fn, ok
}

// Schema represents a database schema with its tables.
// The schema name is the key in Objects.Schemas.
type Schema struct {
	Tables map[string]*Table
}

// Column represents a single column in a database table.
type Column struct {
	// Name is the column identifier.
	Name string
	// Type is the database-native type name (e.g. "text", "int4", "_text").
	Type string
	// IsNullable is true if the column accepts NULL.
	IsNullable bool
	// IsGenerated is true if the column is computed by the database and
	// therefore must be omitted from insert/update mutations.
	IsGenerated bool
	// IsArray is true if the column is a PostgreSQL array type (e.g. "_text").
	// SQLite columns always set this to false.
	IsArray bool
	// SupportsMinMax is true if the column type supports min/max aggregate
	// operators in the generated GraphQL schema.
	SupportsMinMax bool
	// SupportsInc is true if the column type supports the _inc update
	// operator (numeric columns).
	SupportsInc bool
	// SupportsAgg is true if the column type supports sum/avg/stddev/var
	// aggregate operators in the generated GraphQL schema.
	SupportsAgg bool
	// Default holds the column's default expression as raw SQL.
	// A nil pointer means "no default"; a non-nil pointer to the empty
	// string would mean an explicit empty default.
	Default *string
	// Comment is the SQL COMMENT ON COLUMN value, or nil if unset.
	Comment *string
}

// ForeignKey represents a foreign key relationship from a column to another table.
type ForeignKey struct {
	// ColumnName is the column in the source table that holds the foreign
	// key.
	ColumnName string
	// ForeignSchema is the schema of the referenced table.
	// SQLite introspection leaves this as the empty string; consumers
	// treat "" as "same schema as the source table".
	ForeignSchema string
	// ForeignTable is the name of the referenced table.
	ForeignTable string
	// ForeignColumnName is the referenced column in ForeignTable.
	ForeignColumnName string
}

// UniqueConstraint represents a unique constraint on one or more columns.
type UniqueConstraint struct {
	// Name is the constraint identifier as reported by the database.
	Name string
	// Columns is the ordered list of column names covered by the
	// constraint.
	Columns []string
}

// Table represents an introspected database table with its columns, keys, and constraints.
type Table struct {
	// Schema is the table's schema name.
	Schema string
	// Name is the table identifier.
	Name string
	// Comment is the SQL COMMENT ON TABLE value, or nil if unset.
	Comment *string
	// Columns are the table's columns in declaration order.
	Columns []Column
	// PrimaryKeys lists the column names that form the primary key,
	// in key order. Empty for tables without a primary key.
	PrimaryKeys []string
	// PrimaryKeyConstraintName is the PostgreSQL primary-key constraint
	// name, used to populate the ON CONFLICT constraint enum for
	// insert mutations. SQLite leaves this empty and consumers fall back
	// to "<table>_pkey".
	PrimaryKeyConstraintName string
	// ForeignKeys lists foreign-key relationships originating from
	// columns in this table.
	ForeignKeys []ForeignKey
	// UniqueConstraints lists unique constraints (excluding the primary
	// key) defined on this table.
	UniqueConstraints []UniqueConstraint
}

// maxEnumTableColumns is the upper bound for an enum table: the primary-key value
// column plus an optional description column.
const maxEnumTableColumns = 2

// EnumColumns validates that t is a valid enum table and returns its
// primary-key column name and its optional description column name
// (or "" if the table has no description column). The error messages
// document the constraints when validation fails.
func (t *Table) EnumColumns() (string, string, error) {
	if len(t.PrimaryKeys) != 1 {
		return "", "", fmt.Errorf(
			"%w %s.%s: must have exactly one primary key column, got %d",
			ErrInvalidEnumTable, t.Schema, t.Name, len(t.PrimaryKeys),
		)
	}

	if len(t.Columns) > maxEnumTableColumns {
		return "", "", fmt.Errorf(
			"%w %s.%s: must have at most %d columns (value + optional description), got %d",
			ErrInvalidEnumTable, t.Schema, t.Name, maxEnumTableColumns, len(t.Columns),
		)
	}

	valueCol := t.PrimaryKeys[0]

	var (
		descCol string
		pkFound bool
	)

	for _, col := range t.Columns {
		if col.Name == valueCol {
			pkFound = true
			continue
		}

		descCol = col.Name
	}

	if !pkFound {
		return "", "", fmt.Errorf(
			"%w %s.%s: primary key column %q is not in the column list",
			ErrInvalidEnumTable, t.Schema, t.Name, valueCol,
		)
	}

	return valueCol, descCol, nil
}
