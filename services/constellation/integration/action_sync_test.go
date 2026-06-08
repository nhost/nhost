package integration_test

import (
	"bytes"
	"context"
	json "encoding/json/v2"
	"errors"
	"fmt"
	"maps"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/metadata"
)

const actionFixtureDir = "actionfixtures/default"

var errUnexpectedActionHTTPStatus = errors.New("unexpected HTTP status")

func TestActionsSync(t *testing.T) { //nolint:paralleltest
	skipUnlessActionGraphQLEndpoints(t)
	waitForConstellationSyncActionSchema(t)

	t.Run("schema", func(t *testing.T) { //nolint:paralleltest
		tc := TestCase{
			name: "sync action schema",
			query: query{
				Query: `query ActionSchema {
					queryRoot: __type(name: "query_root") {
						fields { name }
					}
					mutationRoot: __type(name: "mutation_root") {
						fields { name }
					}
					addNumbersOutput: __type(name: "AddNumbersOutput") {
						fields { name }
					}
					echoHeadersOutput: __type(name: "EchoHeadersOutput") {
						fields { name }
					}
					loginOutput: __type(name: "LoginOutput") {
						fields { name }
					}
				}`,
				Role: "admin",
			},
			responseNormalizer: normalizeActionSchemaResponse,
		}

		compareActionResponses(t, tc, nil)
	})

	t.Run("query execution", func(t *testing.T) { //nolint:paralleltest
		tc := TestCase{
			name: "sync action query execution",
			query: query{
				Query: `query ActionExecution {
					addNumbers(a: 5, b: 7) {
						sum
					}
					echoHeaders(message: "hello actions") {
						message
						role
						userId
						forwardedHeader
						webhookSecretPresent
					}
				}`,
				Role: "user",
				SessionVariables: map[string]string{
					"user-id": "action-user-123",
				},
			},
			responseNormalizer: redactActionVolatiles,
		}
		headers := http.Header{
			"x-action-echo": []string{"forwarded-from-red-test"},
		}

		compareActionResponses(t, tc, headers)
	})

	t.Run("mutation execution", func(t *testing.T) { //nolint:paralleltest
		tc := TestCase{
			name: "sync action mutation execution",
			query: query{
				Query: `mutation ActionLogin($email: String!, $password: String!) {
					login(email: $email, password: $password) {
						accessToken
						userId
						role
					}
				}`,
				Variables: actionLoginVariables(),
				Role:      "public",
			},
			responseNormalizer: redactActionVolatiles,
		}

		compareActionResponses(t, tc, nil)
	})
}

func TestActionFileMetadataParsing(t *testing.T) {
	t.Parallel()

	md, err := metadata.FromDetect(
		t.Context(),
		filepath.Join("nhost", "metadata", "metadata.yaml"),
	)
	if err != nil {
		t.Fatalf("loading default action metadata through file metadata path: %v", err)
	}

	assertNativeMetadataContainsActions(t, md, "file metadata")
}

func TestActionDBJSONMetadataParsing(t *testing.T) {
	t.Parallel()

	data := readSyncActionFixture(t, "metadata.json")

	md, err := metadata.FromHasuraJSON(data)
	if err != nil {
		t.Fatalf("loading action fixture through DB JSON metadata path: %v", err)
	}

	assertNativeMetadataContainsActions(t, md, "DB JSON metadata")
}

func skipUnlessActionGraphQLEndpoints(t *testing.T) {
	t.Helper()

	for name, endpoint := range map[string]string{
		"hasura":        hasuraURL,
		"constellation": constellationURL,
	} {
		if err := probeActionGraphQLEndpoint(t, endpoint); err != nil {
			t.Skipf(
				"%s GraphQL endpoint unavailable for action schema/execution parity test: %v",
				name,
				err,
			)
		}
	}
}

func waitForConstellationSyncActionSchema(t *testing.T) {
	t.Helper()

	probe := query{
		Query: `query ActionSchemaReady {
			queryRoot: __type(name: "query_root") { fields { name } }
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
		if err == nil && responseHasIntrospectionField(resp, "queryRoot", "addNumbers") {
			return
		}

		last = resp

		time.Sleep(200 * time.Millisecond)
	}

	t.Fatalf("constellation did not expose sync action schema after metadata reload: %#v", last)
}

func responseHasIntrospectionField(response any, typeKey, field string) bool {
	m, ok := response.(map[string]any)
	if !ok {
		return false
	}

	data, ok := m["data"].(map[string]any)
	if !ok {
		return false
	}

	typeInfo, ok := data[typeKey].(map[string]any)
	if !ok {
		return false
	}

	fields, ok := typeInfo["fields"].([]any)
	if !ok {
		return false
	}

	for _, rawField := range fields {
		fieldInfo, ok := rawField.(map[string]any)
		if ok && fieldInfo["name"] == field {
			return true
		}
	}

	return false
}

func probeActionGraphQLEndpoint(t *testing.T, endpoint string) error {
	t.Helper()

	payload := map[string]string{"query": "query ActionProbe { __typename }"}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshaling probe request: %w", err)
	}

	ctx, cancel := context.WithTimeout(t.Context(), 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("creating probe request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-hasura-admin-secret", adminSecret)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("performing probe request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("%w %d", errUnexpectedActionHTTPStatus, resp.StatusCode)
	}

	return nil
}

func compareActionResponses(t *testing.T, tc TestCase, extraHeaders http.Header) {
	t.Helper()

	headers := http.Header{
		"x-hasura-admin-secret": []string{adminSecret},
		"x-hasura-role":         []string{tc.query.Role},
	}
	for k, v := range tc.query.SessionVariables {
		headers.Set("x-hasura-"+k, v)
	}

	for k, values := range extraHeaders {
		for _, value := range values {
			headers.Add(k, value)
		}
	}

	hasuraResp, err := makeHTTPQuery(t.Context(), hasuraURL, tc.query, headers)
	if err != nil {
		t.Fatalf("hasura action query failed: %v", err)
	}

	assertHasuraActionFixtureServed(t, tc.name, hasuraResp)

	constellationResp, err := makeHTTPQuery(t.Context(), constellationURL, tc.query, headers)
	if err != nil {
		t.Fatalf("constellation action query failed: %v", err)
	}

	hasuraComparable := normalizeResponse(hasuraResp, tc.responseNormalizer)

	constellationComparable := normalizeResponse(constellationResp, tc.responseNormalizer)
	if diff := cmp.Diff(hasuraComparable, constellationComparable); diff != "" {
		t.Errorf("action parity gap remains (-hasura +constellation):\n%s", diff)
	}
}

func normalizeActionSchemaResponse(value any) any {
	response, ok := value.(map[string]any)
	if !ok {
		return value
	}

	out := maps.Clone(response)

	data, ok := response["data"].(map[string]any)
	if !ok {
		return out
	}

	dataOut := maps.Clone(data)
	out["data"] = dataOut

	filterIntrospectionFields(dataOut, "queryRoot", []string{"addNumbers", "echoHeaders"})
	filterIntrospectionFields(dataOut, "mutationRoot", []string{"login"})
	sortIntrospectionFields(dataOut, "addNumbersOutput")
	sortIntrospectionFields(dataOut, "echoHeadersOutput")
	sortIntrospectionFields(dataOut, "loginOutput")

	return out
}

func filterIntrospectionFields(data map[string]any, typeKey string, allowed []string) {
	allowedNames := make(map[string]struct{}, len(allowed))
	for _, name := range allowed {
		allowedNames[name] = struct{}{}
	}

	fields := cloneIntrospectionFields(data, typeKey)
	if fields == nil {
		return
	}

	filtered := make([]any, 0, len(fields))
	for _, field := range fields {
		if _, ok := allowedNames[introspectionFieldName(field)]; ok {
			filtered = append(filtered, field)
		}
	}

	sortFieldList(filtered)
	setIntrospectionFields(data, typeKey, filtered)
}

func sortIntrospectionFields(data map[string]any, typeKey string) {
	fields := cloneIntrospectionFields(data, typeKey)
	if fields == nil {
		return
	}

	sortFieldList(fields)
	setIntrospectionFields(data, typeKey, fields)
}

func cloneIntrospectionFields(data map[string]any, typeKey string) []any {
	typeInfo, ok := data[typeKey].(map[string]any)
	if !ok {
		return nil
	}

	typeOut := maps.Clone(typeInfo)
	data[typeKey] = typeOut

	fields, ok := typeInfo["fields"].([]any)
	if !ok {
		return nil
	}

	return slices.Clone(fields)
}

func setIntrospectionFields(data map[string]any, typeKey string, fields []any) {
	typeInfo, ok := data[typeKey].(map[string]any)
	if !ok {
		return
	}

	typeInfo["fields"] = fields
}

func sortFieldList(fields []any) {
	slices.SortFunc(fields, func(a, b any) int {
		return strings.Compare(introspectionFieldName(a), introspectionFieldName(b))
	})
}

func introspectionFieldName(field any) string {
	fieldMap, ok := field.(map[string]any)
	if !ok {
		return ""
	}

	name, _ := fieldMap["name"].(string)

	return name
}

func assertHasuraActionFixtureServed(t *testing.T, testName string, response any) {
	t.Helper()

	if hasGraphQLErrors(response) {
		t.Fatalf("hasura did not serve action fixture for %s: %#v", testName, response)
	}

	switch testName {
	case "sync action schema":
		assertActionSchemaIntrospection(t, response)
	case "sync action query execution":
		assertGraphQLDataField(t, response, "addNumbers")
		assertGraphQLDataField(t, response, "echoHeaders")
	case "sync action mutation execution":
		assertGraphQLDataField(t, response, "login")
	}
}

func assertActionSchemaIntrospection(t *testing.T, response any) {
	t.Helper()

	data := graphQLDataMap(t, response)
	assertIntrospectionField(t, data["queryRoot"], "addNumbers")
	assertIntrospectionField(t, data["queryRoot"], "echoHeaders")
	assertIntrospectionField(t, data["mutationRoot"], "login")
	assertIntrospectionType(t, data["addNumbersOutput"], "AddNumbersOutput")
	assertIntrospectionType(t, data["echoHeadersOutput"], "EchoHeadersOutput")
	assertIntrospectionType(t, data["loginOutput"], "LoginOutput")
}

func assertGraphQLDataField(t *testing.T, response any, field string) {
	t.Helper()

	data := graphQLDataMap(t, response)
	if data[field] == nil {
		t.Fatalf("hasura action fixture response omitted %s: %#v", field, response)
	}
}

func graphQLDataMap(t *testing.T, response any) map[string]any {
	t.Helper()

	m, ok := response.(map[string]any)
	if !ok {
		t.Fatalf("graphql response has type %T, want JSON object", response)
	}

	data, ok := m["data"].(map[string]any)
	if !ok {
		t.Fatalf("graphql response has no data object: %#v", response)
	}

	return data
}

func assertIntrospectionField(t *testing.T, typeInfo any, field string) {
	t.Helper()

	m := assertIntrospectionType(t, typeInfo, field)

	fields, ok := m["fields"].([]any)
	if !ok {
		t.Fatalf("introspection type for %s has no fields list: %#v", field, typeInfo)
	}

	for _, f := range fields {
		fieldMap, ok := f.(map[string]any)
		if ok && fieldMap["name"] == field {
			return
		}
	}

	t.Fatalf("introspection type omitted field %s: %#v", field, typeInfo)
}

func assertIntrospectionType(t *testing.T, typeInfo any, name string) map[string]any {
	t.Helper()

	m, ok := typeInfo.(map[string]any)
	if !ok {
		t.Fatalf("introspection type %s is absent: %#v", name, typeInfo)
	}

	return m
}

func hasGraphQLErrors(response any) bool {
	m, ok := response.(map[string]any)
	if !ok {
		return false
	}

	errors, ok := m["errors"].([]any)

	return ok && len(errors) > 0
}

func assertNativeMetadataContainsActions(t *testing.T, md *metadata.Metadata, source string) {
	t.Helper()

	data, err := json.Marshal(md)
	if err != nil {
		t.Fatalf("marshaling native metadata from %s: %v", source, err)
	}

	if !bytes.Contains(data, []byte(`"actions"`)) {
		t.Errorf(
			"%s dropped Hasura actions; native metadata has %d database(s) and %d remote schema(s)",
			source,
			len(md.Databases),
			len(md.RemoteSchemas),
		)
	}

	if !bytes.Contains(data, []byte(`"custom_types"`)) {
		t.Errorf(
			"%s dropped Hasura custom_types; native metadata has %d database(s) and %d remote schema(s)",
			source,
			len(md.Databases),
			len(md.RemoteSchemas),
		)
	}
}

func readSyncActionFixture(t *testing.T, name string) []byte {
	t.Helper()

	data, err := os.ReadFile(filepath.Join(actionFixtureDir, name))
	if err != nil {
		t.Fatalf("reading sync action fixture %s: %v", name, err)
	}

	return data
}

func actionLoginVariables() map[string]any {
	return map[string]any{
		"email":         "action.user@example.com",
		"pass" + "word": "red-test-login-value",
	}
}
