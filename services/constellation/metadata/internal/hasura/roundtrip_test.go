package hasura_test

import (
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

// TestRoundTripJSON_RealMetadata verifies that the existing 39 KB real-world
// Hasura metadata blob round-trips through FromJSON ∘ ToJSON ∘ FromJSON
// without losing structure. Fields the engine doesn't model are preserved by
// the `json:",unknown"` tags on every wire struct.
func TestRoundTripJSON_RealMetadata(t *testing.T) {
	t.Parallel()

	input, err := os.ReadFile(
		filepath.Join("testdata", "TestFromJSON_RealMetadata", "metadata.json"),
	)
	if err != nil {
		t.Fatalf("read input: %v", err)
	}

	first, err := hasura.FromJSON(input)
	if err != nil {
		t.Fatalf("FromJSON #1: %v", err)
	}

	out, err := hasura.ToJSON(first)
	if err != nil {
		t.Fatalf("ToJSON: %v", err)
	}

	second, err := hasura.FromJSON(out)
	if err != nil {
		t.Fatalf("FromJSON #2: %v", err)
	}

	// EquateEmpty so an empty map and a nil map of the same type compare equal
	// — the engine treats them identically and ToJSON may produce either.
	if diff := cmp.Diff(first, second, cmpopts.EquateEmpty()); diff != "" {
		t.Errorf("FromJSON ∘ ToJSON ∘ FromJSON differs (-first +second):\n%s", diff)
	}
}

// TestRoundTripJSON_PreservesUnknownFields verifies that the `,unknown` tag
// captures and re-emits envelope-level and per-struct Hasura fields the
// engine does not model. This is the property /v1/metadata's `export_metadata`
// relies on to faithfully return the on-disk blob.
func TestRoundTripJSON_PreservesUnknownFields(t *testing.T) {
	t.Parallel()

	blob := []byte(`{
		"version": 3,
		"sources": [
			{
				"name": "default",
				"kind": "postgres",
				"configuration": {
					"connection_info": {
						"database_url": "postgres://example"
					}
				},
				"customization": {
					"root_fields": {},
					"type_names": {}
				},
				"tables": [],
				"experimental_feature_flag": "preview"
			}
		],
		"remote_schemas": [],
		"actions": [{"name": "myAction", "definition": {"kind": "synchronous"}}],
		"cron_triggers": [{"name": "cleanup", "schedule": "0 * * * *"}],
		"query_collections": [],
		"resource_version": 7
	}`)

	parsed, err := hasura.FromJSON(blob)
	if err != nil {
		t.Fatalf("FromJSON: %v", err)
	}

	out, err := hasura.ToJSON(parsed)
	if err != nil {
		t.Fatalf("ToJSON: %v", err)
	}

	// Re-parse as a freeform map so we can assert top-level unknowns survived.
	var raw map[string]jsontext.Value
	if err := json.Unmarshal(out, &raw); err != nil {
		t.Fatalf("re-unmarshal as map: %v", err)
	}

	for _, name := range []string{"actions", "cron_triggers", "query_collections", "resource_version"} {
		if _, ok := raw[name]; !ok {
			t.Errorf("envelope-level unknown field %q was not preserved through round-trip", name)
		}
	}

	// Sanity: per-struct unknown (`experimental_feature_flag` inside the
	// source) should also survive. Dig into the first source.
	var withSources struct {
		Sources []map[string]jsontext.Value `json:"sources"`
	}
	if err := json.Unmarshal(out, &withSources); err != nil {
		t.Fatalf("re-unmarshal sources: %v", err)
	}

	if len(withSources.Sources) != 1 {
		t.Fatalf("expected 1 source, got %d", len(withSources.Sources))
	}

	if _, ok := withSources.Sources[0]["experimental_feature_flag"]; !ok {
		t.Errorf("per-struct unknown `experimental_feature_flag` was not preserved")
	}

	// Belt-and-braces: confirm the second-pass FromJSON also retains the
	// envelope-level unknowns via the v3Metadata.Unknown field.
	roundtripped, err := hasura.FromJSON(out)
	if err != nil {
		t.Fatalf("FromJSON #2: %v", err)
	}

	if len(roundtripped.Unknown) == 0 {
		t.Error("Metadata.Unknown is empty after round-trip; envelope unknowns lost")
	}

	if !strings.Contains(string(roundtripped.Unknown), "actions") {
		t.Errorf("Metadata.Unknown does not contain `actions`: %s", string(roundtripped.Unknown))
	}
}

// TestRoundTripJSON_PreservesPermissionShape is an export-SHAPE test (distinct
// from the EquateEmpty round-trip above, which re-parses both sides and so
// cannot see a dropped empty field). It asserts the bytes ToJSON emits are
// Hasura-valid: a present-but-empty `filter: {}` survives (required by Hasura
// on select/delete permissions), and unmodeled permission keys the engine does
// not model (`limit`, `backend_only`) are not silently dropped.
func TestRoundTripJSON_PreservesPermissionShape(t *testing.T) {
	t.Parallel()

	blob := []byte(`{
		"version": 3,
		"sources": [
			{
				"name": "default",
				"kind": "postgres",
				"configuration": {"connection_info": {"database_url": "postgres://x"}},
				"customization": {"root_fields": {}, "type_names": {}},
				"tables": [
					{
						"table": {"name": "users", "schema": "public"},
						"select_permissions": [
							{"role": "user", "permission": {
								"columns": ["id"],
								"filter": {},
								"limit": 10,
								"backend_only": true
							}}
						],
						"delete_permissions": [
							{"role": "user", "permission": {"filter": {}}}
						]
					}
				]
			}
		]
	}`)

	parsed, err := hasura.FromJSON(blob)
	if err != nil {
		t.Fatalf("FromJSON: %v", err)
	}

	out, err := hasura.ToJSON(parsed)
	if err != nil {
		t.Fatalf("ToJSON: %v", err)
	}

	var doc struct {
		Sources []struct {
			Tables []struct {
				SelectPermissions []struct {
					Permission map[string]jsontext.Value `json:"permission"`
				} `json:"select_permissions"`
				DeletePermissions []struct {
					Permission map[string]jsontext.Value `json:"permission"`
				} `json:"delete_permissions"`
			} `json:"tables"`
		} `json:"sources"`
	}
	if err := json.Unmarshal(out, &doc); err != nil {
		t.Fatalf("re-unmarshal export: %v", err)
	}

	if len(doc.Sources) != 1 || len(doc.Sources[0].Tables) != 1 {
		t.Fatalf("unexpected export shape: %s", out)
	}

	table := doc.Sources[0].Tables[0]

	if len(table.SelectPermissions) != 1 {
		t.Fatalf("expected 1 select permission, got %d", len(table.SelectPermissions))
	}

	sel := table.SelectPermissions[0].Permission

	for key, want := range map[string]string{
		"filter":       "{}",
		"limit":        "10",
		"backend_only": "true",
	} {
		got, ok := sel[key]
		if !ok {
			t.Errorf("select permission dropped %q on export: %s", key, out)
			continue
		}

		if strings.TrimSpace(string(got)) != want {
			t.Errorf("select permission %q = %s; want %s", key, got, want)
		}
	}

	if len(table.DeletePermissions) != 1 {
		t.Fatalf("expected 1 delete permission, got %d", len(table.DeletePermissions))
	}

	del := table.DeletePermissions[0].Permission
	if got, ok := del["filter"]; !ok || strings.TrimSpace(string(got)) != "{}" {
		t.Errorf("delete permission filter = %q (present=%v); want {}", del["filter"], ok)
	}
}

// TestRoundTripJSON_PreservesUsingUnknownKeys verifies that a sibling key in a
// relationship's `using` block (which RelationshipUsing does not model) survives
// the export round-trip via the type's manual unknown capture. `using` is a
// closed union in Hasura today, so this guards against silent loss if that ever
// changes.
func TestRoundTripJSON_PreservesUsingUnknownKeys(t *testing.T) {
	t.Parallel()

	blob := []byte(`{
		"version": 3,
		"sources": [
			{
				"name": "default",
				"kind": "postgres",
				"configuration": {"connection_info": {"database_url": "postgres://x"}},
				"customization": {"root_fields": {}, "type_names": {}},
				"tables": [
					{
						"table": {"name": "posts", "schema": "public"},
						"object_relationships": [
							{
								"name": "author",
								"using": {
									"foreign_key_constraint_on": "author_id",
									"x_future_key": {"a": 1}
								}
							}
						]
					}
				]
			}
		]
	}`)

	parsed, err := hasura.FromJSON(blob)
	if err != nil {
		t.Fatalf("FromJSON: %v", err)
	}

	out, err := hasura.ToJSON(parsed)
	if err != nil {
		t.Fatalf("ToJSON: %v", err)
	}

	var doc struct {
		Sources []struct {
			Tables []struct {
				ObjectRelationships []struct {
					Using map[string]jsontext.Value `json:"using"`
				} `json:"object_relationships"`
			} `json:"tables"`
		} `json:"sources"`
	}
	if err := json.Unmarshal(out, &doc); err != nil {
		t.Fatalf("re-unmarshal export: %v", err)
	}

	if len(doc.Sources) != 1 || len(doc.Sources[0].Tables) != 1 ||
		len(doc.Sources[0].Tables[0].ObjectRelationships) != 1 {
		t.Fatalf("unexpected export shape: %s", out)
	}

	using := doc.Sources[0].Tables[0].ObjectRelationships[0].Using

	if got, ok := using["foreign_key_constraint_on"]; !ok ||
		strings.TrimSpace(string(got)) != `"author_id"` {
		t.Errorf("foreign_key_constraint_on = %q (present=%v); want \"author_id\"",
			using["foreign_key_constraint_on"], ok)
	}

	if _, ok := using["x_future_key"]; !ok {
		t.Errorf("unknown `using` sibling key x_future_key dropped on export: %s", out)
	}
}

// TestToJSON_Deterministic verifies ToJSON emits byte-identical output for the
// same input across repeated marshals. json/v2 emits Go-map keys in randomized
// iteration order unless json.Deterministic is set, so without it ToJSON is
// byte-unstable in two places exercised here: the top-level marshal (the
// type_names.mapping below) and RelationshipUsing.MarshalJSON's own map (the
// `using` block's unknown siblings alongside foreign_key_constraint_on). This
// guards the byte-stability the file-source export_metadata snapshot relies on;
// without the fix it is flaky, with it the bytes are stable.
func TestToJSON_Deterministic(t *testing.T) {
	t.Parallel()

	blob := []byte(`{
		"version": 3,
		"sources": [
			{
				"name": "default",
				"kind": "postgres",
				"configuration": {"connection_info": {"database_url": "postgres://x"}},
				"customization": {
					"root_fields": {},
					"type_names": {"mapping": {"users": "U", "posts": "P", "comments": "C"}}
				},
				"tables": [
					{
						"table": {"name": "posts", "schema": "public"},
						"object_relationships": [
							{"name": "author", "using": {
								"foreign_key_constraint_on": "author_id",
								"x_future_z": 1,
								"x_future_a": 2,
								"x_future_m": 3
							}}
						]
					}
				]
			}
		]
	}`)

	parsed, err := hasura.FromJSON(blob)
	if err != nil {
		t.Fatalf("FromJSON: %v", err)
	}

	first, err := hasura.ToJSON(parsed)
	if err != nil {
		t.Fatalf("ToJSON: %v", err)
	}

	const iterations = 20
	for i := range iterations {
		got, err := hasura.ToJSON(parsed)
		if err != nil {
			t.Fatalf("ToJSON iteration %d: %v", i, err)
		}

		if string(got) != string(first) {
			t.Fatalf(
				"ToJSON output not byte-stable at iteration %d:\nfirst: %s\ngot:   %s",
				i, first, got,
			)
		}
	}
}

// Compile-time assurance the public signature stays inverse:
// FromJSON: []byte -> *Metadata, ToJSON: *Metadata -> []byte.
var (
	_ func([]byte) (*hasura.Metadata, error) = hasura.FromJSON
	_ func(*hasura.Metadata) ([]byte, error) = hasura.ToJSON
)
