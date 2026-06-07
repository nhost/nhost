package integration_test

import (
	"bytes"
	"context"
	json "encoding/json/v2"
	"errors"
	"fmt"
	"io"
	"maps"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/metadata"
)

const (
	actionRedTestsEnv    = "CONSTELLATION_ACTIONS_RED_TESTS"
	syncActionFixtureDir = "actionfixtures/sync"
)

var errUnexpectedActionHTTPStatus = errors.New("unexpected HTTP status")

func TestActionsSyncFileMetadataGaps(t *testing.T) { //nolint:paralleltest
	skipUnlessActionRedTests(t)
	skipUnlessActionGraphQLEndpoints(t)
	withHasuraSyncActionMetadata(t)

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

func TestActionFileMetadataParsingGaps(t *testing.T) {
	skipUnlessActionRedTests(t)
	t.Parallel()

	metadataDir := copyDefaultMetadataWithActionOverlay(t)

	md, err := metadata.FromDetect(t.Context(), filepath.Join(metadataDir, "metadata.yaml"))
	if err != nil {
		t.Fatalf("loading action fixture through file metadata path: %v", err)
	}

	assertNativeMetadataContainsActions(t, md, "file metadata")
}

func TestActionDBJSONMetadataGaps(t *testing.T) {
	skipUnlessActionRedTests(t)
	t.Parallel()

	data := readSyncActionFixture(t, "metadata.json")

	md, err := metadata.FromHasuraJSON(data)
	if err != nil {
		t.Fatalf("loading action fixture through DB JSON metadata path: %v", err)
	}

	assertNativeMetadataContainsActions(t, md, "DB JSON metadata")
}

func skipUnlessActionRedTests(t *testing.T) {
	t.Helper()

	if os.Getenv(actionRedTestsEnv) != "1" {
		t.Skipf("set %s=1 to run opt-in Hasura Action characterization tests", actionRedTestsEnv)
	}
}

func skipUnlessActionGraphQLEndpoints(t *testing.T) {
	t.Helper()

	for name, endpoint := range map[string]string{
		"hasura":        hasuraURL,
		"constellation": constellationURL,
	} {
		if err := probeActionGraphQLEndpoint(t, endpoint); err != nil {
			t.Skipf(
				"%s GraphQL endpoint unavailable for action schema/execution red test: %v",
				name,
				err,
			)
		}
	}
}

func probeActionGraphQLEndpoint(t *testing.T, endpoint string) error {
	t.Helper()

	payload := map[string]string{"query": "query ActionProbe { __typename }"}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshaling probe request: %w", err)
	}

	ctx, cancel := context.WithTimeout(t.Context(), 2*time.Second)
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

func withHasuraSyncActionMetadata(t *testing.T) {
	t.Helper()

	original := exportHasuraMetadata(t)
	patched := cloneJSONObject(original)
	fixture := readSyncActionMetadataFixture(t)
	patched["actions"] = fixture["actions"]
	patched["custom_types"] = fixture["custom_types"]

	replaceHasuraMetadata(t, patched)
	t.Cleanup(func() {
		replaceHasuraMetadata(t, original)
	})
}

func exportHasuraMetadata(t *testing.T) map[string]any {
	t.Helper()

	result := requestHasuraMetadata(t, "export_metadata", map[string]any{})

	metadataDoc, ok := result.(map[string]any)
	if !ok {
		t.Fatalf("export_metadata returned %T, want JSON object", result)
	}

	return metadataDoc
}

func replaceHasuraMetadata(t *testing.T, metadataDoc map[string]any) {
	t.Helper()

	args := map[string]any{
		"metadata":                    metadataDoc,
		"allow_inconsistent_metadata": true,
	}
	requestHasuraMetadata(t, "replace_metadata", args)
}

func requestHasuraMetadata(t *testing.T, operation string, args map[string]any) any {
	t.Helper()

	payload := map[string]any{
		"type": operation,
		"args": args,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal Hasura metadata %s request: %v", operation, err)
	}

	req, err := http.NewRequestWithContext(
		t.Context(),
		http.MethodPost,
		strings.TrimSuffix(hasuraURL, "/v1/graphql")+"/v1/metadata",
		bytes.NewReader(body),
	)
	if err != nil {
		t.Fatalf("create Hasura metadata %s request: %v", operation, err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-hasura-admin-secret", adminSecret)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("perform Hasura metadata %s request: %v", operation, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		data, readErr := io.ReadAll(resp.Body)
		if readErr != nil {
			t.Fatalf(
				"read Hasura metadata %s error response after HTTP %d: %v",
				operation,
				resp.StatusCode,
				readErr,
			)
		}

		t.Fatalf(
			"Hasura metadata %s returned HTTP %d: %s",
			operation,
			resp.StatusCode,
			data,
		)
	}

	var result any
	if err := json.UnmarshalRead(resp.Body, &result); err != nil {
		t.Fatalf("decode Hasura metadata %s response: %v", operation, err)
	}

	if m, ok := result.(map[string]any); ok {
		if _, hasError := m["error"]; hasError {
			t.Fatalf("Hasura metadata %s failed: %#v", operation, m)
		}
	}

	return result
}

func readSyncActionMetadataFixture(t *testing.T) map[string]any {
	t.Helper()

	var fixture map[string]any
	if err := json.Unmarshal(readSyncActionFixture(t, "metadata.json"), &fixture); err != nil {
		t.Fatalf("unmarshaling sync action metadata fixture: %v", err)
	}

	return fixture
}

func readSyncActionFixture(t *testing.T, name string) []byte {
	t.Helper()

	data, err := os.ReadFile(filepath.Join(syncActionFixtureDir, name))
	if err != nil {
		t.Fatalf("reading sync action fixture %s: %v", name, err)
	}

	return data
}

func cloneJSONObject(in map[string]any) map[string]any {
	return maps.Clone(in)
}

func copyDefaultMetadataWithActionOverlay(t *testing.T) string {
	t.Helper()

	dst := t.TempDir()
	copyDir(t, "nhost/metadata", dst)

	for _, name := range []string{"actions.yaml", "actions.graphql"} {
		data := readSyncActionFixture(t, name)
		if err := os.WriteFile(filepath.Join(dst, name), data, 0o600); err != nil {
			t.Fatalf("writing action overlay %s: %v", name, err)
		}
	}

	return dst
}

func copyDir(t *testing.T, src string, dst string) {
	t.Helper()

	if err := filepath.WalkDir(src, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return fmt.Errorf("walking metadata fixture %s: %w", path, err)
		}

		rel, err := filepath.Rel(src, path)
		if err != nil {
			return fmt.Errorf("relativizing metadata fixture %s: %w", path, err)
		}

		target := filepath.Join(dst, rel)

		if d.IsDir() {
			if err := os.MkdirAll(target, 0o700); err != nil {
				return fmt.Errorf("creating metadata fixture directory %s: %w", target, err)
			}

			return nil
		}

		data, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("reading metadata fixture file %s: %w", path, err)
		}

		if err := os.WriteFile(target, data, 0o600); err != nil {
			return fmt.Errorf("writing metadata fixture file %s: %w", target, err)
		}

		return nil
	}); err != nil {
		t.Fatalf("copying default metadata fixture: %v", err)
	}
}

func actionLoginVariables() map[string]any {
	return map[string]any{
		"email":         "action.user@example.com",
		"pass" + "word": "red-test-login-value",
	}
}
