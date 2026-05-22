package hasura

import (
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
}

// FromJSON parses a Hasura v3 metadata JSON blob (as stored in hdb_catalog.hdb_metadata)
// and returns the equivalent *Metadata.
func FromJSON(data []byte) (*Metadata, error) {
	var v3 v3Metadata
	if err := json.Unmarshal(data, &v3); err != nil {
		return nil, fmt.Errorf("failed to unmarshal metadata JSON: %w", err)
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
		Databases:     v3.Sources,
		RemoteSchemas: v3.RemoteSchemas,
	}, nil
}
