package tool

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/ai/agents/tool/graphqlutil"
)

func TestGraphQLGetSchemaDefinition(t *testing.T) {
	t.Parallel()

	g := NewGraphQLGetSchema(GraphQLConfig{URL: "http://localhost", Headers: http.Header{}})
	def := g.Definition()

	if def.Name != "graphql_get_schema" {
		t.Errorf("expected name 'graphql_get_schema', got %q", def.Name)
	}

	if def.Description == "" {
		t.Error("expected non-empty description")
	}

	props, ok := def.Parameters["properties"].(map[string]any)
	if !ok {
		t.Fatal("expected properties to be a map")
	}

	if _, ok := props["summary"]; !ok {
		t.Error("expected 'summary' property")
	}
}

func TestGraphQLQueryDefinition(t *testing.T) {
	t.Parallel()

	g := NewGraphQLQuery(GraphQLConfig{URL: "http://localhost", Headers: http.Header{}})
	def := g.Definition()

	if def.Name != "graphql_query" {
		t.Errorf("expected name 'graphql_query', got %q", def.Name)
	}

	if def.Description == "" {
		t.Error("expected non-empty description")
	}

	props, ok := def.Parameters["properties"].(map[string]any)
	if !ok {
		t.Fatal("expected properties to be a map")
	}

	if _, ok := props["query"]; !ok {
		t.Error("expected 'query' property")
	}

	if _, ok := props["variables"]; !ok {
		t.Error("expected 'variables' property")
	}
}

func newIntrospectionServer() *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		resp := map[string]any{
			"data": map[string]any{
				"__schema": map[string]any{
					"queryType": map[string]any{
						"kind": "OBJECT",
						"name": "query_root",
						"fields": []any{
							map[string]any{
								"name": "users",
								"args": []any{},
								"type": map[string]any{
									"kind": "LIST",
									"name": nil,
									"ofType": map[string]any{
										"kind":   "OBJECT",
										"name":   "users",
										"ofType": nil,
									},
								},
							},
						},
						"inputFields":   nil,
						"interfaces":    []any{},
						"enumValues":    nil,
						"possibleTypes": nil,
					},
					"mutationType": map[string]any{
						"kind": "OBJECT",
						"name": "mutation_root",
						"fields": []any{
							map[string]any{
								"name": "insert_users",
								"args": []any{},
								"type": map[string]any{
									"kind":   "OBJECT",
									"name":   "users_mutation_response",
									"ofType": nil,
								},
							},
						},
						"inputFields":   nil,
						"interfaces":    []any{},
						"enumValues":    nil,
						"possibleTypes": nil,
					},
					"types": []any{
						map[string]any{
							"kind": "OBJECT",
							"name": "users",
							"fields": []any{
								map[string]any{
									"name": "id",
									"args": []any{},
									"type": map[string]any{
										"kind":   "SCALAR",
										"name":   "uuid",
										"ofType": nil,
									},
								},
								map[string]any{
									"name": "name",
									"args": []any{},
									"type": map[string]any{
										"kind":   "SCALAR",
										"name":   "String",
										"ofType": nil,
									},
								},
							},
							"inputFields":   nil,
							"interfaces":    []any{},
							"enumValues":    nil,
							"possibleTypes": nil,
						},
						map[string]any{
							"kind":          "SCALAR",
							"name":          "uuid",
							"fields":        nil,
							"inputFields":   nil,
							"interfaces":    nil,
							"enumValues":    nil,
							"possibleTypes": nil,
						},
						map[string]any{
							"kind":          "SCALAR",
							"name":          "String",
							"fields":        nil,
							"inputFields":   nil,
							"interfaces":    nil,
							"enumValues":    nil,
							"possibleTypes": nil,
						},
						map[string]any{
							"kind": "OBJECT",
							"name": "users_mutation_response",
							"fields": []any{
								map[string]any{
									"name": "affected_rows",
									"args": []any{},
									"type": map[string]any{
										"kind":   "SCALAR",
										"name":   "Int",
										"ofType": nil,
									},
								},
							},
							"inputFields":   nil,
							"interfaces":    []any{},
							"enumValues":    nil,
							"possibleTypes": nil,
						},
						map[string]any{
							"kind":          "SCALAR",
							"name":          "Int",
							"fields":        nil,
							"inputFields":   nil,
							"interfaces":    nil,
							"enumValues":    nil,
							"possibleTypes": nil,
						},
						map[string]any{
							"kind": "OBJECT",
							"name": "query_root",
							"fields": []any{
								map[string]any{
									"name": "users",
									"args": []any{},
									"type": map[string]any{
										"kind": "LIST",
										"name": nil,
										"ofType": map[string]any{
											"kind":   "OBJECT",
											"name":   "users",
											"ofType": nil,
										},
									},
								},
							},
							"inputFields":   nil,
							"interfaces":    []any{},
							"enumValues":    nil,
							"possibleTypes": nil,
						},
						map[string]any{
							"kind": "OBJECT",
							"name": "mutation_root",
							"fields": []any{
								map[string]any{
									"name": "insert_users",
									"args": []any{},
									"type": map[string]any{
										"kind":   "OBJECT",
										"name":   "users_mutation_response",
										"ofType": nil,
									},
								},
							},
							"inputFields":   nil,
							"interfaces":    []any{},
							"enumValues":    nil,
							"possibleTypes": nil,
						},
					},
				},
			},
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp) //nolint:errcheck
	}))
}

func newGraphQLResponseServer(response string) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(response))
	}))
}

func TestGraphQLGetSchemaDefaultConstructorReachesLoopback(t *testing.T) {
	t.Parallel()

	srv := newIntrospectionServer()
	defer srv.Close()

	g := NewGraphQLGetSchema(GraphQLConfig{URL: srv.URL, Headers: http.Header{}})

	result, err := g.Execute(context.Background(), `{"summary": true}`, slog.Default())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(result, "users") {
		t.Errorf("expected result to contain schema summary, got %q", result)
	}
}

func TestGraphQLQueryDefaultConstructorReachesLoopback(t *testing.T) {
	t.Parallel()

	srv := newGraphQLResponseServer(`{"data":{"users":[{"id":"1"}]}}`)
	defer srv.Close()

	g := NewGraphQLQuery(GraphQLConfig{URL: srv.URL, Headers: http.Header{}})

	result, err := g.Execute(
		context.Background(),
		`{"query":"query { users { id } }"}`,
		slog.Default(),
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(result, "users") {
		t.Errorf("expected result to contain query data, got %q", result)
	}
}

func TestGraphQLMutationDefaultConstructorReachesLoopback(t *testing.T) {
	t.Parallel()

	srv := newGraphQLResponseServer(`{"data":{"insert_users":{"affected_rows":1}}}`)
	defer srv.Close()

	g := NewGraphQLMutation(GraphQLConfig{URL: srv.URL, Headers: http.Header{}})

	result, err := g.Execute(
		context.Background(),
		`{"query":"mutation { insert_users(objects: []) { affected_rows } }"}`,
		slog.Default(),
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(result, "affected_rows") {
		t.Errorf("expected result to contain mutation data, got %q", result)
	}
}

func TestGraphQLGetSchemaSummary(t *testing.T) {
	t.Parallel()

	srv := newIntrospectionServer()
	defer srv.Close()

	g := &GraphQLGetSchema{
		config: GraphQLConfig{URL: srv.URL, Headers: http.Header{}},
		client: srv.Client(),
	}

	result, err := g.Execute(context.Background(), `{"summary": true}`, slog.Default())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var summary map[string][]string
	if err := json.Unmarshal([]byte(result), &summary); err != nil {
		t.Fatalf("expected valid JSON summary, got error: %v", err)
	}

	queries, ok := summary["query"]
	if !ok || len(queries) == 0 {
		t.Error("expected query names in summary")
	}

	mutations, ok := summary["mutation"]
	if !ok || len(mutations) == 0 {
		t.Error("expected mutation names in summary")
	}
}

func TestGraphQLGetSchemaFull(t *testing.T) {
	t.Parallel()

	srv := newIntrospectionServer()
	defer srv.Close()

	g := &GraphQLGetSchema{
		config: GraphQLConfig{URL: srv.URL, Headers: http.Header{}},
		client: srv.Client(),
	}

	result, err := g.Execute(context.Background(), `{"summary": false}`, slog.Default())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(result, "type") {
		t.Error("expected SDL output containing 'type'")
	}
}

func TestGraphQLGetSchemaDefaultSummary(t *testing.T) {
	t.Parallel()

	srv := newIntrospectionServer()
	defer srv.Close()

	g := &GraphQLGetSchema{
		config: GraphQLConfig{URL: srv.URL, Headers: http.Header{}},
		client: srv.Client(),
	}

	result, err := g.Execute(context.Background(), `{}`, slog.Default())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var summary map[string][]string
	if err := json.Unmarshal([]byte(result), &summary); err != nil {
		t.Fatalf("expected JSON summary by default, got: %s", result)
	}
}

func TestGraphQLGetSchemaSelectsIntrospectionQuery(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name      string
		arguments string
		wantQuery string
	}{
		{
			name:      "summary",
			arguments: `{"summary": true}`,
			wantQuery: graphqlutil.SummaryIntrospectionQuery,
		},
		{
			name:      "default summary",
			arguments: `{}`,
			wantQuery: graphqlutil.SummaryIntrospectionQuery,
		},
		{
			name:      "full schema",
			arguments: `{"summary": false}`,
			wantQuery: graphqlutil.IntrospectionQuery,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			srv := httptest.NewServer(
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					var request struct {
						Query string `json:"query"`
					}

					if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
						http.Error(w, "failed to decode request", http.StatusBadRequest)

						return
					}

					if request.Query != tc.wantQuery {
						http.Error(w, "unexpected introspection query", http.StatusBadRequest)

						return
					}

					w.Header().Set("Content-Type", "application/json")

					response := `{"data":{"__schema":{"queryType":{"fields":[{"name":"users"}]},"mutationType":null,"types":[]}}}`

					written, err := io.WriteString(w, response)
					if err != nil || written != len(response) {
						return
					}
				}),
			)
			defer srv.Close()

			g := &GraphQLGetSchema{
				config: GraphQLConfig{URL: srv.URL, Headers: http.Header{}},
				client: srv.Client(),
			}

			result, err := g.Execute(t.Context(), tc.arguments, slog.Default())
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if result == "" {
				t.Error("expected non-empty schema result")
			}
		})
	}
}

func TestIntrospectionResponseTooLargeError(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name                  string
		summary               bool
		wantSummarySuggestion bool
	}{
		{
			name:                  "full schema suggests summary",
			wantSummarySuggestion: true,
		},
		{
			name:    "summary does not suggest itself",
			summary: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			err := introspectionResponseTooLargeError(tc.summary)
			if !errors.Is(err, errIntrospectionFailed) {
				t.Errorf("expected introspection failure, got: %v", err)
			}

			gotSummarySuggestion := strings.Contains(err.Error(), "try summary mode first")
			if gotSummarySuggestion != tc.wantSummarySuggestion {
				t.Errorf(
					"summary suggestion presence: got %t, want %t; error: %v",
					gotSummarySuggestion,
					tc.wantSummarySuggestion,
					err,
				)
			}
		})
	}
}

func TestGraphQLQueryExecute(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":{"users":[{"id":"1","name":"alice"}]}}`))
	}))
	defer srv.Close()

	g := &GraphQLQuery{
		config: GraphQLConfig{URL: srv.URL, Headers: http.Header{}},
		client: srv.Client(),
	}

	result, err := g.Execute(
		context.Background(),
		`{"query":"query { users { id name } }"}`,
		slog.Default(),
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(result, "alice") {
		t.Errorf("expected result to contain 'alice', got %q", result)
	}
}

func TestGraphQLQueryForwardsAuthHeaders(t *testing.T) {
	t.Parallel()

	var gotHeaders http.Header

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotHeaders = r.Header.Clone()
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":{}}`))
	}))
	defer srv.Close()

	headers := http.Header{}
	headers.Set("Authorization", "Bearer test-token")
	headers.Set("X-Hasura-Admin-Secret", "admin-secret")
	headers.Set("X-Hasura-Role", "user")
	headers.Set("X-Unrelated-Header", "should-not-be-forwarded")

	g := &GraphQLQuery{
		config: GraphQLConfig{URL: srv.URL, Headers: headers},
		client: srv.Client(),
	}

	_, err := g.Execute(
		context.Background(),
		`{"query":"query { users { id } }"}`,
		slog.Default(),
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if gotHeaders.Get("Authorization") != "Bearer test-token" {
		t.Errorf("expected Authorization header, got %q", gotHeaders.Get("Authorization"))
	}

	if gotHeaders.Get("X-Hasura-Admin-Secret") != "admin-secret" {
		t.Errorf(
			"expected X-Hasura-Admin-Secret header, got %q",
			gotHeaders.Get("X-Hasura-Admin-Secret"),
		)
	}

	if gotHeaders.Get("X-Hasura-Role") != "user" {
		t.Errorf("expected X-Hasura-Role header, got %q", gotHeaders.Get("X-Hasura-Role"))
	}

	if gotHeaders.Get("X-Unrelated-Header") != "" {
		t.Error("expected X-Unrelated-Header to NOT be forwarded")
	}
}

func TestGraphQLQueryBlocksMutation(t *testing.T) {
	t.Parallel()

	g := NewGraphQLQuery(GraphQLConfig{URL: "http://localhost", Headers: http.Header{}})

	_, err := g.Execute(
		context.Background(),
		`{"query":"mutation { insert_users(objects: []) { affected_rows } }"}`,
		slog.Default(),
	)
	if err == nil {
		t.Fatal("expected error for mutation in graphql_query, got nil")
	}

	if !strings.Contains(err.Error(), "graphql_mutation") {
		t.Errorf("expected error to mention graphql_mutation, got: %v", err)
	}
}

func TestGraphQLQueryBlocksSubscription(t *testing.T) {
	t.Parallel()

	g := NewGraphQLQuery(GraphQLConfig{URL: "http://localhost", Headers: http.Header{}})

	_, err := g.Execute(
		context.Background(),
		`{"query":"subscription { users { id } }"}`,
		slog.Default(),
	)
	if err == nil {
		t.Fatal("expected error for subscription, got nil")
	}

	if !strings.Contains(err.Error(), "subscriptions are not supported") {
		t.Errorf("expected subscription error, got: %v", err)
	}
}

func TestGraphQLQueryRejectsFragmentOnlyDocument(t *testing.T) {
	t.Parallel()

	g := NewGraphQLQuery(GraphQLConfig{URL: "http://localhost", Headers: http.Header{}})

	_, err := g.Execute(
		context.Background(),
		`{"query":"fragment X on User { id }"}`,
		slog.Default(),
	)
	if err == nil {
		t.Fatal("expected error for fragment-only document, got nil")
	}

	if !strings.Contains(err.Error(), "no operations") {
		t.Errorf("expected 'no operations' error, got: %v", err)
	}
}

func TestGraphQLMutationRejectsFragmentOnlyDocument(t *testing.T) {
	t.Parallel()

	g := NewGraphQLMutation(GraphQLConfig{URL: "http://localhost", Headers: http.Header{}})

	_, err := g.Execute(
		context.Background(),
		`{"query":"fragment X on User { id }"}`,
		slog.Default(),
	)
	if err == nil {
		t.Fatal("expected error for fragment-only document, got nil")
	}

	if !strings.Contains(err.Error(), "no operations") {
		t.Errorf("expected 'no operations' error, got: %v", err)
	}
}

func TestGraphQLQueryEmptyQuery(t *testing.T) {
	t.Parallel()

	g := NewGraphQLQuery(GraphQLConfig{URL: "http://localhost", Headers: http.Header{}})

	_, err := g.Execute(
		context.Background(),
		`{"query":""}`,
		slog.Default(),
	)
	if err == nil {
		t.Fatal("expected error for empty query, got nil")
	}
}

func TestGraphQLQueryInvalidArgs(t *testing.T) {
	t.Parallel()

	g := NewGraphQLQuery(GraphQLConfig{URL: "http://localhost", Headers: http.Header{}})

	_, err := g.Execute(context.Background(), "not json", slog.Default())
	if err == nil {
		t.Fatal("expected error for invalid JSON arguments")
	}
}

func TestGraphQLGetSchemaInvalidArgs(t *testing.T) {
	t.Parallel()

	g := NewGraphQLGetSchema(GraphQLConfig{URL: "http://localhost", Headers: http.Header{}})

	_, err := g.Execute(context.Background(), "not json", slog.Default())
	if err == nil {
		t.Fatal("expected error for invalid JSON arguments")
	}
}

func TestGraphQLQueryWithVariables(t *testing.T) {
	t.Parallel()

	var receivedBody map[string]any

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		json.Unmarshal(body, &receivedBody) //nolint:errcheck
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":{"user":{"id":"1"}}}`))
	}))
	defer srv.Close()

	g := &GraphQLQuery{
		config: GraphQLConfig{URL: srv.URL, Headers: http.Header{}},
		client: srv.Client(),
	}

	_, err := g.Execute(
		context.Background(),
		`{"query":"query ($id: uuid!) { user(id: $id) { id } }","variables":{"id":"1"}}`,
		slog.Default(),
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	vars, ok := receivedBody["variables"].(map[string]any)
	if !ok {
		t.Fatal("expected variables in request body")
	}

	if vars["id"] != "1" {
		t.Errorf("expected variable id=1, got %v", vars["id"])
	}
}

func TestGraphQLMutationDefinition(t *testing.T) {
	t.Parallel()

	g := NewGraphQLMutation(GraphQLConfig{URL: "http://localhost", Headers: http.Header{}})
	def := g.Definition()

	if def.Name != "graphql_mutation" {
		t.Errorf("expected name 'graphql_mutation', got %q", def.Name)
	}

	if def.Description == "" {
		t.Error("expected non-empty description")
	}

	props, ok := def.Parameters["properties"].(map[string]any)
	if !ok {
		t.Fatal("expected properties to be a map")
	}

	if _, ok := props["query"]; !ok {
		t.Error("expected 'query' property")
	}

	if _, ok := props["variables"]; !ok {
		t.Error("expected 'variables' property")
	}
}

func TestGraphQLMutationExecute(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":{"insert_users":{"affected_rows":1}}}`))
	}))
	defer srv.Close()

	g := &GraphQLMutation{
		config: GraphQLConfig{URL: srv.URL, Headers: http.Header{}},
		client: srv.Client(),
	}

	result, err := g.Execute(
		context.Background(),
		`{"query":"mutation { insert_users(objects: []) { affected_rows } }"}`,
		slog.Default(),
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(result, "affected_rows") {
		t.Errorf("expected result to contain 'affected_rows', got %q", result)
	}
}

func TestGraphQLMutationBlocksQuery(t *testing.T) {
	t.Parallel()

	g := NewGraphQLMutation(GraphQLConfig{URL: "http://localhost", Headers: http.Header{}})

	_, err := g.Execute(
		context.Background(),
		`{"query":"query { users { id } }"}`,
		slog.Default(),
	)
	if err == nil {
		t.Fatal("expected error for query in graphql_mutation, got nil")
	}

	if !strings.Contains(err.Error(), "graphql_query") {
		t.Errorf("expected error to mention graphql_query, got: %v", err)
	}
}

func TestGraphQLMutationBlocksSubscription(t *testing.T) {
	t.Parallel()

	g := NewGraphQLMutation(GraphQLConfig{URL: "http://localhost", Headers: http.Header{}})

	_, err := g.Execute(
		context.Background(),
		`{"query":"subscription { users { id } }"}`,
		slog.Default(),
	)
	if err == nil {
		t.Fatal("expected error for subscription, got nil")
	}

	if !strings.Contains(err.Error(), "subscriptions are not supported") {
		t.Errorf("expected subscription error, got: %v", err)
	}
}

func TestGraphQLMutationEmptyQuery(t *testing.T) {
	t.Parallel()

	g := NewGraphQLMutation(GraphQLConfig{URL: "http://localhost", Headers: http.Header{}})

	_, err := g.Execute(
		context.Background(),
		`{"query":""}`,
		slog.Default(),
	)
	if err == nil {
		t.Fatal("expected error for empty query, got nil")
	}
}

func TestGraphQLMutationInvalidArgs(t *testing.T) {
	t.Parallel()

	g := NewGraphQLMutation(GraphQLConfig{URL: "http://localhost", Headers: http.Header{}})

	_, err := g.Execute(context.Background(), "not json", slog.Default())
	if err == nil {
		t.Fatal("expected error for invalid JSON arguments")
	}
}

func TestGraphQLRejectsMultipleOperations(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		factory func() Tool
		query   string
	}{
		{
			name: "query tool rejects two query operations",
			factory: func() Tool {
				return NewGraphQLQuery(
					GraphQLConfig{URL: "http://localhost", Headers: http.Header{}},
				)
			},
			query: `query A { users { id } } query B { users { name } }`,
		},
		{
			name: "mutation tool rejects two mutation operations",
			factory: func() Tool {
				return NewGraphQLMutation(
					GraphQLConfig{URL: "http://localhost", Headers: http.Header{}},
				)
			},
			query: `mutation A { insert_users(objects: []) { affected_rows } } ` +
				`mutation B { delete_users(where: {}) { affected_rows } }`,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			args, err := json.Marshal(map[string]any{"query": tc.query})
			if err != nil {
				t.Fatalf("failed to marshal args: %v", err)
			}

			_, err = tc.factory().Execute(context.Background(), string(args), slog.Default())
			if err == nil {
				t.Fatal("expected error for multi-operation document, got nil")
			}

			if !strings.Contains(err.Error(), "exactly one operation") {
				t.Errorf("expected multi-operation error, got: %v", err)
			}
		})
	}
}

func TestGraphQLExecuteResponseSize(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name         string
		responseSize int
		wantErr      bool
	}{
		{
			name:         "response at limit",
			responseSize: graphqlMaxResponseSize,
		},
		{
			name:         "response over limit",
			responseSize: graphqlMaxResponseSize + 1,
			wantErr:      true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			response := `[]` + strings.Repeat(" ", tc.responseSize-2)

			srv := newGraphQLResponseServer(response)
			defer srv.Close()

			g := &GraphQLQuery{
				config: GraphQLConfig{URL: srv.URL, Headers: http.Header{}},
				client: srv.Client(),
			}

			result, err := g.Execute(
				context.Background(),
				`{"query":"query { users { id } }"}`,
				slog.Default(),
			)
			if tc.wantErr {
				if !errors.Is(err, errGraphQLResponseTooLarge) {
					t.Fatalf("expected response-too-large error, got: %v", err)
				}

				if !strings.Contains(err.Error(), "narrow the query or add pagination") {
					t.Errorf("expected actionable response-size error, got: %v", err)
				}

				if result != "" {
					t.Errorf("expected empty result on error, got %d bytes", len(result))
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if len(result) != tc.responseSize {
				t.Errorf("expected %d-byte result, got %d bytes", tc.responseSize, len(result))
			}
		})
	}
}

func TestGraphQLExecuteHTTPStatusErrors(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name        string
		status      int
		body        string
		wantInError string
	}{
		{
			name:        "401 unauthorized",
			status:      http.StatusUnauthorized,
			body:        `{"message":"unauthorized"}`,
			wantInError: "401",
		},
		{
			name:        "403 forbidden",
			status:      http.StatusForbidden,
			body:        `forbidden`,
			wantInError: "403",
		},
		{
			name:        "500 internal server error",
			status:      http.StatusInternalServerError,
			body:        `oops`,
			wantInError: "500",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			srv := httptest.NewServer(
				http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					w.WriteHeader(tc.status)
					_, _ = w.Write([]byte(tc.body))
				}),
			)
			defer srv.Close()

			g := &GraphQLQuery{
				config: GraphQLConfig{URL: srv.URL, Headers: http.Header{}},
				client: srv.Client(),
			}

			result, err := g.Execute(
				context.Background(),
				`{"query":"query { users { id } }"}`,
				slog.Default(),
			)
			if err == nil {
				t.Fatalf("expected error for status %d, got result: %q", tc.status, result)
			}

			if !strings.Contains(err.Error(), tc.wantInError) {
				t.Errorf("expected error to contain %q, got: %v", tc.wantInError, err)
			}

			if !strings.Contains(err.Error(), tc.body) {
				t.Errorf("expected error to contain body %q, got: %v", tc.body, err)
			}

			if result != "" {
				t.Errorf("expected empty result on error, got: %q", result)
			}
		})
	}
}
