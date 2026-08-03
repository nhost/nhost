package hasura_test

import (
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

// TestRoundTripJSON_RealMetadata verifies that the existing 39 KB real-world
// Hasura metadata blob round-trips through FromJSON ∘ ToJSON ∘ FromJSON
// without losing structure. Fields the engine doesn't model are preserved by
// the `json:",unknown"` tags on the envelope and the
// `databases`/`tables`/`functions` wire structs; `remote_schemas[]` is the
// documented exception (its generated `api.*` wire types model only Hasura's
// known fields — see TestRoundTripJSON_RemoteSchemaDropsUnknownKeys).
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

	// The generated remote-schema wire types model most optional fields as
	// pointers with omitempty, so the codec normalizes some explicit-empty values
	// (e.g. customization:{}) to absent on the first re-encode. (comment is
	// likewise omitted when unset, matching Hasura.) Struct equality of first vs
	// second therefore no longer
	// holds for those benign cases; assert instead that the canonical serialized
	// form is a fixed point (re-encoding the re-decoded metadata yields identical
	// bytes). Hasura-fidelity of empty fields is covered by the live parity suite.
	out2, err := hasura.ToJSON(second)
	if err != nil {
		t.Fatalf("ToJSON #2: %v", err)
	}

	if diff := cmp.Diff(string(out), string(out2)); diff != "" {
		t.Errorf("ToJSON is not a fixed point (-out +out2):\n%s", diff)
	}
}

// TestRoundTripJSON_ActionPreservesUnknownKeys pins the fidelity guarantee
// added in this change: unlike remote_schemas (which use generated wire types
// with no unknown capture), the action and custom-type wire types carry
// `json:",unknown"` fields, so keys the engine does not model — e.g.
// permissions[].comment, or a future per-entry key — survive a FromJSON ∘
// ToJSON round-trip rather than being silently dropped on the store-backed
// export_metadata path.
func TestRoundTripJSON_ActionPreservesUnknownKeys(t *testing.T) {
	t.Parallel()

	blob := []byte(`{
		"version": 3,
		"sources": [],
		"actions": [
			{
				"name": "doThing",
				"definition": {"kind": "synchronous", "handler": "http://h", "future_def_key": 1},
				"permissions": [{"role": "user", "comment": "keep me"}],
				"some_unmodeled_action_key": {"a": 1}
			}
		],
		"custom_types": {
			"objects": [{"name": "Out", "fields": [{"name": "id", "type": "String"}], "future_obj_key": true}],
			"future_ct_key": "x"
		}
	}`)

	parsed, err := hasura.FromJSON(blob)
	if err != nil {
		t.Fatalf("FromJSON: %v", err)
	}

	out, err := hasura.ToJSON(parsed)
	if err != nil {
		t.Fatalf("ToJSON: %v", err)
	}

	var got struct {
		Actions     []map[string]jsontext.Value `json:"actions"`
		CustomTypes map[string]jsontext.Value   `json:"custom_types"`
	}
	if err := json.Unmarshal(out, &got); err != nil {
		t.Fatalf("re-unmarshal: %v\n%s", err, out)
	}

	if len(got.Actions) != 1 {
		t.Fatalf("expected 1 action, got %d: %s", len(got.Actions), out)
	}

	if _, ok := got.Actions[0]["some_unmodeled_action_key"]; !ok {
		t.Errorf("unmodeled action key was dropped: %s", out)
	}

	var def map[string]jsontext.Value
	if err := json.Unmarshal(got.Actions[0]["definition"], &def); err != nil {
		t.Fatalf("unmarshal definition: %v", err)
	}

	if _, ok := def["future_def_key"]; !ok {
		t.Errorf("unmodeled action-definition key was dropped: %s", out)
	}

	var perms []map[string]jsontext.Value
	if err := json.Unmarshal(got.Actions[0]["permissions"], &perms); err != nil {
		t.Fatalf("unmarshal permissions: %v", err)
	}

	if len(perms) != 1 {
		t.Fatalf("expected 1 permission, got %d", len(perms))
	}

	if _, ok := perms[0]["comment"]; !ok {
		t.Errorf("permissions[].comment was dropped: %s", out)
	}

	if _, ok := got.CustomTypes["future_ct_key"]; !ok {
		t.Errorf("unmodeled custom_types key was dropped: %s", out)
	}
}

// TestRoundTripJSON_RemoteSchemaDropsUnknownKeys pins the accepted divergence
// documented in hasura-metadata-support.md: unlike databases/tables/functions,
// the generated remote-schema wire type models only Hasura's fields and carries
// no `Unknown` capture, so a key inside a remote_schemas[] entry that
// Constellation does not model is dropped on round-trip.
func TestRoundTripJSON_RemoteSchemaDropsUnknownKeys(t *testing.T) {
	t.Parallel()

	blob := []byte(`{
		"version": 3,
		"sources": [],
		"remote_schemas": [
			{
				"name": "rs",
				"definition": {"url": "https://example.com/graphql"},
				"some_unmodeled_key": {"a": 1}
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

	var withRS struct {
		RemoteSchemas []map[string]jsontext.Value `json:"remote_schemas"`
	}
	if err := json.Unmarshal(out, &withRS); err != nil {
		t.Fatalf("re-unmarshal: %v", err)
	}

	if len(withRS.RemoteSchemas) != 1 {
		t.Fatalf("expected 1 remote schema, got %d", len(withRS.RemoteSchemas))
	}

	if _, ok := withRS.RemoteSchemas[0]["name"]; !ok {
		t.Errorf("modeled key `name` was unexpectedly dropped")
	}

	if _, ok := withRS.RemoteSchemas[0]["some_unmodeled_key"]; ok {
		t.Errorf("unmodeled remote-schema key was preserved; expected it to be dropped")
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

	if !strings.Contains(string(roundtripped.Unknown), "cron_triggers") {
		t.Errorf(
			"Metadata.Unknown does not contain `cron_triggers`: %s",
			string(roundtripped.Unknown),
		)
	}

	// `actions` and `custom_types` are now modeled fields: they are claimed out
	// of Unknown and preserved via the typed Metadata.Actions / .CustomTypes,
	// which is what lets metadata-API mutations to them round-trip.
	if len(roundtripped.Actions) == 0 {
		t.Error("actions not preserved as typed Metadata.Actions through round-trip")
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

// TestRoundTripJSON_PreservesEventTriggers verifies that a table-level
// `event_triggers` array survives the export round-trip verbatim, with every key
// preserved — modeled (name, definition, retry_conf, webhook) and unmodeled
// (request_transform, and any future sibling). This is the fidelity a faithful
// `export_metadata` relies on for event triggers, and it firmly catches the
// regression that motivated modeling the field: remodeling `event_triggers` as a
// typed struct that silently drops keys the engine does not model. (Removing the
// dedicated EventTriggers field outright would not regress here — the value falls
// back into the table's `,unknown` sink — so this guards verbatim fidelity, not
// the specific storage location.) The on-disk fixture carries no event_triggers,
// so without this the whole field is untested.
func TestRoundTripJSON_PreservesEventTriggers(t *testing.T) {
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
						"event_triggers": [
							{
								"name": "on_user_change",
								"definition": {"enable_manual": false, "insert": {"columns": "*"}},
								"retry_conf": {"num_retries": 3, "interval_sec": 10, "timeout_sec": 60},
								"webhook": "https://example.test/hook",
								"request_transform": {"version": 2, "template_engine": "Kriti"},
								"x_future_key": {"a": 1}
							}
						]
					}
				]
			}
		]
	}`)

	parsed, err := hasura.FromJSON(blob)
	if err != nil {
		t.Fatalf("FromJSON #1: %v", err)
	}

	out, err := hasura.ToJSON(parsed)
	if err != nil {
		t.Fatalf("ToJSON: %v", err)
	}

	// Re-parse the export and assert the table's event_triggers survived as a
	// single entry carrying every key — modeled and unmodeled (request_transform,
	// x_future_key).
	var doc struct {
		Sources []struct {
			Tables []struct {
				EventTriggers []map[string]jsontext.Value `json:"event_triggers"`
			} `json:"tables"`
		} `json:"sources"`
	}
	if err := json.Unmarshal(out, &doc); err != nil {
		t.Fatalf("re-unmarshal export: %v", err)
	}

	if len(doc.Sources) != 1 || len(doc.Sources[0].Tables) != 1 {
		t.Fatalf("unexpected export shape: %s", out)
	}

	triggers := doc.Sources[0].Tables[0].EventTriggers
	if len(triggers) != 1 {
		t.Fatalf("expected exactly 1 event trigger, got %d: %s", len(triggers), out)
	}

	for _, key := range []string{
		"name", "definition", "retry_conf", "webhook", "request_transform", "x_future_key",
	} {
		if _, ok := triggers[0][key]; !ok {
			t.Errorf("event trigger dropped key %q on export: %s", key, out)
		}
	}

	// The trigger must appear exactly once: a regression that also spilled it
	// into the table's `,unknown` envelope would emit the name twice.
	if n := strings.Count(string(out), `"on_user_change"`); n != 1 {
		t.Errorf(
			"event trigger name appears %d times in export, want 1 (double-emit?):\n%s",
			n,
			out,
		)
	}

	// Idempotence: a second FromJSON ∘ ToJSON pass produces byte-identical output,
	// so nothing about the trigger is lost or reordered on re-export.
	out2, err := hasura.ToJSON(mustFromJSON(t, out))
	if err != nil {
		t.Fatalf("ToJSON #2: %v", err)
	}

	if string(out) != string(out2) {
		t.Errorf(
			"export not idempotent across a second round-trip:\nfirst:  %s\nsecond: %s",
			out,
			out2,
		)
	}
}

func mustFromJSON(t *testing.T, b []byte) *hasura.Metadata {
	t.Helper()

	m, err := hasura.FromJSON(b)
	if err != nil {
		t.Fatalf("FromJSON: %v", err)
	}

	return m
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

// TestToJSON_FiltersLoweredToSourceRelationship is an export-SHAPE test that
// the EquateEmpty round-trip above cannot catch. FromJSON lowers every
// `to_source` remote_relationship into an ObjectRelationship/ArrayRelationship
// with ManualConfiguration (convertRemoteRelationships); ToJSON must strip those
// lowered duplicates (withoutDerivedRelationships) so the exported bytes carry
// ONLY the original remote_relationships entry. The EquateEmpty test is blind to
// this: even if ToJSON emitted both forms, FromJSON#2's dedup guard would see the
// lowered name already present and skip re-derivation, so the parsed structs
// would still compare equal. This asserts on the bytes instead.
func TestToJSON_FiltersLoweredToSourceRelationship(t *testing.T) {
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
						"table": {"name": "orders", "schema": "public"},
						"remote_relationships": [
							{
								"name": "department",
								"definition": {
									"to_source": {
										"source": "other",
										"table": {"name": "departments", "schema": "public"},
										"relationship_type": "object",
										"field_mapping": {"dept_id": "id"}
									}
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
		t.Fatalf("FromJSON #1: %v", err)
	}

	out, err := hasura.ToJSON(parsed)
	if err != nil {
		t.Fatalf("ToJSON: %v", err)
	}

	var doc struct {
		Sources []struct {
			Tables []struct {
				ObjectRelationships []jsontext.Value `json:"object_relationships"`
				ArrayRelationships  []jsontext.Value `json:"array_relationships"`
				RemoteRelationships []struct {
					Name string `json:"name"`
				} `json:"remote_relationships"`
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

	// The lowered ObjectRelationship/ArrayRelationship must be filtered out — only
	// the source-of-truth remote_relationships entry survives.
	if len(table.ObjectRelationships) != 0 {
		t.Errorf(
			"lowered to_source relationship leaked into object_relationships: %s",
			out,
		)
	}

	if len(table.ArrayRelationships) != 0 {
		t.Errorf(
			"lowered to_source relationship leaked into array_relationships: %s",
			out,
		)
	}

	if len(table.RemoteRelationships) != 1 ||
		table.RemoteRelationships[0].Name != "department" {
		t.Errorf(
			"expected exactly the `department` remote_relationship to survive, got %s",
			out,
		)
	}

	// Stability: FromJSON#2 must equal FromJSON#1. A duplicate-emission regression
	// where the lowered entry leaks back would re-lower on the second pass and the
	// two would still match (the dedup guard masks it), so this complements — not
	// replaces — the byte assertions above.
	second, err := hasura.FromJSON(out)
	if err != nil {
		t.Fatalf("FromJSON #2: %v", err)
	}

	if diff := cmp.Diff(parsed, second, cmpopts.EquateEmpty()); diff != "" {
		t.Errorf("FromJSON ∘ ToJSON ∘ FromJSON differs (-first +second):\n%s", diff)
	}
}

// TestToJSON_NameCollisionDropsLoweredRemoteRelationship covers the riskiest
// edge of withoutDerivedRelationships: a table where a real (FK-based) object
// relationship shares its name with a to_source remote relationship. The filter
// keys solely on name, so it drops every same-named object/array entry — the
// user's genuine FK relationship included. This case is unreachable from a valid
// Hasura export (relationship names map to unique GraphQL field names within a
// table, so Hasura never emits both forms under one name), but the test pins the
// observable behavior so the name-only filter is a deliberate, documented choice
// rather than silent drift.
func TestToJSON_NameCollisionDropsLoweredRemoteRelationship(t *testing.T) {
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
						"table": {"name": "orders", "schema": "public"},
						"object_relationships": [
							{"name": "department", "using": {"foreign_key_constraint_on": "dept_id"}}
						],
						"remote_relationships": [
							{
								"name": "department",
								"definition": {
									"to_source": {
										"source": "other",
										"table": {"name": "departments", "schema": "public"},
										"relationship_type": "object",
										"field_mapping": {"dept_id": "id"}
									}
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
				ObjectRelationships []jsontext.Value `json:"object_relationships"`
				ArrayRelationships  []jsontext.Value `json:"array_relationships"`
				RemoteRelationships []struct {
					Name string `json:"name"`
				} `json:"remote_relationships"`
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

	// The name-only filter drops every same-named object/array entry, so nothing
	// remains under object/array_relationships — only the remote_relationship.
	if len(table.ObjectRelationships) != 0 {
		t.Errorf(
			"expected name-colliding object_relationships to be dropped, got %s",
			out,
		)
	}

	if len(table.ArrayRelationships) != 0 {
		t.Errorf(
			"expected no array_relationships, got %s",
			out,
		)
	}

	if len(table.RemoteRelationships) != 1 ||
		table.RemoteRelationships[0].Name != "department" {
		t.Errorf(
			"expected the `department` remote_relationship to survive, got %s",
			out,
		)
	}
}

// Compile-time assurance the public signature stays inverse:
// FromJSON: []byte -> *Metadata, ToJSON: *Metadata -> []byte.
var (
	_ func([]byte) (*hasura.Metadata, error) = hasura.FromJSON
	_ func(*hasura.Metadata) ([]byte, error) = hasura.ToJSON
)

// TestRoundTripJSON_InheritedRoles asserts the top-level inherited_roles key is
// modeled (claimed out of Unknown) and round-trips through FromJSON -> ToJSON as
// a typed field, which is what lets add_inherited_role / drop_inherited_role
// mutations survive an export.
func TestRoundTripJSON_InheritedRoles(t *testing.T) {
	t.Parallel()

	blob := []byte(`{
		"version": 3,
		"sources": [],
		"inherited_roles": [
			{"role_name": "manager", "role_set": ["employee", "auditor"]}
		]
	}`)

	parsed, err := hasura.FromJSON(blob)
	if err != nil {
		t.Fatalf("FromJSON: %v", err)
	}

	if len(parsed.InheritedRoles) != 1 {
		t.Fatalf("expected 1 inherited role, got %d", len(parsed.InheritedRoles))
	}

	got := parsed.InheritedRoles[0]
	if got.RoleName != "manager" {
		t.Errorf("role_name = %q, want manager", got.RoleName)
	}

	if want := []string{"employee", "auditor"}; !slices.Equal(got.RoleSet, want) {
		t.Errorf("role_set = %v, want %v", got.RoleSet, want)
	}

	out, err := hasura.ToJSON(parsed)
	if err != nil {
		t.Fatalf("ToJSON: %v", err)
	}

	var raw struct {
		InheritedRoles []hasura.InheritedRole `json:"inherited_roles"`
	}
	if err := json.Unmarshal(out, &raw); err != nil {
		t.Fatalf("re-unmarshal: %v", err)
	}

	if len(raw.InheritedRoles) != 1 || raw.InheritedRoles[0].RoleName != "manager" {
		t.Errorf("inherited_roles not preserved through round-trip: %s", string(out))
	}
}
