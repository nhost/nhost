package hasura

import (
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"errors"
	"fmt"
)

// ErrUnsupportedMetadataVersion is returned by [FromJSON] when the Hasura
// metadata JSON envelope reports a version other than the one this package
// understands.
var ErrUnsupportedMetadataVersion = errors.New("unsupported metadata version")

// v3Metadata is the Hasura v3 JSON envelope stored in hdb_catalog.hdb_metadata.
// It is separate from the canonical [Metadata] because the JSON blob keys its
// database list as "sources" whereas the YAML directory layout uses
// "databases"; FromJSON converts this into a *Metadata.
type v3Metadata struct {
	Version       int                    `json:"version"`
	Sources       []DatabaseMetadata     `json:"sources"`
	RemoteSchemas []RemoteSchemaMetadata `json:"remote_schemas,omitempty"`
	Actions       []ActionMetadata       `json:"actions,omitempty"`
	CustomTypes   CustomTypes            `json:"custom_types,omitzero"`
	Diagnostics   []LoadDiagnostic       `json:"-"`
}

type rawV3Metadata struct {
	Version       int            `json:"version"`
	Sources       jsontext.Value `json:"sources"`
	RemoteSchemas jsontext.Value `json:"remote_schemas,omitempty"`
	Actions       jsontext.Value `json:"actions,omitempty"`
	CustomTypes   jsontext.Value `json:"custom_types,omitempty"`
}

func parseV3MetadataJSON(data []byte) (*v3Metadata, error) {
	var raw rawV3Metadata
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("failed to unmarshal metadata JSON: %w", err)
	}

	v3 := &v3Metadata{
		Version:       raw.Version,
		Sources:       nil,
		RemoteSchemas: nil,
		Actions:       nil,
		CustomTypes:   emptyCustomTypes(),
		Diagnostics:   nil,
	}

	if err := unmarshalMetadataJSON(raw.Sources, &v3.Sources, "sources"); err != nil {
		return nil, err
	}

	if err := unmarshalMetadataJSON(
		raw.RemoteSchemas, &v3.RemoteSchemas, "remote_schemas",
	); err != nil {
		return nil, err
	}

	v3.Actions = unmarshalOptionalActionJSON(raw.Actions, &v3.Diagnostics)
	v3.CustomTypes = unmarshalOptionalCustomTypesJSON(raw.CustomTypes, &v3.Diagnostics)

	return v3, nil
}

func unmarshalMetadataJSON(data jsontext.Value, dst any, field string) error {
	if data == nil {
		return nil
	}

	if err := json.Unmarshal(data, dst); err != nil {
		return fmt.Errorf("failed to unmarshal metadata JSON %s: %w", field, err)
	}

	return nil
}

func unmarshalOptionalActionJSON(
	data jsontext.Value,
	diagnostics *[]LoadDiagnostic,
) []ActionMetadata {
	if data == nil {
		return nil
	}

	var actions []ActionMetadata
	if err := json.Unmarshal(data, &actions); err != nil {
		*diagnostics = append(*diagnostics, LoadDiagnostic{
			Kind:   loadDiagnosticKindAction,
			Source: "",
			Name:   "actions",
			Reason: fmt.Sprintf("failed to unmarshal metadata JSON actions: %v", err),
		})

		return nil
	}

	return actions
}

func unmarshalOptionalCustomTypesJSON(
	data jsontext.Value,
	diagnostics *[]LoadDiagnostic,
) CustomTypes {
	if data == nil {
		return emptyCustomTypes()
	}

	var customTypes CustomTypes
	if err := json.Unmarshal(data, &customTypes); err != nil {
		*diagnostics = append(*diagnostics, LoadDiagnostic{
			Kind:   loadDiagnosticKindCustomType,
			Source: "",
			Name:   "custom_types",
			Reason: fmt.Sprintf("failed to unmarshal metadata JSON custom_types: %v", err),
		})

		return emptyCustomTypes()
	}

	return customTypes
}

// FromJSON parses a Hasura v3 metadata JSON blob (as stored in hdb_catalog.hdb_metadata)
// and returns the equivalent *Metadata.
func FromJSON(data []byte) (*Metadata, error) {
	v3, err := parseV3MetadataJSON(data)
	if err != nil {
		return nil, err
	}

	const expectedVersion = 3
	if v3.Version != expectedVersion {
		return nil, fmt.Errorf(
			"%w: got %d, expected %d",
			ErrUnsupportedMetadataVersion,
			v3.Version,
			expectedVersion,
		)
	}

	// convertRemoteRelationships is normally called inside UnmarshalYAML for TableMetadata,
	// but JSON unmarshaling doesn't trigger that, so we call it explicitly here.
	for i := range v3.Sources {
		for j := range v3.Sources[i].Tables {
			v3.Sources[i].Tables[j].convertRemoteRelationships()
		}
	}

	return &Metadata{
		Databases:       v3.Sources,
		RemoteSchemas:   v3.RemoteSchemas,
		Actions:         v3.Actions,
		CustomTypes:     v3.CustomTypes,
		LoadDiagnostics: v3.Diagnostics,
	}, nil
}
