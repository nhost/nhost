package hasura_test

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/Yamashou/gqlgenc/clientv2"
	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/ai/hasura"
)

const (
	providerEnumPresent = `{"data":{"__type":{"enumValues":[` +
		`{"name":"anthropic"},{"name":"openai_compatible"}]}}}`
	providerEnumAbsent = `{"data":{"__type":{"enumValues":[` +
		`{"name":"anthropic"},{"name":"openai"}]}}}`
)

type enumVisibilityResponse struct {
	status int
	body   string
}

type capturedHasuraRequest struct {
	path string
	body string
}

func TestEnsureAgentProviderEnumValue(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name                   string
		graphqlResponses       []enumVisibilityResponse
		metadataResponse       enumVisibilityResponse
		wantPaths              []string
		wantMetadataRequest    bool
		wantIntrospectionQuery bool
		wantErrContains        string
	}{
		{
			name: "present skips reload",
			graphqlResponses: []enumVisibilityResponse{
				{status: http.StatusOK, body: providerEnumPresent},
			},
			metadataResponse:       enumVisibilityResponse{},
			wantPaths:              []string{"/v1/graphql"},
			wantMetadataRequest:    false,
			wantIntrospectionQuery: true,
			wantErrContains:        "",
		},
		{
			name: "absent reloads and becomes present",
			graphqlResponses: []enumVisibilityResponse{
				{status: http.StatusOK, body: providerEnumAbsent},
				{status: http.StatusOK, body: providerEnumPresent},
			},
			metadataResponse: enumVisibilityResponse{
				status: http.StatusOK,
				body:   `{}`,
			},
			wantPaths: []string{
				"/v1/graphql",
				"/v1/metadata",
				"/v1/graphql",
			},
			wantMetadataRequest:    true,
			wantIntrospectionQuery: true,
			wantErrContains:        "",
		},
		{
			name: "absent after reload reports missing value",
			graphqlResponses: []enumVisibilityResponse{
				{status: http.StatusOK, body: providerEnumAbsent},
				{status: http.StatusOK, body: providerEnumAbsent},
			},
			metadataResponse: enumVisibilityResponse{
				status: http.StatusOK,
				body:   `{}`,
			},
			wantPaths: []string{
				"/v1/graphql",
				"/v1/metadata",
				"/v1/graphql",
			},
			wantMetadataRequest:    true,
			wantIntrospectionQuery: true,
			wantErrContains: `required aiAgentProviders_enum value is not visible after metadata reload: ` +
				`"openai_compatible"`,
		},
		{
			name: "initial introspection request fails",
			graphqlResponses: []enumVisibilityResponse{
				{status: http.StatusInternalServerError, body: `request failed`},
			},
			metadataResponse:       enumVisibilityResponse{},
			wantPaths:              []string{"/v1/graphql"},
			wantMetadataRequest:    false,
			wantIntrospectionQuery: true,
			wantErrContains:        "introspecting aiAgentProviders_enum",
		},
		{
			name: "metadata reload request fails",
			graphqlResponses: []enumVisibilityResponse{
				{status: http.StatusOK, body: providerEnumAbsent},
			},
			metadataResponse: enumVisibilityResponse{
				status: http.StatusBadRequest,
				body:   `{"code":"unexpected","error":"boom","path":"$"}`,
			},
			wantPaths: []string{
				"/v1/graphql",
				"/v1/metadata",
			},
			wantMetadataRequest:    true,
			wantIntrospectionQuery: true,
			wantErrContains:        "reloading default Hasura source metadata",
		},
		{
			name: "second introspection request fails",
			graphqlResponses: []enumVisibilityResponse{
				{status: http.StatusOK, body: providerEnumAbsent},
				{status: http.StatusInternalServerError, body: `request failed`},
			},
			metadataResponse: enumVisibilityResponse{
				status: http.StatusOK,
				body:   `{}`,
			},
			wantPaths: []string{
				"/v1/graphql",
				"/v1/metadata",
				"/v1/graphql",
			},
			wantMetadataRequest:    true,
			wantIntrospectionQuery: true,
			wantErrContains:        "re-introspecting aiAgentProviders_enum",
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()

			var (
				mu           sync.Mutex
				requests     []capturedHasuraRequest
				graphqlCalls int
			)

			server := httptest.NewServer(http.HandlerFunc(func(
				w http.ResponseWriter,
				r *http.Request,
			) {
				body, err := io.ReadAll(r.Body)
				if err != nil {
					t.Errorf("read request body: %v", err)
					w.WriteHeader(http.StatusInternalServerError)

					return
				}

				mu.Lock()

				requests = append(requests, capturedHasuraRequest{
					path: r.URL.Path,
					body: string(body),
				})

				var response enumVisibilityResponse
				switch r.URL.Path {
				case "/v1/graphql":
					if graphqlCalls >= len(testCase.graphqlResponses) {
						unexpectedCall := graphqlCalls + 1
						mu.Unlock()
						t.Errorf("unexpected GraphQL request #%d", unexpectedCall)
						w.WriteHeader(http.StatusInternalServerError)

						return
					}

					response = testCase.graphqlResponses[graphqlCalls]
					graphqlCalls++
				case "/v1/metadata":
					response = testCase.metadataResponse
				default:
					mu.Unlock()
					t.Errorf("unexpected request path %q", r.URL.Path)
					w.WriteHeader(http.StatusNotFound)

					return
				}
				mu.Unlock()

				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(response.status)

				if _, err := w.Write([]byte(response.body)); err != nil {
					t.Errorf("write response body: %v", err)
				}
			}))
			t.Cleanup(server.Close)

			client := hasura.NewClient(
				server.Client(),
				server.URL+"/v1/graphql",
				&clientv2.Options{ParseDataAlongWithErrors: false},
			)

			err := client.EnsureAgentProviderEnumValue(
				t.Context(),
				hasura.AiAgentProvidersEnumOpenaiCompatible.String(),
			)
			if testCase.wantErrContains == "" && err != nil {
				t.Fatalf("EnsureAgentProviderEnumValue() unexpected error: %v", err)
			}

			if testCase.wantErrContains != "" &&
				(err == nil || !strings.Contains(err.Error(), testCase.wantErrContains)) {
				t.Fatalf(
					"EnsureAgentProviderEnumValue() error = %v, want substring %q",
					err,
					testCase.wantErrContains,
				)
			}

			mu.Lock()

			captured := append([]capturedHasuraRequest(nil), requests...)
			mu.Unlock()

			gotPaths := make([]string, 0, len(captured))
			for _, request := range captured {
				gotPaths = append(gotPaths, request.path)
			}

			if diff := cmp.Diff(testCase.wantPaths, gotPaths); diff != "" {
				t.Errorf("request paths mismatch (-want +got):\n%s", diff)
			}

			assertAgentProviderEnumRequests(
				t,
				captured,
				testCase.wantMetadataRequest,
				testCase.wantIntrospectionQuery,
			)
		})
	}
}

func assertAgentProviderEnumRequests(
	t *testing.T,
	requests []capturedHasuraRequest,
	wantMetadataRequest bool,
	wantIntrospectionQuery bool,
) {
	t.Helper()

	const wantReload = `{"type":"reload_metadata","args":{` +
		`"reload_sources":["default"],` +
		`"reload_remote_schemas":false,` +
		`"recreate_event_triggers":false,` +
		`"reload_data_connectors":false}}`

	foundMetadataRequest := false
	foundIntrospectionQuery := false

	for _, request := range requests {
		switch request.path {
		case "/v1/metadata":
			foundMetadataRequest = true

			if diff := cmp.Diff(wantReload, request.body); diff != "" {
				t.Errorf("reload_metadata payload mismatch (-want +got):\n%s", diff)
			}
		case "/v1/graphql":
			if strings.Contains(request.body, "aiAgentProviders_enum") &&
				strings.Contains(request.body, "enumValues") {
				foundIntrospectionQuery = true
			}
		}
	}

	if foundMetadataRequest != wantMetadataRequest {
		t.Errorf(
			"metadata request present = %t, want %t",
			foundMetadataRequest,
			wantMetadataRequest,
		)
	}

	if foundIntrospectionQuery != wantIntrospectionQuery {
		t.Errorf(
			"introspection query present = %t, want %t",
			foundIntrospectionQuery,
			wantIntrospectionQuery,
		)
	}
}
