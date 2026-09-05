// Package metadata defines the configuration shape the controller consumes —
// databases, remote schemas, tables, functions, permissions, and relationships —
// along with loaders that parse it from native TOML or Hasura-compatible
// YAML/JSON.
package metadata

// RoleAdmin is the reserved role name for the unrestricted administrator.
// The admin role bypasses per-table permission checks and is treated as a
// permission shortcut by every connector that builds role-scoped schemas
// (SQL schema generation, remote-schema live introspection, etc.).
const RoleAdmin = "admin"

// Metadata is the top-level configuration for the connector.
type Metadata struct {
	Databases      []DatabaseMetadata     `json:"databases"                 toml:"databases"`
	RemoteSchemas  []RemoteSchemaMetadata `json:"remote_schemas,omitempty"  toml:"remote_schemas,omitempty"`
	Actions        []ActionMetadata       `json:"actions,omitempty"         toml:"actions,omitempty"`
	CustomTypes    CustomTypes            `json:"custom_types,omitzero"     toml:"custom_types,omitempty"`
	InheritedRoles []InheritedRole        `json:"inherited_roles,omitempty" toml:"inherited_roles,omitempty"`

	// LoadDiagnostics carries non-fatal problems encountered while parsing
	// optional metadata sections (actions / custom types). Runtime builds turn
	// these into fresh inconsistencies; they are never serialized.
	LoadDiagnostics []LoadDiagnostic `json:"-" toml:"-"`
}
