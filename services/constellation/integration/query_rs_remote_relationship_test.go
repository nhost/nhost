package integration_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
)

// TestRemoteSchemaToRemoteSchemaStitching is the end-to-end verification that a
// remote-schema → remote-schema (to_remote_schema) relationship actually
// stitches at query time, not just that the metadata round-trips.
//
// It runs against the parity environment (the DB-source Constellation on :8001,
// alongside the shared Hasura), setting up the same remote schema + self-
// referential rs→rs relationship on both via the metadata API, then asserts the
// two engines return byte-identical results for a query that traverses it.
//
// The relationship is self-referential — Team.id → the schema's own team(id:)
// root field — which keeps the fixture to a single remote schema (a second
// remote schema on the same endpoint collides on type/field names) while still
// exercising the full rs→rs execution path: introspect the target, inject the
// phantom join field into the remote parent query, batch the remote lookups,
// and stitch the result back in.
func TestRemoteSchemaToRemoteSchemaStitching(t *testing.T) { //nolint:paralleltest
	if !parityEnvReady() {
		t.Skipf(
			"parity Constellation not reachable at %s; run `make parity-env-up`",
			constellationMetadataURL,
		)
	}

	const rsName = "stitch_rs"

	rsDef := `{"url":"http://integration-functions-1:3000/remote-schema",` +
		`"forward_client_headers":true,"headers":[{"name":"x-nhost-webhook-secret",` +
		`"value_from_env":"NHOST_WEBHOOK_SECRET"}]}`
	addRS := `{"type":"add_remote_schema","args":{"name":"` + rsName + `","definition":` + rsDef + `}}`
	addRel := `{"type":"create_remote_schema_remote_relationship","args":{"remote_schema":"` + rsName +
		`","type_name":"Team","name":"selfRef","definition":{"to_remote_schema":{"remote_schema":"` + rsName +
		`","lhs_fields":["id"],"remote_field":{"team":{"arguments":{"id":"$id"}}}}}}}`
	dropRel := `{"type":"delete_remote_schema_remote_relationship","args":{"remote_schema":"` + rsName +
		`","type_name":"Team","name":"selfRef"}}`
	removeRS := `{"type":"remove_remote_schema","args":{"name":"` + rsName + `"}}`

	engines := []string{hasuraMetadataURL, constellationMetadataURL}

	cleanup := func() {
		for _, url := range engines {
			// Relationship first: remove_remote_schema is blocked by dependents.
			_, _ = postMetadata(t, url, dropRel)
			_, _ = postMetadata(t, url, removeRS)
		}
	}

	cleanup()          // clear any leftovers from an interrupted run
	t.Cleanup(cleanup) // and leave no trace afterwards

	for _, url := range engines {
		if st, body := postMetadata(t, url, addRS); st/100 != 2 {
			t.Fatalf("add_remote_schema on %s: status=%d body=%s", url, st, body)
		}

		if st, body := postMetadata(t, url, addRel); st/100 != 2 {
			t.Fatalf("create remote relationship on %s: status=%d body=%s", url, st, body)
		}
	}

	q := query{
		Query: `query {
			teams {
				id
				name
				selfRef {
					id
					name
				}
			}
		}`,
		Role: "admin",
	}

	headers := http.Header{
		"x-hasura-admin-secret": []string{adminSecret},
		"x-hasura-role":         []string{"admin"},
	}

	hasuraResp, err := makeHTTPQuery(t.Context(), hasuraURL, q, headers)
	if err != nil {
		t.Fatalf("hasura query failed: %v", err)
	}

	if hasErrors(hasuraResp) {
		t.Fatalf("hasura returned errors for the stitched query: %v", hasuraResp)
	}

	// Constellation's connector rebuild after add_remote_schema is asynchronous
	// (driven by the metadata Watch channel), so poll until the stitched query
	// resolves cleanly before comparing.
	constellationResp := pollGraphQL(t, constellationParityGraphQLURL, q, headers)

	if diff := cmp.Diff(hasuraResp, constellationResp); diff != "" {
		t.Errorf("rs→rs stitched query differs (-hasura +constellation):\n%s", diff)
	}
}

// pollGraphQL issues the query until it returns an error-free response or the
// deadline elapses, accommodating Constellation's asynchronous post-mutation
// connector rebuild.
func pollGraphQL(t *testing.T, url string, q query, headers http.Header) any {
	t.Helper()

	deadline := time.Now().Add(30 * time.Second)

	var last any

	for time.Now().Before(deadline) {
		resp, err := makeHTTPQuery(t.Context(), url, q, headers)
		if err == nil && !hasErrors(resp) {
			return resp
		}

		last = resp

		time.Sleep(500 * time.Millisecond)
	}

	t.Fatalf("constellation query did not resolve before deadline; last response: %v", last)

	return nil
}

// hasErrors reports whether a decoded GraphQL response carries a non-empty
// top-level "errors" array.
func hasErrors(resp any) bool {
	m, ok := resp.(map[string]any)
	if !ok {
		return false
	}

	errs, ok := m["errors"].([]any)

	return ok && len(errs) > 0
}
