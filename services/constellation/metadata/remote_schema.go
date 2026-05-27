package metadata

// RemoteSchemaMetadata contains the metadata for a remote GraphQL schema.
type RemoteSchemaMetadata struct {
	Name                string                               `json:"name"                           toml:"name"`
	Definition          RemoteSchemaDefinition               `json:"definition"                     toml:"definition"`
	Comment             string                               `json:"comment,omitempty"              toml:"comment,omitempty"`              //nolint:lll
	Permissions         []RemoteSchemaPermission             `json:"permissions,omitempty"          toml:"permissions,omitempty"`          //nolint:lll
	RemoteRelationships []RemoteSchemaTypeRemoteRelationship `json:"remote_relationships,omitempty" toml:"remote_relationships,omitempty"` //nolint:lll
}

// RemoteSchemaTypeRemoteRelationship maps a type name to its remote relationships.
type RemoteSchemaTypeRemoteRelationship struct {
	TypeName      string                        `json:"type_name"     toml:"type_name"`
	Relationships []RemoteSchemaRelationshipDef `json:"relationships" toml:"relationships"`
}

// RemoteSchemaRelationshipDef defines a remote relationship from a remote schema type.
type RemoteSchemaRelationshipDef struct {
	Name       string                             `json:"name"       toml:"name"`
	Definition RemoteSchemaRelationshipDefinition `json:"definition" toml:"definition"`
}

// RemoteSchemaRelationshipDefinition contains the relationship definition.
type RemoteSchemaRelationshipDefinition struct {
	// ToSource describes a join from the remote schema's type into a
	// database source. Nil for any other relationship kind.
	ToSource *RemoteSchemaToSourceRelationship `json:"to_source,omitempty" toml:"to_source,omitempty"`
}

// RemoteSchemaToSourceRelationship defines a relationship from a remote schema to a database.
type RemoteSchemaToSourceRelationship struct {
	FieldMapping     map[string]string    `json:"field_mapping"     toml:"field_mapping"`
	RelationshipType string               `json:"relationship_type" toml:"relationship_type"`
	Source           string               `json:"source"            toml:"source"`
	Table            RemoteSchemaTableRef `json:"table"             toml:"table"`
}

// RemoteSchemaTableRef references a table in a database.
type RemoteSchemaTableRef struct {
	Name   string `json:"name"   toml:"name"`
	Schema string `json:"schema" toml:"schema"`
}

// RemoteSchemaDefinition defines the connection settings for a remote schema.
type RemoteSchemaDefinition struct {
	// URL is the HTTP(S) endpoint to send GraphQL requests to. Supports
	// {{VAR_NAME}} environment-variable interpolation.
	URL EnvString `json:"url" toml:"url"`
	// TimeoutSeconds bounds how long the connector waits for a response
	// from the remote endpoint. Zero leaves the timeout at its default.
	TimeoutSeconds int `json:"timeout_seconds,omitempty" toml:"timeout_seconds,omitempty"`
	// Customization holds optional schema-customisation options (type and
	// field renames, namespace prefixing) applied to the introspected
	// remote schema.
	Customization Customization `json:"customization,omitzero" toml:"customization,omitempty"`
	// Headers are static request headers attached to every call to the
	// remote endpoint, with environment-variable interpolation on each
	// header value.
	Headers []RemoteSchemaHeader `json:"headers,omitempty" toml:"headers,omitempty"`
	// ForwardClientHeaders, when true, forwards the incoming client
	// request's headers to the remote endpoint in addition to Headers.
	ForwardClientHeaders bool `json:"forward_client_headers,omitempty" toml:"forward_client_headers,omitempty"` //nolint:lll
}

// RemoteSchemaHeader defines a header to be sent with requests to the remote schema.
type RemoteSchemaHeader struct {
	Name  string    `json:"name"  toml:"name"`
	Value EnvString `json:"value" toml:"value"`
}

// RemoteSchemaPermission defines permissions for a specific role on a remote schema.
type RemoteSchemaPermission struct {
	Role       string                    `json:"role"       toml:"role"`
	Definition RemoteSchemaPermissionDef `json:"definition" toml:"definition"`
}

// RemoteSchemaPermissionDef contains the GraphQL SDL schema for a role's permissions.
type RemoteSchemaPermissionDef struct {
	Schema string `json:"schema" toml:"schema,multiline"`
}
