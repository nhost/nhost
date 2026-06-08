package integration_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/metadata"
)

func TestActionsAsync(t *testing.T) { //nolint:paralleltest
	skipUnlessActionGraphQLEndpoints(t)
	waitForConstellationActionAsyncSchema(t)

	headers := http.Header{
		"x-hasura-admin-secret": []string{adminSecret},
		"x-hasura-role":         []string{"user"},
		"x-hasura-user-id":      []string{"async-action-user-1"},
	}

	mutation := query{
		Query: `mutation AsyncEcho($message: String!) {
			asyncEcho(message: $message)
		}`,
		Variables: map[string]any{"message": "hello async"},
		Role:      "user",
		SessionVariables: map[string]string{
			"user-id": "async-action-user-1",
		},
	}

	hasuraMutation := executeActionEndpoint(t, hasuraURL, mutation, headers)
	constellationMutation := executeActionEndpoint(t, constellationURL, mutation, headers)

	hasuraID := asyncActionID(t, hasuraMutation)
	constellationID := asyncActionID(t, constellationMutation)

	resultQuery := `query AsyncEchoResult($id: uuid!) {
		asyncEcho(id: $id) {
			id
			created_at
			errors
			output { message role }
		}
	}`

	hasuraResult := waitForAsyncActionOutput(t, hasuraURL, resultQuery, hasuraID, headers)
	constellationResult := waitForAsyncActionOutput(
		t,
		constellationURL,
		resultQuery,
		constellationID,
		headers,
	)

	if diff := cmp.Diff(
		normalizeAsyncActionResponse(hasuraResult),
		normalizeAsyncActionResponse(constellationResult),
	); diff != "" {
		t.Fatalf("async action parity gap (-hasura +constellation):\n%s", diff)
	}
}

func waitForConstellationActionAsyncSchema(t *testing.T) {
	t.Helper()

	probe := query{
		Query: `query ActionAsyncSchemaReady {
			mutationRoot: __type(name: "mutation_root") { fields { name } }
			queryRoot: __type(name: "query_root") { fields { name } }
			subscriptionRoot: __type(name: "subscription_root") { fields { name } }
		}`,
		Role: metadata.RoleAdmin,
	}

	deadline := time.Now().Add(10 * time.Second)

	var last any
	for time.Now().Before(deadline) {
		resp, err := makeHTTPQuery(
			t.Context(),
			constellationURL,
			probe,
			http.Header{"x-hasura-admin-secret": []string{adminSecret}},
		)
		if err == nil && responseHasIntrospectionField(resp, "mutationRoot", "asyncEcho") &&
			responseHasIntrospectionField(resp, "queryRoot", "asyncEcho") &&
			responseHasIntrospectionField(resp, "subscriptionRoot", "asyncEcho") {
			return
		}

		last = resp

		time.Sleep(200 * time.Millisecond)
	}

	t.Fatalf("constellation did not expose async action schema: %#v", last)
}

func executeActionEndpoint(
	t *testing.T,
	endpoint string,
	q query,
	headers http.Header,
) any {
	t.Helper()

	resp, err := makeHTTPQuery(t.Context(), endpoint, q, headers)
	if err != nil {
		t.Fatalf("action query against %s failed: %v", endpoint, err)
	}

	if hasGraphQLErrors(resp) {
		t.Fatalf("action query against %s returned errors: %#v", endpoint, resp)
	}

	return resp
}

func asyncActionID(t *testing.T, resp any) string {
	t.Helper()

	m, ok := resp.(map[string]any)
	if !ok {
		t.Fatalf("async mutation response has type %T, want object", resp)
	}

	data, ok := m["data"].(map[string]any)
	if !ok {
		t.Fatalf("async mutation response data has type %T, want object: %#v", m["data"], resp)
	}

	id, ok := data["asyncEcho"].(string)
	if !ok || id == "" {
		t.Fatalf("async action id = %#v, want non-empty string", data["asyncEcho"])
	}

	return id
}

func waitForAsyncActionOutput(
	t *testing.T,
	endpoint string,
	queryText string,
	id string,
	headers http.Header,
) any {
	t.Helper()

	q := query{
		Query:     queryText,
		Variables: map[string]any{"id": id},
		Role:      "user",
		SessionVariables: map[string]string{
			"user-id": "async-action-user-1",
		},
	}

	deadline := time.Now().Add(10 * time.Second)

	var last any
	for time.Now().Before(deadline) {
		resp := executeActionEndpoint(t, endpoint, q, headers)

		payload := asyncActionPayload(t, resp)
		if payload["output"] != nil || payload["errors"] != nil {
			return resp
		}

		last = resp

		time.Sleep(200 * time.Millisecond)
	}

	t.Fatalf("async action %s on %s did not complete: %#v", id, endpoint, last)

	return nil
}

func asyncActionPayload(t *testing.T, resp any) map[string]any {
	t.Helper()

	m, ok := resp.(map[string]any)
	if !ok {
		t.Fatalf("async response has type %T, want object", resp)
	}

	data, ok := m["data"].(map[string]any)
	if !ok {
		t.Fatalf("async response data has type %T, want object: %#v", m["data"], resp)
	}

	payload, ok := data["asyncEcho"].(map[string]any)
	if !ok {
		t.Fatalf("asyncEcho has type %T, want object: %#v", data["asyncEcho"], resp)
	}

	return payload
}

func normalizeAsyncActionResponse(resp any) any {
	out := redactResponseValue(resp, nil, func(path []string, value any) (any, bool) {
		if len(path) == 3 && path[0] == "data" && path[1] == "asyncEcho" {
			switch path[2] {
			case "id":
				return "<async-action-id>", true
			case "created_at":
				return "<async-action-created-at>", true
			}
		}

		return value, false
	})

	return out
}
