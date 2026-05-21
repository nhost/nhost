package hasura

import (
	"context"
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"fmt"
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

// RelationshipUsing describes how a relationship is defined.
// It handles both simple (column name string) and complex (full constraint object) cases.
type RelationshipUsing struct {
	// ForeignKeyColumn is set when foreign_key_constraint_on is a plain column
	// name; populated via custom unmarshaling, not from a JSON key.
	ForeignKeyColumn string `json:"-"`
	// ForeignKeyConstraint is set when foreign_key_constraint_on is a mapping
	// (table + column); populated via custom unmarshaling, not from a JSON key.
	ForeignKeyConstraint *ForeignKeyConstraint `json:"-"`
	ManualConfiguration  *ManualConfiguration  `json:"manual_configuration,omitempty" yaml:"manual_configuration,omitempty"` //nolint:lll
}

func mapToForeignKeyConstraint(m map[string]any) *ForeignKeyConstraint {
	var (
		column string
		ts     TableSource
	)

	if v, ok := m["column"].(string); ok {
		column = v
	}

	if table, ok := m["table"].(map[string]any); ok {
		if name, ok := table["name"].(string); ok {
			ts.Name = name
		}

		if schema, ok := table["schema"].(string); ok {
			ts.Schema = schema
		}
	}

	return &ForeignKeyConstraint{Column: column, Table: ts}
}

// UnmarshalYAML accepts foreign_key_constraint_on either as a bare column name
// (string) or as a full constraint object (mapping).
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
		r.ForeignKeyColumn = v
	case map[string]any:
		r.ForeignKeyConstraint = mapToForeignKeyConstraint(v)
	}

	return nil
}

// UnmarshalJSON implements custom JSON unmarshaling to handle both string and object forms.
func (r *RelationshipUsing) UnmarshalJSON(data []byte) error {
	var raw struct {
		ForeignKeyConstraintOn jsontext.Value       `json:"foreign_key_constraint_on,omitempty"`
		ManualConfiguration    *ManualConfiguration `json:"manual_configuration,omitempty"`
	}

	if err := json.Unmarshal(data, &raw); err != nil {
		return fmt.Errorf("unmarshaling relationship using: %w", err)
	}

	r.ManualConfiguration = raw.ManualConfiguration

	if raw.ForeignKeyConstraintOn != nil {
		var column string
		if err := json.Unmarshal(raw.ForeignKeyConstraintOn, &column); err == nil {
			r.ForeignKeyColumn = column
		} else {
			var constraint ForeignKeyConstraint
			if err := json.Unmarshal(raw.ForeignKeyConstraintOn, &constraint); err != nil {
				return fmt.Errorf("unmarshaling foreign key constraint: %w", err)
			}

			r.ForeignKeyConstraint = &constraint
		}
	}

	return nil
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

// ForeignKeyConstraint identifies the column and table that anchor a
// foreign-key-backed relationship.
type ForeignKeyConstraint struct {
	Column string      `json:"column" yaml:"column"`
	Table  TableSource `json:"table"  yaml:"table"`
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
		ForeignKeyColumn:     "",
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
			ForeignKeyColumn:     "",
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
