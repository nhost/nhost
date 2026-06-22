package integration_test

import (
	"bytes"
	"context"
	"encoding/json/jsontext"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
)

// Action EXECUTION parity harness. For each case it applies the same
// set_custom_types + create_action to BOTH the parity Hasura and Constellation
// (:8001), executes the same GraphQL op against both, and asserts SEMANTIC
// equivalence (the bar chosen for actions):
//
//   - both return data    => the normalized data must be deep-equal;
//   - both return an error => pass (Constellation may use its own wording;
//     Hasura wraps shape errors with code:unexpected / path:$ / extensions.internal
//     and different phrasing, which are accepted divergences at this bar);
//   - one data, one error  => fail, UNLESS the case records a knownDivergence
//     (a real, accepted behavioural difference, kept explicit rather than hidden).
//
// The webhook is the deterministic /actions fixture (reflect* returns the input
// payload verbatim), so on success both engines must return identical data; any
// data difference is a genuine shape divergence.
//
// Isolation: applying an action op while remote schemas are present makes Hasura
// re-validate them (a slow HTTP introspection that can hang), so both engines are
// reset ONCE to a remote-schema-stripped baseline; each case then creates a
// uniquely-named action and drops it afterwards (keeping Hasura metadata churn
// low so the final full restore stays within the request timeout). The full
// originals are restored at the end.
//
// Run with:
//
//	make dev-env-integration-up && make build-docker-image && make parity-env-up
//	cd integration && go test -run TestActionExecutionParity -v ./...
//	make parity-env-down

// actionParityCase is one action + op applied to and compared across both engines.
type actionParityCase struct {
	name string
	// field is the action name / GraphQL root field (used to drop it after).
	field string
	// objects is the object-type defs for set_custom_types (JSONValue scalar is
	// always added). Applied to both engines.
	objects string
	// outputType is the action's output_type (e.g. "ReflectOut", "[ReflectOut]!").
	outputType string
	// payload is the JSON value the reflect webhook echoes back as the response.
	payload any
	// selection is the GraphQL selection set for object/array outputs ("" for none).
	selection string
	// timeoutSecs, when >0, sets the action's timeout (for the slow-webhook case).
	timeoutSecs int
	// knownDivergence, when set, documents an accepted outcome difference: the
	// case passes while the difference persists, and FAILS if it disappears
	// (so a resolved divergence forces removal of the stale allowlist entry).
	knownDivergence string
	// wantErrContains, when set, requires BOTH engines to error AND the first
	// error message to contain this substring. It pins webhook-error parity:
	// the webhook's own message must reach the client verbatim rather than
	// being replaced by Constellation's generic sanitised "internal server
	// error" line. Presence-only checking (hasErrors) does not catch that
	// regression because a sanitised error still produces an errors[] array.
	wantErrContains string
}

func (tc actionParityCase) customTypesArgs() string {
	return `{"scalars":[{"name":"JSONValue"}],"enums":[],"input_objects":[],"objects":[` +
		tc.objects + `]}`
}

func (tc actionParityCase) createActionArgs() string {
	timeout := ""
	if tc.timeoutSecs > 0 {
		timeout = fmt.Sprintf(`"timeout":%d,`, tc.timeoutSecs)
	}

	return fmt.Sprintf(
		`{"name":%q,"definition":{"kind":"synchronous","type":"mutation",`+
			`"handler":%q,"output_type":%q,%s`+
			`"arguments":[{"name":"payload","type":"JSONValue"}],`+
			webhookSecretHeaderJSON+`}}`,
		tc.field, actionWebhookURL, tc.outputType, timeout,
	)
}

func (tc actionParityCase) op() query {
	q := fmt.Sprintf(`mutation($p: JSONValue){ %s(payload: $p) %s }`, tc.field, tc.selection)

	return query{Query: q, Variables: map[string]any{"p": tc.payload}}
}

func hasuraReady() bool {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(
		ctx, http.MethodPost, hasuraMetadataURL,
		// export_metadata is a harmless reachability probe.
		bytes.NewReader([]byte(`{"type":"export_metadata","args":{}}`)),
	)
	if err != nil {
		return false
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hasura-Admin-Secret", adminSecret)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return false
	}

	defer resp.Body.Close()

	return true
}

func runActionExecutionParityTests(t *testing.T, cases []actionParityCase) {
	t.Helper()

	if !parityEnvReady() {
		t.Skipf("DB-source Constellation not reachable at %s; run `make parity-env-up`", constellationMetadataURL)
	}

	if !hasuraReady() {
		t.Skipf("parity Hasura not reachable at %s", hasuraMetadataURL)
	}

	engines := []string{hasuraMetadataURL, constellationMetadataURL}

	hOrig := exportMetadataObject(t, hasuraMetadataURL)
	cOrig := exportMetadataObject(t, constellationMetadataURL)

	// Restore the full originals (with remote schemas) at the end. Re-adding
	// remote schemas makes Hasura re-introspect them, which routinely exceeds the
	// shared 90s metadataRequestTimeout, so use a dedicated longer-timeout restore.
	t.Cleanup(func() {
		restoreFullMetadata(t, hasuraMetadataURL, hOrig)
		restoreFullMetadata(t, constellationMetadataURL, cOrig)
	})

	// Strip remote schemas ONCE so create_action does not trigger a remote-schema
	// re-validation on Hasura (which can hang).
	resetMetadata(t, hasuraMetadataURL, withoutRemoteSchemas(t, hOrig))
	resetMetadata(t, constellationMetadataURL, withoutRemoteSchemas(t, cOrig))

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			for _, url := range engines {
				mustOK(t, url, `{"type":"set_custom_types","args":`+tc.customTypesArgs()+`}`)
				mustOK(t, url, `{"type":"create_action","args":`+tc.createActionArgs()+`}`)
			}

			// Drop the action afterwards so the next case's set_custom_types does
			// not orphan a type still referenced by this action.
			t.Cleanup(func() {
				for _, url := range engines {
					postMetadata(t, url, fmt.Sprintf(`{"type":"drop_action","args":{"name":%q}}`, tc.field))
				}
			})

			hResp := execUntilRouted(t, hasuraURL, tc.op())
			cResp := execUntilRouted(t, constellationParityGraphQLURL, tc.op())

			compareActionParity(t, tc, hResp, cResp)
		})
	}
}

// restoreFullMetadata replaces an engine's metadata with a generous timeout and
// reports via Errorf (not Fatalf) since it runs in cleanup. Re-adding remote
// schemas triggers a slow re-introspection that can exceed 90s.
func restoreFullMetadata(t *testing.T, url string, meta jsontext.Value) {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 240*time.Second)
	defer cancel()

	body := fmt.Sprintf(
		`{"type":"replace_metadata","args":{"allow_inconsistent_metadata":true,"metadata":%s}}`,
		meta,
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader([]byte(body)))
	if err != nil {
		t.Errorf("building restore request for %s: %v", url, err)

		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hasura-Admin-Secret", adminSecret)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Errorf("restoring metadata on %s: %v", url, err)

		return
	}

	defer resp.Body.Close()

	if resp.StatusCode/100 != 2 {
		t.Errorf("restore on %s: status=%d", url, resp.StatusCode)
	}
}

func mustOK(t *testing.T, url, body string) {
	t.Helper()

	if status, resp := postMetadata(t, url, body); status/100 != 2 {
		t.Fatalf("setup on %s failed: status=%d body=%s\nreq=%s", url, status, resp, body)
	}
}

// execUntilRouted executes op against url, polling until the action field is
// served (no longer a field-not-found / unsupported-operation validation error),
// to absorb the asynchronous schema rebuild on Constellation.
func execUntilRouted(t *testing.T, url string, op query) any {
	t.Helper()

	deadline := time.Now().Add(30 * time.Second)

	var last any

	for time.Now().Before(deadline) {
		resp, err := makeHTTPQuery(t.Context(), url, op, adminHeaders())
		if err == nil {
			last = resp
			if actionRoutable(resp) {
				return resp
			}
		}

		time.Sleep(500 * time.Millisecond)
	}

	t.Fatalf("action never became routable at %s; last response: %v", url, last)

	return nil
}

// compareActionParity asserts semantic equivalence: same data/error
// classification and deep-equal data on success, honouring a recorded
// knownDivergence.
func compareActionParity(t *testing.T, tc actionParityCase, hResp, cResp any) {
	t.Helper()

	hErr, cErr := hasErrors(hResp), hasErrors(cResp)
	equivalent := hErr == cErr && (hErr || cmp.Equal(responseData(hResp), responseData(cResp)))

	if tc.knownDivergence != "" {
		if equivalent {
			t.Errorf(
				"%s: known divergence appears RESOLVED (%q) — remove the allowlist entry",
				tc.name, tc.knownDivergence,
			)

			return
		}

		t.Logf("%s: accepted known divergence: %s\n  hasura: %v\n  constellation: %v",
			tc.name, tc.knownDivergence, hResp, cResp)

		return
	}

	if hErr != cErr {
		t.Errorf(
			"%s: outcome differs (hasura error=%v, constellation error=%v)\n  hasura: %v\n  constellation: %v",
			tc.name, hErr, cErr, hResp, cResp,
		)

		return
	}

	if hErr {
		if tc.wantErrContains != "" {
			hMsg, cMsg := firstErrorMessage(hResp), firstErrorMessage(cResp)
			if !strings.Contains(hMsg, tc.wantErrContains) {
				t.Errorf("%s: hasura error message %q does not contain %q",
					tc.name, hMsg, tc.wantErrContains)
			}

			if !strings.Contains(cMsg, tc.wantErrContains) {
				t.Errorf("%s: constellation error message %q does not contain %q "+
					"(webhook error message was sanitised instead of surfaced verbatim)",
					tc.name, cMsg, tc.wantErrContains)
			}
		}

		return // both errored: semantic equivalence reached
	}

	if diff := cmp.Diff(responseData(hResp), responseData(cResp)); diff != "" {
		t.Errorf("%s: success data differs (-hasura +constellation):\n%s", tc.name, diff)
	}
}

// firstErrorMessage returns the message of the first GraphQL error in a parsed
// response, or "" when there is none.
func firstErrorMessage(resp any) string {
	m, ok := resp.(map[string]any)
	if !ok {
		return ""
	}

	errs, ok := m["errors"].([]any)
	if !ok || len(errs) == 0 {
		return ""
	}

	first, ok := errs[0].(map[string]any)
	if !ok {
		return ""
	}

	msg, _ := first["message"].(string)

	return msg
}

func responseData(resp any) any {
	m, ok := resp.(map[string]any)
	if !ok {
		return nil
	}

	return m["data"]
}

//nolint:funlen // a flat table of parity cases reads better whole than split up.
func TestActionExecutionParity(t *testing.T) {
	const (
		reflectOut  = `{"name":"ReflectOut","fields":[{"name":"id","type":"String!"}]}`
		nullableObj = `{"name":"NullableObj","fields":[{"name":"city","type":"String"},{"name":"country","type":"String!"}]}`
		parentChild = `{"name":"Parent","fields":[{"name":"id","type":"String!"},{"name":"child","type":"Child"}]},` +
			`{"name":"Child","fields":[{"name":"id","type":"String!"}]}`
	)

	cases := []actionParityCase{
		{
			name: "object_success", field: "reflectObj",
			objects: reflectOut, outputType: "ReflectOut",
			payload: map[string]any{"id": "abc"}, selection: "{ id }",
		},
		{
			name: "nullable_field_omitted", field: "reflectNullable",
			objects: nullableObj, outputType: "NullableObj",
			payload: map[string]any{"country": "India"}, selection: "{ city country }",
		},
		{
			name: "object_got_null_nonnull_output", field: "reflectObjNN",
			objects: reflectOut, outputType: "ReflectOut!",
			payload: nil, selection: "{ id }",
		},
		{
			name: "object_got_array", field: "reflectObjGotArr",
			objects: reflectOut, outputType: "ReflectOut",
			payload: []any{map[string]any{"id": "x"}}, selection: "{ id }",
		},
		{
			name: "array_got_object", field: "reflectArrGotObj",
			objects: reflectOut, outputType: "[ReflectOut]",
			payload: map[string]any{"id": "x"}, selection: "{ id }",
		},
		{
			name: "array_got_null_nonnull_output", field: "reflectArrNN",
			objects: reflectOut, outputType: "[ReflectOut]!",
			payload: nil, selection: "{ id }",
		},
		{
			name: "array_success", field: "reflectArr",
			objects: reflectOut, outputType: "[ReflectOut]",
			payload:   []any{map[string]any{"id": "a"}, map[string]any{"id": "b"}},
			selection: "{ id }",
		},
		{
			// Scalar output type: reflect echoes a bare scalar; both engines must
			// accept and return it identically. Maps to Hasura
			// test_expecting_scalar_output_type_success.
			name: "scalar_success", field: "reflectScalar",
			objects: "", outputType: "String",
			payload: "hello", selection: "",
		},
		{
			// Scalar output type, object payload: the webhook returns an object
			// where a String scalar is expected; both engines must reject. Maps to
			// test_expecting_scalar_string_output_type_got_object.
			name: "scalar_got_object", field: "reflectScalarGotObj",
			objects: "", outputType: "String",
			payload: map[string]any{"id": "x"}, selection: "",
		},
		{
			// Object output type, scalar payload: the webhook returns a bare string
			// where an object is expected; both engines must reject. Maps to
			// test_expecting_object_output_type_got_scalar_string.
			name: "object_got_scalar", field: "reflectObjGotScalar",
			objects: reflectOut, outputType: "ReflectOut",
			payload: "hello", selection: "{ id }",
		},
		{
			name: "nested_null_ok", field: "reflectNestedOK",
			objects: parentChild, outputType: "Parent",
			payload:   map[string]any{"id": "p", "child": nil},
			selection: "{ id child { id } }",
		},
		{
			// The error* webhook returns a 400 with {message:"action failed"}; both
			// engines must surface that webhook message verbatim. Constellation
			// previously sanitised connector errors into a generic "internal server
			// error (trace id: ...)" line, silently breaking action-error parity;
			// wantErrContains pins the webhook message so that regression fails here.
			name: "webhook_error", field: "errorObj",
			objects: reflectOut, outputType: "ReflectOut",
			payload: nil, selection: "{ id }",
			wantErrContains: "action failed",
		},
		{
			// The slow* webhook sleeps ~5s; a 1s action timeout must abort it on
			// both engines, so both return a timeout error (wording may differ).
			name: "sync_timeout", field: "slowReflect",
			objects: reflectOut, outputType: "ReflectOut",
			payload: nil, selection: "{ id }", timeoutSecs: 1,
		},
		{
			name: "nested_null_violation", field: "reflectNestedBad",
			objects: parentChild, outputType: "Parent",
			payload:   map[string]any{"id": "p", "child": map[string]any{"id": nil}},
			selection: "{ id child { id } }",
			knownDivergence: "Hasura v2.48.10 returns child.id=null in data without error " +
				"(does not enforce non-null on nested action-output object fields); " +
				"Constellation enforces it and errors with null-bubbling. See task #8.",
		},
	}

	runActionExecutionParityTests(t, cases)
}
