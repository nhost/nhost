package hasura

import "context"

type RemoteSchemaRequest struct {
	Type string                  `json:"type"`
	Args RemoteSchemaRequestArgs `json:"args"`
}

type RemoteSchemaRequestArgs struct {
	Name       string                            `json:"name"`
	Definition RemoteSchemaRequestArgsDefinition `json:"definition"`
	Comment    string                            `json:"comment"`
}

type RemoteSchemaRequestArgsDefinition struct {
	URL                  string        `json:"url"`
	Headers              []Headers     `json:"headers"`
	ForwardClientHeaders bool          `json:"forward_client_headers"`
	TimeoutSeconds       int           `json:"timeout_seconds"`
	Customization        Customization `json:"customization"`
}

type Customization struct {
	RootFieldsNamespace string       `json:"root_fields_namespace"`
	TypeNames           TypeNames    `json:"type_names"`
	FieldNames          []FieldNames `json:"field_names"`
}

type Headers struct {
	Name         string `json:"name"`
	Value        string `json:"value,omitempty"`
	ValueFromEnv string `json:"value_from_env,omitempty"`
}

type TypeNames struct {
	Prefix  string            `json:"prefix,omitempty"`
	Suffix  string            `json:"suffix,omitempty"`
	Mapping map[string]string `json:"mapping"`
}

type FieldNames struct {
	ParentType string            `json:"parent_type"`
	Prefix     string            `json:"prefix"`
	Suffix     string            `json:"suffix"`
	Mapping    map[string]string `json:"mapping"`
}

func (c *Client) RemoteSchema(ctx context.Context, req *RemoteSchemaRequest) error {
	var resp any
	return c.QueryMetadata(ctx, req, &resp)
}

type ReloadRemoteSchemaRequest struct {
	Type string                        `json:"type"`
	Args ReloadRemoteSchemaRequestArgs `json:"args"`
}

type ReloadRemoteSchemaRequestArgs struct {
	Name string `json:"name"`
}

func (c *Client) ReloadRemoteSchema(ctx context.Context, name string) error {
	req := &ReloadRemoteSchemaRequest{
		Type: "reload_remote_schema",
		Args: ReloadRemoteSchemaRequestArgs{
			Name: name,
		},
	}

	var resp any

	return c.QueryMetadata(ctx, req, &resp)
}
