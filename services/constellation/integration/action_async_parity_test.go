package integration_test

import (
	"fmt"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
)

// Async action EXECUTION parity. Mirrors graphql-engine's TestActionsAsync.
//
// For each case it applies the same set_custom_types + create_action
// (kind:asynchronous) to BOTH the parity Hasura and Constellation (:8001),
// ENQUEUES the action on each (the mutation returns a per-engine action UUID),
// polls each engine's
//
//	query($id: uuid!){ <action>(id: $id){ output {...} errors } }
//
// to completion, and compares the RESOLVED output/errors. The action UUIDs
// differ per engine and are deliberately NOT compared.
//
// This requires the parity Constellation to actually RUN the async worker;
// `make parity-env-up` starts :8001 with the worker enabled + exclusive
// ownership of its isolated `cstl` action-log store. Hasura processes async
// actions natively. The webhook is the deterministic /actions fixture:
// reflect* echoes input.payload as the output; fail*/error* returns a Hasura
// action error body, which surfaces in the async log's `errors`.
//
// Semantic-equivalence bar (same as the sync action parity harness):
//   - both resolve to output  => normalized output must be deep-equal;
//   - both resolve to errors   => pass (Hasura/Constellation error wording may
//     differ; both populating `errors` is the parity that matters);
//   - one output, one errors   => fail.
//
// Run with:
//
//	make dev-env-integration-up && make build-docker-image && make parity-env-up
//	cd integration && go test -run TestActionAsyncExecutionParity -v ./...
//	make parity-env-down

// asyncParityCase is one async action + payload applied to and compared across
// both engines.
type asyncParityCase struct {
	name string
	// field is the action name / GraphQL root field. Its prefix selects the
	// webhook behaviour (reflect* => output, fail*/error* => error body).
	field string
	// objects is the object-type defs for set_custom_types (JSONValue scalar is
	// always added).
	objects string
	// outputType is the action's output_type (e.g. "ReflectOut", "[ReflectOut]!").
	outputType string
	// payload is the JSON value the webhook receives as input.payload.
	payload any
	// selection is the GraphQL sub-selection for `output` ("" for a scalar
	// output type).
	selection string
}

func (tc asyncParityCase) customTypesArgs() string {
	return `{"scalars":[{"name":"JSONValue"}],"enums":[],"input_objects":[],"objects":[` +
		tc.objects + `]}`
}

func (tc asyncParityCase) createActionArgs() string {
	return fmt.Sprintf(
		`{"name":%q,"definition":{"kind":"asynchronous","type":"mutation",`+
			`"handler":%q,"output_type":%q,`+
			`"arguments":[{"name":"payload","type":"JSONValue"}],`+
			webhookSecretHeaderJSON+`}}`,
		tc.field, actionWebhookURL, tc.outputType,
	)
}

// enqueueOp is the async mutation; its data is the action UUID (a scalar).
func (tc asyncParityCase) enqueueOp() query {
	q := fmt.Sprintf(`mutation($p: JSONValue){ %s(payload: $p) }`, tc.field)

	return query{Query: q, Variables: map[string]any{"p": tc.payload}}
}

// pollOp queries the async action result by id, selecting output + errors.
func (tc asyncParityCase) pollOp(id string) query {
	q := fmt.Sprintf(
		`query($id: uuid!){ %s(id: $id){ output %s errors } }`,
		tc.field, tc.selection,
	)

	return query{Query: q, Variables: map[string]any{"id": id}}
}

func TestActionAsyncExecutionParity(t *testing.T) { //nolint:paralleltest
	if !parityEnvReady() {
		t.Skipf("DB-source Constellation not reachable at %s; run `make parity-env-up`", constellationMetadataURL)
	}

	if !hasuraReady() {
		t.Skipf("parity Hasura not reachable at %s", hasuraMetadataURL)
	}

	const reflectOut = `{"name":"ReflectOut","fields":[{"name":"id","type":"String!"}]}`

	engines := []string{hasuraMetadataURL, constellationMetadataURL}

	hOrig := exportMetadataObject(t, hasuraMetadataURL)
	cOrig := exportMetadataObject(t, constellationMetadataURL)

	t.Cleanup(func() {
		restoreFullMetadata(t, hasuraMetadataURL, hOrig)
		restoreFullMetadata(t, constellationMetadataURL, cOrig)
	})

	resetMetadata(t, hasuraMetadataURL, withoutRemoteSchemas(t, hOrig))
	resetMetadata(t, constellationMetadataURL, withoutRemoteSchemas(t, cOrig))

	cases := []asyncParityCase{
		{
			name: "object_success", field: "reflectAsyncObj",
			objects: reflectOut, outputType: "ReflectOut",
			payload: map[string]any{"id": "async-1"}, selection: "{ id }",
		},
		{
			name: "array_success", field: "reflectAsyncArr",
			objects: reflectOut, outputType: "[ReflectOut]",
			payload:   []any{map[string]any{"id": "a"}, map[string]any{"id": "b"}},
			selection: "{ id }",
		},
		{
			name: "nullable_field_omitted", field: "reflectAsyncNullable",
			objects:    `{"name":"ReflectOut","fields":[{"name":"id","type":"String!"},{"name":"opt","type":"String"}]}`,
			outputType: "ReflectOut",
			payload:    map[string]any{"id": "only-id"}, selection: "{ id opt }",
		},
		{
			// fail* webhook => the async log resolves to errors on both engines.
			name: "webhook_error", field: "failAsyncObj",
			objects: reflectOut, outputType: "ReflectOut",
			payload: map[string]any{"message": "boom", "status": 400}, selection: "{ id }",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) { //nolint:paralleltest // shared metadata churn
			for _, url := range engines {
				mustOK(t, url, `{"type":"set_custom_types","args":`+tc.customTypesArgs()+`}`)
				mustOK(t, url, `{"type":"create_action","args":`+tc.createActionArgs()+`}`)
			}

			t.Cleanup(func() {
				for _, url := range engines {
					postMetadata(t, url, fmt.Sprintf(`{"type":"drop_action","args":{"name":%q}}`, tc.field))
				}
			})

			// Enqueue on each engine once the field is routable, then poll the
			// returned per-engine UUID to completion.
			hOut, hErrs := enqueueAndResolveAsync(t, hasuraURL, tc)
			cOut, cErrs := enqueueAndResolveAsync(t, constellationParityGraphQLURL, tc)

			compareAsyncParity(t, tc.name, hOut, hErrs, cOut, cErrs)
		})
	}
}

// enqueueAndResolveAsync enqueues the async action against url (retrying until
// the field is routable to absorb Constellation's async schema rebuild),
// extracts the per-engine action UUID, then polls the result by id until it
// resolves to output or errors. Returns the resolved (output, errors).
func enqueueAndResolveAsync(t *testing.T, url string, tc asyncParityCase) (any, any) {
	t.Helper()

	enqueued := execUntilRouted(t, url, tc.enqueueOp())

	id, ok := asyncActionID(enqueued, tc.field)
	if !ok {
		t.Fatalf("%s: no action id in enqueue response from %s: %v", tc.name, url, enqueued)
	}

	deadline := time.Now().Add(30 * time.Second)
	for time.Now().Before(deadline) {
		resp, err := makeHTTPQuery(t.Context(), url, tc.pollOp(id), adminHeaders())
		if err == nil {
			if out, errs, done := asyncResult(resp, tc.field); done {
				return out, errs
			}
		}

		time.Sleep(500 * time.Millisecond)
	}

	t.Fatalf("%s: async action %s never resolved at %s", tc.name, id, url)

	return nil, nil
}

// asyncActionID extracts data.<field> (the action UUID scalar) from an enqueue
// response.
func asyncActionID(resp any, field string) (string, bool) {
	m, ok := resp.(map[string]any)
	if !ok {
		return "", false
	}

	data, ok := m["data"].(map[string]any)
	if !ok {
		return "", false
	}

	id, ok := data[field].(string)
	if !ok || id == "" {
		return "", false
	}

	return id, true
}

// asyncResult extracts (output, errors) from a poll response and reports
// whether the action has reached a terminal state (output or errors present).
func asyncResult(resp any, field string) (any, any, bool) {
	m, ok := resp.(map[string]any)
	if !ok {
		return nil, nil, false
	}

	data, ok := m["data"].(map[string]any)
	if !ok {
		return nil, nil, false
	}

	result, ok := data[field].(map[string]any)
	if !ok || result == nil {
		return nil, nil, false
	}

	output, errs := result["output"], result["errors"]

	return output, errs, output != nil || errs != nil
}

// compareAsyncParity asserts the resolved async outcomes are semantically
// equivalent: same output/error classification, and deep-equal output on
// success. Error wording may differ; both populating `errors` is the parity.
func compareAsyncParity(t *testing.T, name string, hOut, hErrs, cOut, cErrs any) {
	t.Helper()

	hErr, cErr := hErrs != nil, cErrs != nil
	if hErr != cErr {
		t.Errorf(
			"%s: outcome differs (hasura error=%v, constellation error=%v)\n"+
				"  hasura:        output=%v errors=%v\n  constellation: output=%v errors=%v",
			name, hErr, cErr, hOut, hErrs, cOut, cErrs,
		)

		return
	}

	if hErr {
		return // both resolved to errors: semantic equivalence reached
	}

	if diff := cmp.Diff(hOut, cOut); diff != "" {
		t.Errorf("%s: async output differs (-hasura +constellation):\n%s", name, diff)
	}
}
