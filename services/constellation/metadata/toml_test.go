package metadata_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// TestMarshalTOML_RoundTripsThroughFromDetect exercises the public API path:
// marshal to TOML, write to disk, parse back via FromDetect.
func TestMarshalTOML_RoundTripsThroughFromDetect(t *testing.T) {
	t.Parallel()

	original := &metadata.Metadata{
		Databases: []metadata.DatabaseMetadata{
			{
				Name: "default",
				Kind: "postgres",
				Configuration: metadata.DatabaseConfiguration{
					ConnectionInfo: metadata.DatabaseConnectionInfo{
						DatabaseURL: "postgres://localhost/db",
					},
				},
				Tables: []metadata.TableMetadata{
					{
						Table:               metadata.TableSource{Name: "users", Schema: "auth"},
						IsEnum:              false,
						Configuration:       metadata.TableConfiguration{},
						ObjectRelationships: nil,
						ArrayRelationships:  nil,
						RemoteRelationships: nil,
						SelectPermissions:   nil,
						InsertPermissions:   nil,
						UpdatePermissions:   nil,
						DeletePermissions:   nil,
					},
				},
				Functions: nil,
			},
		},
		RemoteSchemas: nil,
		Actions: []metadata.ActionMetadata{
			{
				Name: "ping",
				Definition: metadata.ActionDefinition{
					Kind:                 metadata.ActionKindSynchronous,
					Handler:              "{{ACTIONS_URL}}/ping",
					ForwardClientHeaders: true,
					Headers: []metadata.ActionHeader{
						{Name: "x-secret", ValueFromEnv: "ACTION_SECRET"},
					},
					Timeout: 30,
					Type:    metadata.ActionOperationQuery,
					Arguments: []metadata.ActionArgument{
						{Name: "input", Type: "PingInput!", Description: "Input payload"},
					},
					OutputType: "PingOutput!",
					RequestTransform: map[string]any{
						"template_engine": "Kriti",
					},
					ResponseTransform: map[string]any{
						"template_engine": "Kriti",
					},
				},
				Permissions: []metadata.ActionPermission{{Role: "user"}},
				Comment:     "Ping action",
			},
		},
		CustomTypes: metadata.CustomTypes{
			InputObjects: []metadata.CustomInputObjectType{
				{
					Name:        "PingInput",
					Description: "Input type",
					Fields: []metadata.CustomTypeField{
						{Name: "message", Type: "String!", Description: "Message"},
					},
				},
			},
			Objects: []metadata.CustomObjectType{
				{
					Name:        "PingOutput",
					Description: "Output type",
					Fields: []metadata.CustomTypeField{
						{Name: "message", Type: "String!", Description: "Message"},
					},
					Relationships: []metadata.CustomObjectRelationship{
						{
							Name:         "user",
							Type:         metadata.RelationshipTypeObject,
							RemoteTable:  metadata.TableSource{Name: "users", Schema: "auth"},
							FieldMapping: map[string]string{"user_id": "id"},
							Source:       "default",
						},
					},
				},
			},
			Scalars: []metadata.CustomScalarType{{Name: "UUID", Description: "UUID scalar"}},
			Enums: []metadata.CustomEnumType{
				{
					Name:        "PingKind",
					Description: "Kind enum",
					Values: []metadata.CustomEnumValue{
						{
							Value:             "OLD",
							Description:       "Old value",
							IsDeprecated:      true,
							DeprecationReason: "Use NEW",
						},
						{
							Value:             "NEW",
							Description:       "New value",
							IsDeprecated:      false,
							DeprecationReason: "",
						},
					},
				},
			},
		},
		LoadDiagnostics: []metadata.LoadDiagnostic{
			{
				Kind:   metadata.InconsistencyKindAction,
				Source: "",
				Name:   "actions.yaml",
				Reason: "not serialized",
			},
		},
	}
	expected := *original
	expected.LoadDiagnostics = nil

	data, err := metadata.MarshalTOML(original)
	if err != nil {
		t.Fatalf("MarshalTOML: %v", err)
	}

	path := filepath.Join(t.TempDir(), "meta.toml")

	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatalf("writing toml: %v", err)
	}

	got, err := metadata.FromDetect(t.Context(), path)
	if err != nil {
		t.Fatalf("FromDetect: %v", err)
	}

	if diff := cmp.Diff(&expected, got, cmpopts.EquateEmpty()); diff != "" {
		t.Errorf("public round-trip mismatch (-want +got):\n%s", diff)
	}
}
