package hasura

import (
	"context"
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"errors"
	"fmt"
)

// errUnexpectedForeignKeyToken signals that foreign_key_constraint_on carried
// a JSON token that is none of the four supported shapes (string, array of
// strings, single-column object, composite-columns object).
var errUnexpectedForeignKeyToken = errors.New(
	"foreign_key_constraint_on: expected string, array, or object",
)

// errForeignKeyListEntryNotString signals that one of the entries inside the
// array form of foreign_key_constraint_on was not a string. The YAML and JSON
// paths both surface this — a permissive "drop non-strings" policy would mask
// typos in real-world metadata.
var errForeignKeyListEntryNotString = errors.New(
	"foreign_key_constraint_on: list entry is not a string",
)

// TableMetadata is the Hasura representation of a tracked table.
type TableMetadata struct {
	Table               TableSource          `json:"table"                          yaml:"table"`
	IsEnum              bool                 `json:"is_enum,omitempty"              yaml:"is_enum,omitempty"`
	Configuration       TableConfiguration   `json:"configuration"                  yaml:"configuration,omitempty"`
	ObjectRelationships []ObjectRelationship `json:"object_relationships,omitempty" yaml:"object_relationships,omitempty"`
	ArrayRelationships  []ArrayRelationship  `json:"array_relationships,omitempty"  yaml:"array_relationships,omitempty"`
	RemoteRelationships []RemoteRelationship `json:"remote_relationships,omitempty" yaml:"remote_relationships,omitempty"`
	SelectPermissions   []SelectPermission   `json:"select_permissions,omitempty"   yaml:"select_permissions,omitempty"`
	InsertPermissions   []InsertPermission   `json:"insert_permissions,omitempty"   yaml:"insert_permissions,omitempty"`
	UpdatePermissions   []UpdatePermission   `json:"update_permissions,omitempty"   yaml:"update_permissions,omitempty"`
	DeletePermissions   []DeletePermission   `json:"delete_permissions,omitempty"   yaml:"delete_permissions,omitempty"`
}

// UnmarshalYAML handles entries that may be `!include <path>` directives in
// addition to inline data. It uses the context-aware variant so the include
// base directory can be threaded through the decoder without package-level
// globals.
func (t *TableMetadata) UnmarshalYAML(ctx context.Context, unmarshal func(any) error) error {
	var includeStr string
	if err := unmarshal(&includeStr); err == nil {
		if path, ok := parseIncludePath(includeStr); ok {
			return loadIncludedFile(ctx, path, t)
		}
	}

	// tableAlias drops the custom UnmarshalYAML so the default decoder runs.
	type tableAlias TableMetadata

	var alias tableAlias
	if err := unmarshal(&alias); err != nil {
		return fmt.Errorf("unmarshaling table metadata: %w", err)
	}

	*t = TableMetadata(alias)
	t.convertRemoteRelationships()

	return nil
}

// TableSource identifies a table by schema-qualified name.
type TableSource struct {
	Name   string `json:"name"   yaml:"name"`
	Schema string `json:"schema" yaml:"schema"`
}

// ColumnConfig overrides the GraphQL name a SQL column is exposed under.
type ColumnConfig struct {
	CustomName string `json:"custom_name" yaml:"custom_name"`
}

// CustomRootFields overrides the default GraphQL field names generated for a
// table's CRUD operations.
type CustomRootFields struct {
	Delete          string `json:"delete,omitempty"           yaml:"delete"`
	DeleteByPk      string `json:"delete_by_pk,omitempty"     yaml:"delete_by_pk"`
	Insert          string `json:"insert,omitempty"           yaml:"insert"`
	InsertOne       string `json:"insert_one,omitempty"       yaml:"insert_one"`
	Select          string `json:"select,omitempty"           yaml:"select"`
	SelectAggregate string `json:"select_aggregate,omitempty" yaml:"select_aggregate"`
	SelectByPk      string `json:"select_by_pk,omitempty"     yaml:"select_by_pk"`
	SelectStream    string `json:"select_stream,omitempty"    yaml:"select_stream"`
	Update          string `json:"update,omitempty"           yaml:"update"`
	UpdateByPk      string `json:"update_by_pk,omitempty"     yaml:"update_by_pk"`
	UpdateMany      string `json:"update_many,omitempty"      yaml:"update_many"`
}

// TableConfiguration bundles per-table GraphQL customisations: column
// rename map, the GraphQL type name override, and the root-field overrides.
type TableConfiguration struct {
	ColumnConfig     map[string]ColumnConfig `json:"column_config,omitempty" yaml:"column_config,omitempty"`
	CustomName       string                  `json:"custom_name,omitempty"   yaml:"custom_name,omitempty"`
	CustomRootFields CustomRootFields        `json:"custom_root_fields"      yaml:"custom_root_fields,omitempty"`
}

// SelectPermission binds a role to its select-permission configuration.
type SelectPermission struct {
	Role       string                 `json:"role"       yaml:"role"`
	Permission SelectPermissionConfig `json:"permission" yaml:"permission"`
}

// InsertPermission binds a role to its insert-permission configuration.
type InsertPermission struct {
	Role       string                 `json:"role"       yaml:"role"`
	Permission InsertPermissionConfig `json:"permission" yaml:"permission"`
}

// UpdatePermission binds a role to its update-permission configuration.
type UpdatePermission struct {
	Role       string                 `json:"role"       yaml:"role"`
	Permission UpdatePermissionConfig `json:"permission" yaml:"permission"`
}

// DeletePermission binds a role to its delete-permission configuration.
type DeletePermission struct {
	Role       string                 `json:"role"       yaml:"role"`
	Permission DeletePermissionConfig `json:"permission" yaml:"permission"`
}

// SelectPermissionConfig captures the columns, row filter, and aggregation
// access a select permission grants.
type SelectPermissionConfig struct {
	Columns           []string       `json:"columns,omitempty"            yaml:"columns,omitempty"`
	Filter            map[string]any `json:"filter,omitempty"             yaml:"filter,omitempty"`
	AllowAggregations bool           `json:"allow_aggregations,omitempty" yaml:"allow_aggregations,omitempty"`
}

// InsertPermissionConfig captures the columns, row-level check, and presets an
// insert permission grants.
type InsertPermissionConfig struct {
	Columns []string       `json:"columns,omitempty" yaml:"columns,omitempty"`
	Check   map[string]any `json:"check,omitempty"   yaml:"check,omitempty"`
	Set     map[string]any `json:"set,omitempty"     yaml:"set,omitempty"`
}

// UpdatePermissionConfig captures the columns, row filter, post-update check,
// and presets an update permission grants.
type UpdatePermissionConfig struct {
	Columns []string       `json:"columns,omitempty" yaml:"columns,omitempty"`
	Filter  map[string]any `json:"filter,omitempty"  yaml:"filter,omitempty"`
	Check   map[string]any `json:"check,omitempty"   yaml:"check,omitempty"`
	Set     map[string]any `json:"set,omitempty"     yaml:"set,omitempty"`
}

// DeletePermissionConfig captures the row filter a delete permission applies.
type DeletePermissionConfig struct {
	Filter map[string]any `json:"filter,omitempty" yaml:"filter,omitempty"`
}

// ObjectRelationship is a many-to-one relationship from this table to another.
type ObjectRelationship struct {
	Name  string            `json:"name"  yaml:"name"`
	Using RelationshipUsing `json:"using" yaml:"using"`
}

// ArrayRelationship is a one-to-many relationship from this table to another.
type ArrayRelationship struct {
	Name  string            `json:"name"  yaml:"name"`
	Using RelationshipUsing `json:"using" yaml:"using"`
}

// RelationshipUsing describes how a relationship is defined. Hasura's
// foreign_key_constraint_on accepts four shapes:
//
//  1. string                — single-column FK on the parent table.
//  2. array of strings      — composite FK on the parent table.
//  3. object with table+column  — single-column FK on the target table.
//  4. object with table+columns — composite FK on the target table.
//
// ForeignKeyColumns covers (1) and (2); ForeignKeyConstraint covers (3) and (4).
// Both are populated via custom unmarshaling rather than from JSON keys, so they
// are tagged json:"-".
type RelationshipUsing struct {
	ForeignKeyColumns    []string              `json:"-"`
	ForeignKeyConstraint *ForeignKeyConstraint `json:"-"`
	ManualConfiguration  *ManualConfiguration  `json:"manual_configuration,omitempty" yaml:"manual_configuration,omitempty"` //nolint:lll
}

func mapToForeignKeyConstraint(m map[string]any) *ForeignKeyConstraint {
	var (
		columns []string
		ts      TableSource
	)

	// Hasura accepts either "columns" (composite) or "column" (single). Prefer
	// the plural form when both are present.
	if v, ok := m["columns"].([]any); ok {
		columns = make([]string, 0, len(v))
		for _, item := range v {
			if s, ok := item.(string); ok {
				columns = append(columns, s)
			}
		}
	} else if v, ok := m["column"].(string); ok {
		columns = []string{v}
	}

	if table, ok := m["table"].(map[string]any); ok {
		if name, ok := table["name"].(string); ok {
			ts.Name = name
		}

		if schema, ok := table["schema"].(string); ok {
			ts.Schema = schema
		}
	}

	return &ForeignKeyConstraint{Columns: columns, Table: ts}
}

// UnmarshalYAML accepts foreign_key_constraint_on as any of:
// a bare column name (string), a list of column names ([]string), or a full
// constraint object (mapping) carrying either "column" or "columns". A list
// containing a non-string entry is rejected so the YAML path matches the JSON
// path (which fails the same input via its strict []string decode).
func (r *RelationshipUsing) UnmarshalYAML(unmarshal func(any) error) error {
	type rawUsing struct {
		ForeignKeyConstraintOn any                  `yaml:"foreign_key_constraint_on,omitempty"`
		ManualConfiguration    *ManualConfiguration `yaml:"manual_configuration,omitempty"`
	}

	var raw rawUsing
	if err := unmarshal(&raw); err != nil {
		return fmt.Errorf("unmarshaling relationship using: %w", err)
	}

	r.ManualConfiguration = raw.ManualConfiguration

	switch v := raw.ForeignKeyConstraintOn.(type) {
	case string:
		r.ForeignKeyColumns = []string{v}
	case []any:
		cols := make([]string, 0, len(v))
		for i, item := range v {
			s, ok := item.(string)
			if !ok {
				return fmt.Errorf(
					"unmarshaling relationship using: %w (index %d, type %T)",
					errForeignKeyListEntryNotString, i, item,
				)
			}

			cols = append(cols, s)
		}

		r.ForeignKeyColumns = cols
	case map[string]any:
		r.ForeignKeyConstraint = mapToForeignKeyConstraint(v)
	}

	return nil
}

// UnmarshalJSON implements custom JSON unmarshaling to handle the string,
// array-of-strings, and object forms of foreign_key_constraint_on. The shape
// is selected by peeking the first non-whitespace byte of the raw value so the
// decoder never has to swallow a parse error to fall through to the next case.
// An omitted field decodes to a nil raw value and is treated as a no-op; an
// explicit null is rejected via the default arm so malformed input fails
// loudly instead of silently producing a zero RelationshipUsing.
func (r *RelationshipUsing) UnmarshalJSON(data []byte) error {
	var raw struct {
		ForeignKeyConstraintOn jsontext.Value       `json:"foreign_key_constraint_on,omitempty"`
		ManualConfiguration    *ManualConfiguration `json:"manual_configuration,omitempty"`
	}

	if err := json.Unmarshal(data, &raw); err != nil {
		return fmt.Errorf("unmarshaling relationship using: %w", err)
	}

	r.ManualConfiguration = raw.ManualConfiguration

	if raw.ForeignKeyConstraintOn == nil {
		return nil
	}

	first := firstNonWhitespaceByte(raw.ForeignKeyConstraintOn)

	switch first {
	case '"':
		var column string
		if err := json.Unmarshal(raw.ForeignKeyConstraintOn, &column); err != nil {
			return fmt.Errorf("unmarshaling foreign key constraint: %w", err)
		}

		r.ForeignKeyColumns = []string{column}
	case '[':
		var columns []string
		if err := json.Unmarshal(raw.ForeignKeyConstraintOn, &columns); err != nil {
			return fmt.Errorf("unmarshaling foreign key constraint: %w", err)
		}

		r.ForeignKeyColumns = columns
	case '{':
		constraint, err := unmarshalForeignKeyConstraintJSON(raw.ForeignKeyConstraintOn)
		if err != nil {
			return fmt.Errorf("unmarshaling foreign key constraint: %w", err)
		}

		r.ForeignKeyConstraint = constraint
	default:
		return fmt.Errorf(
			"unmarshaling foreign key constraint: %w (token %q)",
			errUnexpectedForeignKeyToken, first,
		)
	}

	return nil
}

// firstNonWhitespaceByte returns the first non-whitespace byte of a JSON
// fragment, or 0 if the fragment is entirely whitespace.
func firstNonWhitespaceByte(b []byte) byte {
	for _, c := range b {
		switch c {
		case ' ', '\t', '\n', '\r':
			continue
		default:
			return c
		}
	}

	return 0
}

// unmarshalForeignKeyConstraintJSON parses the object form of
// foreign_key_constraint_on, accepting either "columns" (preferred, composite)
// or "column" (single-column) under the same object.
func unmarshalForeignKeyConstraintJSON(data []byte) (*ForeignKeyConstraint, error) {
	var raw struct {
		Columns []string    `json:"columns"`
		Column  string      `json:"column"`
		Table   TableSource `json:"table"`
	}

	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("decoding foreign key constraint object: %w", err)
	}

	columns := raw.Columns
	if len(columns) == 0 && raw.Column != "" {
		columns = []string{raw.Column}
	}

	return &ForeignKeyConstraint{Columns: columns, Table: raw.Table}, nil
}

// ManualConfiguration describes a relationship that isn't backed by a database
// foreign key — either a cross-source (to_source) join or a to_remote_schema
// fetch. ColumnMapping and Source are populated for to_source; LHSFields and
// RemoteField are populated for to_remote_schema (the native package flattens
// RemoteField into a path and renames SQL columns to GraphQL during conversion).
type ManualConfiguration struct {
	RemoteTable   TableSource       `json:"remote_table"            yaml:"remote_table"`
	ColumnMapping map[string]string `json:"column_mapping"          yaml:"column_mapping"`
	Source        string            `json:"source,omitempty"        yaml:"source,omitempty"`
	RemoteSchema  string            `json:"remote_schema,omitempty" yaml:"remote_schema,omitempty"`

	LHSFields   []string                   `json:"-" yaml:"-"`
	RemoteField map[string]RemoteFieldCall `json:"-" yaml:"-"`
}

// ForeignKeyConstraint identifies the columns and table that anchor a
// foreign-key-backed relationship. Columns is the ordered list of columns on
// Table that point back at the parent table; a single-column FK is represented
// as a one-element slice.
type ForeignKeyConstraint struct {
	Columns []string    `json:"columns" yaml:"columns"`
	Table   TableSource `json:"table"   yaml:"table"`
}

// RemoteRelationship represents a cross-database relationship in Hasura format.
// These are converted to ObjectRelationship or ArrayRelationship with ManualConfiguration
// during metadata processing.
type RemoteRelationship struct {
	Name       string                `json:"name"       yaml:"name"`
	Definition RemoteRelationshipDef `json:"definition" yaml:"definition"`
}

// RemoteRelationshipDef defines the remote relationship configuration.
type RemoteRelationshipDef struct {
	ToSource       *ToSourceRelationship       `json:"to_source,omitempty"        yaml:"to_source,omitempty"`
	ToRemoteSchema *ToRemoteSchemaRelationship `json:"to_remote_schema,omitempty" yaml:"to_remote_schema,omitempty"`
}

// ToRemoteSchemaRelationship defines a relationship to a remote GraphQL schema.
type ToRemoteSchemaRelationship struct {
	RemoteSchema string                     `json:"remote_schema" yaml:"remote_schema"`
	LHSFields    []string                   `json:"lhs_fields"    yaml:"lhs_fields"`
	RemoteField  map[string]RemoteFieldCall `json:"remote_field"  yaml:"remote_field"`
}

// RemoteFieldCall defines a remote field path with arguments.
type RemoteFieldCall struct {
	Arguments map[string]string          `json:"arguments,omitempty" yaml:"arguments,omitempty"`
	Field     map[string]RemoteFieldCall `json:"field,omitempty"     yaml:"field,omitempty"`
}

// Relationship-type discriminator values for a to_source relationship's
// relationship_type field. The native metadata package names these too
// (metadata.RelationshipTypeObject/Array), but this package cannot import it
// without an import cycle, so they are duplicated here as local constants.
const (
	relationshipTypeObject = "object"
	relationshipTypeArray  = "array"
)

// ToSourceRelationship defines a relationship to another database source.
type ToSourceRelationship struct {
	FieldMapping     map[string]string `json:"field_mapping"     yaml:"field_mapping"`
	RelationshipType string            `json:"relationship_type" yaml:"relationship_type"`
	Source           string            `json:"source"            yaml:"source"`
	Table            TableSource       `json:"table"             yaml:"table"`
}

// convertRemoteRelationships lowers Hasura-style remote_relationships into
// ObjectRelationship or ArrayRelationship with ManualConfiguration. For
// to_remote_schema relationships, the raw RemoteField map and lhs_fields are
// preserved verbatim; the native metadata package handles the flattening and
// the SQL→GraphQL column rename during conversion.
func (t *TableMetadata) convertRemoteRelationships() {
	for _, remote := range t.RemoteRelationships {
		if remote.Definition.ToSource != nil {
			t.appendToSourceRelationship(remote)
			continue
		}

		if remote.Definition.ToRemoteSchema != nil {
			t.appendToRemoteSchemaRelationship(remote)
		}
	}
}

func (t *TableMetadata) appendToSourceRelationship(remote RemoteRelationship) {
	toSource := remote.Definition.ToSource
	using := RelationshipUsing{
		ForeignKeyColumns:    nil,
		ForeignKeyConstraint: nil,
		ManualConfiguration: &ManualConfiguration{
			RemoteTable: TableSource{
				Name:   toSource.Table.Name,
				Schema: toSource.Table.Schema,
			},
			ColumnMapping: toSource.FieldMapping,
			Source:        toSource.Source,
			RemoteSchema:  "",
			LHSFields:     nil,
			RemoteField:   nil,
		},
	}

	switch toSource.RelationshipType {
	case relationshipTypeObject:
		t.ObjectRelationships = append(t.ObjectRelationships, ObjectRelationship{
			Name:  remote.Name,
			Using: using,
		})
	case relationshipTypeArray:
		t.ArrayRelationships = append(t.ArrayRelationships, ArrayRelationship{
			Name:  remote.Name,
			Using: using,
		})
	}
}

func (t *TableMetadata) appendToRemoteSchemaRelationship(remote RemoteRelationship) {
	toRemoteSchema := remote.Definition.ToRemoteSchema

	// Remote schema relationships are always object relationships (the remote
	// field determines if it returns an array).
	t.ObjectRelationships = append(t.ObjectRelationships, ObjectRelationship{
		Name: remote.Name,
		Using: RelationshipUsing{
			ForeignKeyColumns:    nil,
			ForeignKeyConstraint: nil,
			ManualConfiguration: &ManualConfiguration{
				RemoteTable:   TableSource{Name: "", Schema: ""},
				ColumnMapping: nil,
				Source:        "",
				RemoteSchema:  toRemoteSchema.RemoteSchema,
				LHSFields:     toRemoteSchema.LHSFields,
				RemoteField:   toRemoteSchema.RemoteField,
			},
		},
	})
}
