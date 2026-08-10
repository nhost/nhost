package metadata

// DatabaseMetadata contains the metadata for a single database source.
type DatabaseMetadata struct {
	Name          string                `json:"name"          toml:"name"`
	Kind          string                `json:"kind"          toml:"kind"`
	Configuration DatabaseConfiguration `json:"configuration" toml:"configuration"`
	// Customization holds optional source-level GraphQL customization
	// (root-field namespacing/prefixing, type renaming) applied to every
	// table and function exposed by this source. Mirrors Hasura's
	// sources[].customization.
	Customization Customization      `json:"customization,omitzero" toml:"customization,omitempty"`
	Tables        []TableMetadata    `json:"tables,omitempty"       toml:"tables,omitempty"`
	Functions     []FunctionMetadata `json:"functions,omitempty"    toml:"functions,omitempty"`
}

// DatabaseConnectionInfo contains database connection settings.
type DatabaseConnectionInfo struct {
	DatabaseURL EnvString `json:"database_url" toml:"database_url"`
}

// DatabaseConfiguration contains database configuration.
type DatabaseConfiguration struct {
	// ConnectionInfo holds the connection settings (such as the database
	// URL) used to dial this database source.
	ConnectionInfo DatabaseConnectionInfo `json:"connection_info" toml:"connection_info"`
}
