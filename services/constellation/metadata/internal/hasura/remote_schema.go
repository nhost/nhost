package hasura

import (
	"context"
	stdjson "encoding/json"
	json "encoding/json/v2"
	"fmt"

	"github.com/nhost/nhost/services/constellation/api"
)

// The Hasura remote-schema metadata wire types are generated from
// api/openapi.yaml (oapi-codegen, see api/types.gen.go) and live in the api
// package. This file re-exports them under the names the metadata layer uses
// and adds the YAML<->JSON bridge the file-source loader needs: the generated
// types carry only JSON tags, so YAML (de)serialization routes through their
// JSON form (which also drives the oapi-codegen union (un)marshalers for
// headers and remote-relationship definitions).

// Aliases of the generated wire types. Nested values need no custom YAML
// handling of their own: they ride the top-level RemoteSchemaMetadata wrapper's
// JSON bridge.
type (
	// RemoteSchemaDefinition is a remote schema's connection definition
	// (url/url_from_env, headers, timeout, customization).
	RemoteSchemaDefinition = api.RemoteSchemaDef
	// RemoteSchemaCustomization mirrors definition.customization.
	RemoteSchemaCustomization = api.RemoteSchemaCustomization
	// RemoteSchemaPermission is a single role permission entry.
	RemoteSchemaPermission = api.RemoteSchemaPermissionMetadata
	// RemoteSchemaPermissionDef holds the role-scoped SDL schema.
	RemoteSchemaPermissionDef = api.RemoteSchemaPermissionDefinition
	// RemoteSchemaHeaderItem is one entry of definition.headers: the
	// HeaderConfValue|HeaderConfFromEnv union (no discriminator).
	RemoteSchemaHeaderItem = api.RemoteSchemaDef_Headers_Item
	// RemoteSchemaTypeRemoteRelationship groups a type's remote relationships.
	RemoteSchemaTypeRemoteRelationship = api.RemoteSchemaMetadataRemoteRelationshipDefinition
	// RemoteSchemaRelationshipDef is one named remote relationship.
	RemoteSchemaRelationshipDef = api.RemoteRelationshipRemoteRelationshipDefinition
	// RemoteSchemaRelationshipDefinition is the to_source|to_remote_schema
	// union (oneOf) carried by a remote relationship.
	RemoteSchemaRelationshipDefinition = api.RemoteRelationshipRemoteRelationshipDefinition_Definition
)

// RemoteSchemaMetadata is the generated api.RemoteSchemaMetadata wire type with
// a YAML<->JSON bridge so the file-source loader (remote_schemas.yaml) can
// decode it; the generated type only carries JSON tags. The DB-source (JSON)
// path uses the underlying type's fields directly via the v2 JSON codec.
type RemoteSchemaMetadata api.RemoteSchemaMetadata

// MarshalJSON emits the remote schema as Hasura does: `comment` mirrors Hasura,
// which omits the key when no comment is set (add_remote_schema without a
// comment exports no `comment` field) and emits it only when present. The
// remaining fields keep their generated shape: `definition` is always present,
// while `permissions` / `remote_relationships` are omitted when absent.
//
// A custom marshaler's bytes are spliced verbatim into the enclosing document,
// so the caller's json.Deterministic option does NOT propagate in here; this
// marshals with json.Deterministic(true) itself so the nested definition
// headers/customization maps keep a stable key order (see ToJSON's note).
func (r RemoteSchemaMetadata) MarshalJSON() ([]byte, error) {
	// Fixed field order (not a map) so the output itself is byte-stable; comment
	// carries omitempty on a pointer so it is omitted when unset, matching Hasura.
	shadow := struct {
		Name                string                                                  `json:"name"`
		Definition          api.RemoteSchemaDef                                     `json:"definition"`
		Comment             *string                                                 `json:"comment,omitempty"`
		Permissions         *[]api.RemoteSchemaPermissionMetadata                   `json:"permissions,omitempty"`
		RemoteRelationships *[]api.RemoteSchemaMetadataRemoteRelationshipDefinition `json:"remote_relationships,omitempty"`
	}{
		Name:                r.Name,
		Definition:          r.Definition,
		Comment:             r.Comment,
		Permissions:         r.Permissions,
		RemoteRelationships: r.RemoteRelationships,
	}

	b, err := json.Marshal(shadow, json.Deterministic(true))
	if err != nil {
		return nil, fmt.Errorf("marshaling remote schema: %w", err)
	}

	return b, nil
}

// UnmarshalYAML decodes YAML by routing through JSON so the generated json tags
// (snake_case) and the oapi-codegen union (un)marshalers apply. The signature
// matches the context-aware variant the rest of the loader uses; remote schemas
// carry no !include directives, so the base-dir context is unused.
func (r *RemoteSchemaMetadata) UnmarshalYAML(
	_ context.Context, unmarshal func(any) error,
) error {
	var raw any
	if err := unmarshal(&raw); err != nil {
		return fmt.Errorf("unmarshaling remote schema: %w", err)
	}

	b, err := stdjson.Marshal(raw)
	if err != nil {
		return fmt.Errorf("re-encoding remote schema yaml: %w", err)
	}

	if err := json.Unmarshal(b, (*api.RemoteSchemaMetadata)(r)); err != nil {
		return fmt.Errorf("decoding remote schema: %w", err)
	}

	return nil
}

// RemoteSchemaRelationshipKind reports which arm of a remote-relationship
// definition union is populated, by inspecting the raw JSON keys. It returns
// whether the to_source and to_remote_schema arms are present, in that order.
// The oapi-codegen union has no discriminator, so As* accessors alone cannot
// tell the variants apart (they ignore unknown keys); key presence is the
// reliable signal Hasura itself uses.
func RemoteSchemaRelationshipKind(
	d RemoteSchemaRelationshipDefinition,
) (bool, bool) {
	b, err := d.MarshalJSON()
	if err != nil {
		return false, false
	}

	var probe struct {
		ToSource       stdjson.RawMessage `json:"to_source"`
		ToRemoteSchema stdjson.RawMessage `json:"to_remote_schema"`
	}

	if err := stdjson.Unmarshal(b, &probe); err != nil {
		return false, false
	}

	return len(probe.ToSource) > 0, len(probe.ToRemoteSchema) > 0
}
