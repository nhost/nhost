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
//
// Unknown captures envelope-level fields the engine does not model (e.g.
// `resource_version`, `cron_triggers`, …) so they survive a FromJSON ∘ ToJSON
// round-trip. Per-struct unknowns are captured on the individual wire types via
// their own `json:",unknown"` fields.
//
// `actions` and `custom_types` are claimed here as raw jsontext so they do NOT
// fall into Unknown; FromJSON parses them tolerantly via
// extractActionMetadataJSON into the typed Metadata.Actions / .CustomTypes
// (the single source of truth), and ToJSON re-emits them from those typed
// fields via v3MetadataOut. Keeping them out of Unknown avoids a duplicate
// `actions` member when a mutated snapshot is re-marshalled.
type v3Metadata struct {
	Version        int                    `json:"version"`
	Sources        []DatabaseMetadata     `json:"sources"`
	RemoteSchemas  []RemoteSchemaMetadata `json:"remote_schemas,omitempty"`
	Actions        jsontext.Value         `json:"actions,omitempty"`
	CustomTypes    jsontext.Value         `json:"custom_types,omitempty"`
	InheritedRoles []InheritedRole        `json:"inherited_roles,omitempty"`
	Unknown        jsontext.Value         `json:",unknown"`
}

// v3MetadataOut is the marshal-side envelope. Unlike v3Metadata it carries the
// typed Actions / CustomTypes so mutations to those slices are serialized;
// it is never used for unmarshaling, so the typed action parse cannot reject
// otherwise-tolerable input.
type v3MetadataOut struct {
	Version        int                    `json:"version"`
	Sources        []DatabaseMetadata     `json:"sources"`
	RemoteSchemas  []RemoteSchemaMetadata `json:"remote_schemas,omitempty"`
	Actions        []ActionMetadata       `json:"actions,omitempty"`
	CustomTypes    CustomTypes            `json:"custom_types,omitzero"`
	InheritedRoles []InheritedRole        `json:"inherited_roles,omitempty"`
	Unknown        jsontext.Value         `json:",unknown"`
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

	actions, customTypes, diagnostics := extractActionMetadataJSON(data)

	return &Metadata{
		Databases:       v3.Sources,
		RemoteSchemas:   v3.RemoteSchemas,
		Actions:         actions,
		CustomTypes:     customTypes,
		InheritedRoles:  v3.InheritedRoles,
		LoadDiagnostics: diagnostics,
		Unknown:         v3.Unknown,
	}, nil
}

// extractActionMetadataJSON tolerantly parses the optional `actions` and
// `custom_types` sections from a Hasura v3 metadata blob. A malformed section
// degrades to a LoadDiagnostic and is dropped — mirroring the YAML loader — so
// a bad action never fails the whole metadata load.
func extractActionMetadataJSON(data []byte) ([]ActionMetadata, CustomTypes, []LoadDiagnostic) {
	var raw struct {
		Actions     jsontext.Value `json:"actions"`
		CustomTypes jsontext.Value `json:"custom_types"`
	}

	if err := json.Unmarshal(data, &raw); err != nil {
		// FromJSON already unmarshaled the envelope, so this is unreachable in
		// practice; degrade safely rather than fail the load.
		return nil, emptyCustomTypes(), nil
	}

	var diagnostics []LoadDiagnostic

	actions := unmarshalOptionalActionJSON(raw.Actions, &diagnostics)
	customTypes := unmarshalOptionalCustomTypesJSON(raw.CustomTypes, &diagnostics)

	return actions, customTypes, diagnostics
}

func unmarshalOptionalActionJSON(
	data jsontext.Value,
	diagnostics *[]LoadDiagnostic,
) []ActionMetadata {
	if len(data) == 0 {
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
	if len(data) == 0 {
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

// ToJSON serializes a *Metadata back into the Hasura v3 JSON envelope. It is
// the inverse of [FromJSON]: round-tripping a blob through FromJSON ∘ ToJSON
// preserves both fields the engine models and Hasura fields it does not (the
// latter via the `json:",unknown"` fields injected on every wire struct).
//
// The auto-derived Object/Array entries that [TableMetadata.convertRemoteRelationships]
// lowers from RemoteRelationships at parse time are filtered out before
// marshaling — they would otherwise be emitted alongside the originals, and
// a second FromJSON would re-derive them on top, producing duplicates.
func ToJSON(m *Metadata) ([]byte, error) {
	const version = 3

	sources := make([]DatabaseMetadata, len(m.Databases))
	for i, db := range m.Databases {
		sources[i] = withoutDerivedRelationships(db)
	}

	v3 := v3MetadataOut{
		Version:        version,
		Sources:        sources,
		RemoteSchemas:  m.RemoteSchemas,
		Actions:        m.Actions,
		CustomTypes:    m.CustomTypes,
		InheritedRoles: m.InheritedRoles,
		Unknown:        m.Unknown,
	}

	// Deterministic so the file-source export is byte-stable across process
	// restarts: json/v2 otherwise emits Go-map keys (permission filters,
	// column_config, type-name mappings, …) in randomized iteration order.
	// Custom MarshalJSON outputs are spliced verbatim, so any that marshal a
	// map set the option themselves — see RelationshipUsing.MarshalJSON.
	data, err := json.Marshal(&v3, json.Deterministic(true))
	if err != nil {
		return nil, fmt.Errorf("failed to marshal metadata JSON: %w", err)
	}

	return data, nil
}

// withoutDerivedRelationships returns a shallow copy of db whose tables drop
// Object/Array entries whose names also appear in RemoteRelationships — these
// are the auto-lowered duplicates created by convertRemoteRelationships at
// parse time. Everything else is preserved.
func withoutDerivedRelationships(db DatabaseMetadata) DatabaseMetadata {
	out := db
	out.Tables = make([]TableMetadata, len(db.Tables))

	for i, t := range db.Tables {
		remoteNames := make(map[string]struct{}, len(t.RemoteRelationships))
		for _, r := range t.RemoteRelationships {
			remoteNames[r.Name] = struct{}{}
		}

		tableCopy := t
		tableCopy.ObjectRelationships = filterByName(
			t.ObjectRelationships,
			remoteNames,
			func(r ObjectRelationship) string { return r.Name },
		)
		tableCopy.ArrayRelationships = filterByName(
			t.ArrayRelationships,
			remoteNames,
			func(r ArrayRelationship) string { return r.Name },
		)
		out.Tables[i] = tableCopy
	}

	return out
}

func filterByName[T any](items []T, drop map[string]struct{}, nameOf func(T) string) []T {
	if len(drop) == 0 || len(items) == 0 {
		return items
	}

	out := make([]T, 0, len(items))
	for _, item := range items {
		if _, skip := drop[nameOf(item)]; skip {
			continue
		}

		out = append(out, item)
	}

	return out
}
