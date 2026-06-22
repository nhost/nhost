package integration_test

import (
	"net/http"
	"strings"
	"testing"
)

// This file exercises the Hasura Action metadata-API lifecycle end-to-end
// against a DB-backed (mutable-metadata) Constellation: the parity instance on
// :8001 started by `make parity-env-up`, which owns the isolated `cstl`
// hdb_catalog.hdb_metadata store. Unlike metadata_parity_test.go it does NOT
// compare against Hasura (Hasura's action surface is not mirrored here); it
// asserts Constellation's own behaviour: a created mutation action reaches the
// served GraphQL schema and routes to the action connector, update/create are
// accepted, and a drop removes the field again.
//
// Presence is probed by EXECUTING the mutation rather than by introspection:
// the parity instance tracks no tables in `cstl`, so it has no query root and
// introspection (itself a query) is rejected with "Schema does not support
// operation type query". Executing the mutation needs only the mutation root,
// directly exercises resolve -> action-connector routing, and a post-drop
// validation error cleanly proves removal.
//
// Run with:
//
//	make dev-env-integration-up && make build-docker-image && make parity-env-up
//	cd integration && go test -run TestActionMetadataLifecycle -v ./...
//	make parity-env-down
//
// It skips cleanly (does not fail) when the DB-source instance is not deployed.

const (
	// actionWebhookURL is the integration /actions webhook (functions container,
	// served by integration/functions/actions.ts). It is reachable from
	// Constellation on the docker network, not from the test host.
	actionWebhookURL = "http://integration-functions-1:3000/actions"
	// webhookSecretHeaderJSON is injected into every created action so the
	// webhook's secret guard passes; it also exercises header injection +
	// value_from_env resolution end-to-end.
	webhookSecretHeaderJSON = `"headers":[{"name":"x-nhost-webhook-secret","value_from_env":"NHOST_WEBHOOK_SECRET"}]`

	echoActionCustomTypes = `{"type":"set_custom_types","args":{"objects":[` +
		`{"name":"EchoActionOutput","fields":[{"name":"message","type":"String!"}]}]}}`

	echoActionCreate = `{"type":"create_action","args":{"name":"echoAction","definition":{` +
		`"kind":"synchronous","type":"mutation",` +
		`"handler":"http://integration-functions-1:3000/echo",` +
		`"output_type":"EchoActionOutput",` +
		`"arguments":[{"name":"message","type":"String!"}]}}}`

	// A synchronous update (changed handler + timeout) so the GraphQL field
	// shape is unchanged and the execution probe stays valid. (Flipping to
	// asynchronous would re-type the field to a UUID scalar with no selection
	// set, which is a separate concern from update_action acceptance.)
	echoActionUpdate = `{"type":"update_action","args":{"name":"echoAction","definition":{` +
		`"kind":"synchronous","type":"mutation",` +
		`"handler":"http://integration-functions-1:3000/echo-v2","timeout":42,` +
		`"output_type":"EchoActionOutput",` +
		`"arguments":[{"name":"message","type":"String!"}]}}}`
)

func TestActionMetadataLifecycle(t *testing.T) {
	setupActionEnv(t)

	// Define a custom output type and a synchronous mutation action.
	mustMetadataOK(t, echoActionCustomTypes)
	mustMetadataOK(t, echoActionCreate)

	// create_action is idempotent: re-creating the same action is a 2xx no-op.
	if status, body := postMetadata(t, constellationMetadataURL, echoActionCreate); status/100 != 2 {
		t.Fatalf("repeat create_action: status=%d body=%s", status, body)
	}

	// The action's field reaches the served schema and routes to the action
	// connector (the schema rebuild after a metadata write is asynchronous).
	requireActionRoutable(t, true)

	// update_action replaces the definition (sync -> async) and stays 2xx; the
	// field remains routable.
	mustMetadataOK(t, echoActionUpdate)
	requireActionRoutable(t, true)

	// drop_action removes the field from the served schema.
	mustMetadataOK(t, `{"type":"drop_action","args":{"name":"echoAction"}}`)
	requireActionRoutable(t, false)
}

// setupActionEnv skips cleanly when the DB-source instance is not deployed, then
// captures its metadata and registers a restore so each action test leaves no
// trace on the shared parity engine, even on failure.
func setupActionEnv(t *testing.T) {
	t.Helper()

	if !parityEnvReady() {
		t.Skipf(
			"DB-source Constellation not reachable at %s; run `make parity-env-up` "+
				"(after dev-env-integration-up + build-docker-image)",
			constellationMetadataURL,
		)
	}

	baseline := exportMetadataObject(t, constellationMetadataURL)
	t.Cleanup(func() { resetMetadata(t, constellationMetadataURL, baseline) })
}

func mustMetadataOK(t *testing.T, body string) {
	t.Helper()

	if status, resp := postMetadata(t, constellationMetadataURL, body); status/100 != 2 {
		t.Fatalf("metadata op failed: status=%d body=%s\nreq=%s", status, resp, body)
	}
}

func adminHeaders() http.Header {
	h := http.Header{}
	h.Set("x-hasura-admin-secret", adminSecret)

	return h
}

// requireActionRoutable polls execution of the echoAction mutation until it is
// routable (want=true: present in the schema and dispatched to the action
// connector — an execution-level webhook error is expected and fine) or no
// longer routable (want=false: a GraphQL validation error, i.e. the field was
// dropped). Polling absorbs the asynchronous schema rebuild.
func requireActionRoutable(t *testing.T, want bool) {
	t.Helper()

	q := query{Query: `mutation { echoAction(message: "ping") { message } }`}

	if _, ok := pollGraphQL(t, q, adminHeaders(), func(resp any) bool {
		return actionRoutable(resp) == want
	}); !ok {
		t.Fatalf("echoAction routable=%v not reached within poll deadline", want)
	}
}

// actionRoutable reports whether the response indicates the echoAction field is
// in the served mutation schema and was routed to a connector. A validation /
// unsupported-operation error means the field is absent; any other outcome
// (success, or an execution/webhook error) means it routed.
//
// On this bare parity instance echoAction is the only schema element, so
// dropping it empties the role schema entirely and Constellation answers
// "no schema available for role" rather than a per-field validation error;
// that too means the action is no longer served.
func actionRoutable(resp any) bool {
	for _, msg := range graphQLErrorMessages(resp) {
		lower := strings.ToLower(msg)
		if strings.Contains(lower, "cannot query field") ||
			strings.Contains(lower, "not defined") ||
			strings.Contains(lower, "unknown field") ||
			strings.Contains(lower, "does not support operation type") ||
			strings.Contains(lower, "no schema available") {
			return false
		}
	}

	return true
}

func graphQLErrorMessages(resp any) []string {
	m, ok := resp.(map[string]any)
	if !ok {
		return nil
	}

	errs, ok := m["errors"].([]any)
	if !ok {
		return nil
	}

	out := make([]string, 0, len(errs))

	for _, e := range errs {
		if em, ok := e.(map[string]any); ok {
			if msg, ok := em["message"].(string); ok {
				out = append(out, msg)
			}
		}
	}

	return out
}
