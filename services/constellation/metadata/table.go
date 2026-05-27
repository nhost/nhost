package metadata

import "slices"

// TableMetadata contains the metadata for a single tracked table.
type TableMetadata struct {
	Table               TableSource          `json:"table"                          toml:"table"`
	IsEnum              bool                 `json:"is_enum,omitzero"               toml:"is_enum,omitempty"`
	Configuration       TableConfiguration   `json:"configuration,omitzero"         toml:"configuration,omitempty"`
	ObjectRelationships []ObjectRelationship `json:"object_relationships,omitempty" toml:"object_relationships,omitempty"`
	ArrayRelationships  []ArrayRelationship  `json:"array_relationships,omitempty"  toml:"array_relationships,omitempty"`
	RemoteRelationships []RemoteRelationship `json:"remote_relationships,omitempty" toml:"remote_relationships,omitempty"`
	SelectPermissions   []SelectPermission   `json:"select_permissions,omitempty"   toml:"select_permissions,omitempty"`
	InsertPermissions   []InsertPermission   `json:"insert_permissions,omitempty"   toml:"insert_permissions,omitempty"`
	UpdatePermissions   []UpdatePermission   `json:"update_permissions,omitempty"   toml:"update_permissions,omitempty"`
	DeletePermissions   []DeletePermission   `json:"delete_permissions,omitempty"   toml:"delete_permissions,omitempty"`
}

// TableSource identifies a table in the database.
type TableSource struct {
	Name   string `json:"name"   toml:"name"`
	Schema string `json:"schema" toml:"schema"`
}

// ColumnConfig configures a column's GraphQL representation.
type ColumnConfig struct {
	// CustomName overrides the SQL column name with this identifier in the
	// generated GraphQL schema.
	CustomName string `json:"custom_name" toml:"custom_name"`
}

// CustomRootFields allows overriding the default GraphQL field names for a table.
type CustomRootFields struct {
	Delete          string `json:"delete,omitempty"           toml:"delete,omitempty"`
	DeleteByPk      string `json:"delete_by_pk,omitempty"     toml:"delete_by_pk,omitempty"`
	Insert          string `json:"insert,omitempty"           toml:"insert,omitempty"`
	InsertOne       string `json:"insert_one,omitempty"       toml:"insert_one,omitempty"`
	Select          string `json:"select,omitempty"           toml:"select,omitempty"`
	SelectAggregate string `json:"select_aggregate,omitempty" toml:"select_aggregate,omitempty"`
	SelectByPk      string `json:"select_by_pk,omitempty"     toml:"select_by_pk,omitempty"`
	SelectStream    string `json:"select_stream,omitempty"    toml:"select_stream,omitempty"`
	Update          string `json:"update,omitempty"           toml:"update,omitempty"`
	UpdateByPk      string `json:"update_by_pk,omitempty"     toml:"update_by_pk,omitempty"`
	UpdateMany      string `json:"update_many,omitempty"      toml:"update_many,omitempty"`
}

// TableConfiguration allows customizing a table's GraphQL representation.
type TableConfiguration struct {
	// ColumnConfig maps SQL column names to per-column overrides such as
	// custom GraphQL field names.
	ColumnConfig map[string]ColumnConfig `json:"column_config,omitempty" toml:"column_config,omitempty"`
	// CustomName overrides the GraphQL type name derived from the table's
	// schema-qualified SQL name.
	CustomName string `json:"custom_name,omitempty" toml:"custom_name,omitempty"`
	// CustomRootFields overrides the default names of the query and mutation
	// root fields generated for this table.
	CustomRootFields CustomRootFields `json:"custom_root_fields,omitzero" toml:"custom_root_fields,omitempty"`
}

// SelectPermission defines a role's select permission on a table.
type SelectPermission struct {
	Role       string                 `json:"role"       toml:"role"`
	Permission SelectPermissionConfig `json:"permission" toml:"permission"`
}

// InsertPermission defines a role's insert permission on a table.
type InsertPermission struct {
	Role       string                 `json:"role"       toml:"role"`
	Permission InsertPermissionConfig `json:"permission" toml:"permission"`
}

// UpdatePermission defines a role's update permission on a table.
type UpdatePermission struct {
	Role       string                 `json:"role"       toml:"role"`
	Permission UpdatePermissionConfig `json:"permission" toml:"permission"`
}

// DeletePermission defines a role's delete permission on a table.
type DeletePermission struct {
	Role       string                 `json:"role"       toml:"role"`
	Permission DeletePermissionConfig `json:"permission" toml:"permission"`
}

// SelectPermissionConfig contains the select permission configuration.
type SelectPermissionConfig struct {
	// Columns lists the columns this role is allowed to read. An empty list
	// denies access to every column.
	Columns []string `json:"columns,omitempty" toml:"columns,omitempty"`
	// Filter is a Hasura-style boolean expression that is AND-ed into the
	// WHERE clause of every SELECT this role issues against the table.
	Filter map[string]any `json:"filter,omitempty" toml:"filter,omitempty"`
	// AllowAggregations enables the table's aggregate root field for this
	// role when true; aggregates are forbidden when false.
	AllowAggregations bool `json:"allow_aggregations,omitzero" toml:"allow_aggregations,omitempty"`
}

// InsertPermissionConfig contains the insert permission configuration.
type InsertPermissionConfig struct {
	// Columns lists the columns this role is allowed to provide values for
	// in an insert; any other column is rejected.
	Columns []string `json:"columns,omitempty" toml:"columns,omitempty"`
	// Check is a Hasura-style boolean expression that every inserted row
	// must satisfy. Rows failing the check are rejected.
	Check map[string]any `json:"check,omitempty" toml:"check,omitempty"`
	// Set maps column names to session-variable expressions whose value is
	// forcibly written to that column on every insert by this role.
	Set map[string]any `json:"set,omitempty" toml:"set,omitempty"`
}

// UpdatePermissionConfig contains the update permission configuration.
type UpdatePermissionConfig struct {
	// Columns lists the columns this role is allowed to modify; any other
	// column in the update payload is rejected.
	Columns []string `json:"columns,omitempty" toml:"columns,omitempty"`
	// Filter is a Hasura-style boolean expression that selects which rows
	// are visible to this role for update; non-matching rows are not touched.
	Filter map[string]any `json:"filter,omitempty" toml:"filter,omitempty"`
	// Check is a Hasura-style boolean expression evaluated against the
	// post-update row state; updates producing a row that fails the check
	// are rejected.
	Check map[string]any `json:"check,omitempty" toml:"check,omitempty"`
	// Set maps column names to session-variable expressions whose value is
	// forcibly written to that column on every update by this role.
	Set map[string]any `json:"set,omitempty" toml:"set,omitempty"`
}

// DeletePermissionConfig contains the delete permission configuration.
type DeletePermissionConfig struct {
	// Filter is a Hasura-style boolean expression that selects which rows
	// this role may delete; non-matching rows are not touched.
	Filter map[string]any `json:"filter,omitempty" toml:"filter,omitempty"`
}

// ObjectRelationship defines an object (many-to-one) relationship.
type ObjectRelationship struct {
	Name  string            `json:"name"  toml:"name"`
	Using RelationshipUsing `json:"using" toml:"using"`
}

// ArrayRelationship defines an array (one-to-many) relationship.
type ArrayRelationship struct {
	Name  string            `json:"name"  toml:"name"`
	Using RelationshipUsing `json:"using" toml:"using"`
}

// RelationshipUsing describes how a relationship is defined. Exactly one of
// the three fields is populated, making this a tagged union over the three
// mutually exclusive shapes a relationship can take.
//
// ForeignKeyColumns lists the parent-table columns that anchor a forward
// relationship; a single-column FK is a one-element slice. ForeignKeyConstraint
// is set for a reverse relationship whose FK columns live on the target table.
// ManualConfiguration carries to_source and to_remote_schema joins that have
// no backing foreign key.
type RelationshipUsing struct {
	ForeignKeyColumns    []string              `json:"foreign_key_columns,omitempty"    toml:"foreign_key_columns,omitempty"`    //nolint:lll
	ForeignKeyConstraint *ForeignKeyConstraint `json:"foreign_key_constraint,omitempty" toml:"foreign_key_constraint,omitempty"` //nolint:lll
	ManualConfiguration  *ManualConfiguration  `json:"manual_configuration,omitempty"   toml:"manual_configuration,omitempty"`   //nolint:lll
}

// ForeignKeyConstraint identifies a (possibly composite) foreign key
// relationship anchored on the target table. Columns is the ordered list of
// columns on Table that point back at the parent table; a single-column FK is
// represented as a one-element slice.
type ForeignKeyConstraint struct {
	Columns []string    `json:"columns" toml:"columns"`
	Table   TableSource `json:"table"   toml:"table"`
}

// ManualConfiguration defines a manually configured relationship.
type ManualConfiguration struct {
	// RemoteTable identifies the table on the far side of the relationship.
	RemoteTable TableSource `json:"remote_table" toml:"remote_table"`
	// ColumnMapping maps a local column name to the remote column it joins
	// against; multiple entries form a composite join key.
	ColumnMapping map[string]string `json:"column_mapping" toml:"column_mapping"`
	// Source names the database the remote table lives in. Empty means the
	// same source as the owning table.
	Source string `json:"source,omitempty" toml:"source,omitempty"`
	// RemoteSchema names the remote GraphQL schema the relationship targets
	// when the join goes to a remote schema rather than a database table.
	RemoteSchema string `json:"remote_schema,omitempty" toml:"remote_schema,omitempty"`
	// RemoteFieldPath is the ordered remote-schema field path the
	// relationship traverses; populated internally and not part of the wire
	// format.
	RemoteFieldPath []RemoteFieldPathEntry `json:"-" toml:"-"`
}

// RemoteRelationship defines a relationship to another source or remote schema.
type RemoteRelationship struct {
	Name       string                `json:"name"       toml:"name"`
	Definition RemoteRelationshipDef `json:"definition" toml:"definition"`
}

// RemoteRelationshipDef contains the remote relationship definition.
type RemoteRelationshipDef struct {
	ToSource       *ToSourceRelationship       `json:"to_source,omitempty"        toml:"to_source,omitempty"`
	ToRemoteSchema *ToRemoteSchemaRelationship `json:"to_remote_schema,omitempty" toml:"to_remote_schema,omitempty"`
}

// ToSourceRelationship defines a relationship to another database source.
type ToSourceRelationship struct {
	FieldMapping     map[string]string `json:"field_mapping"     toml:"field_mapping"`
	RelationshipType string            `json:"relationship_type" toml:"relationship_type"`
	Source           string            `json:"source"            toml:"source"`
	Table            TableSource       `json:"table"             toml:"table"`
}

// Relationship type sentinels for the RelationshipType field on
// ToSourceRelationship and RemoteSchemaToSourceRelationship. The wire format
// uses bare strings ("array" / "object"); these constants exist so the rest
// of the codebase can compare against a named symbol instead of a magic
// string literal.
const (
	// RelationshipTypeArray marks an array (one-to-many / many-to-many) relationship.
	RelationshipTypeArray = "array"
	// RelationshipTypeObject marks an object (one-to-one / many-to-one) relationship.
	RelationshipTypeObject = "object"
)

// ToRemoteSchemaRelationship defines a relationship to a remote GraphQL schema.
type ToRemoteSchemaRelationship struct {
	RemoteSchema string                     `json:"remote_schema" toml:"remote_schema"`
	LHSFields    []string                   `json:"lhs_fields"    toml:"lhs_fields"`
	RemoteField  map[string]RemoteFieldCall `json:"remote_field"  toml:"remote_field"`
}

// RemoteFieldCall defines a remote field path with arguments.
type RemoteFieldCall struct {
	Arguments map[string]string          `json:"arguments,omitempty" toml:"arguments,omitempty"`
	Field     map[string]RemoteFieldCall `json:"field,omitempty"     toml:"field,omitempty"`
}

// RemoteFieldPathEntry represents a single step in a remote schema field path.
type RemoteFieldPathEntry struct {
	FieldName string
	Arguments map[string]string
}

// ExtractRemoteFieldPath flattens a RemoteFieldCall map into an ordered path.
//
// A real Hasura remote-field path carries exactly one field per nesting level,
// so the traversal is unambiguous. Should a level ever carry multiple keys, the
// entries for that level are emitted in sorted key order rather than randomised
// Go map-iteration order: the resulting path feeds query planning, where a
// reordered path could silently change the generated query.
func ExtractRemoteFieldPath(remoteField map[string]RemoteFieldCall) []RemoteFieldPathEntry {
	var path []RemoteFieldPathEntry

	fieldNames := make([]string, 0, len(remoteField))
	for fieldName := range remoteField {
		fieldNames = append(fieldNames, fieldName)
	}

	slices.Sort(fieldNames)

	for _, fieldName := range fieldNames {
		call := remoteField[fieldName]

		path = append(path, RemoteFieldPathEntry{
			FieldName: fieldName,
			Arguments: call.Arguments,
		})

		if call.Field != nil {
			path = append(path, ExtractRemoteFieldPath(call.Field)...)
		}
	}

	return path
}
