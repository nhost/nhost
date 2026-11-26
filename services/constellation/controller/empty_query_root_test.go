package controller_test

import (
	"log/slog"
	"net/http"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/connector"
	"github.com/nhost/nhost/services/constellation/controller"
	"github.com/nhost/nhost/services/constellation/graph"
)

const emptyQueryMessage = "There are no queries available to the current role. Either there are no sources or remote schemas configured, or the current role doesn't have the required permissions."

func TestResolve_EmptyQueryRoot(t *testing.T) {
	t.Parallel()

	for _, tt := range []struct {
		role          string
		introspection string
		rootName      string
		schema        *graph.Schema
	}{
		{
			role: "writer", introspection: "mutationType", rootName: "mutation_root",
			schema: &graph.Schema{
				MutationType: new("mutation_root"),
				Types: []*graph.ObjectType{graphTestObject("mutation_root",
					graphTestField("insert_files", graph.NewNamedType("String")))},
				RestrictedReadRoots: true,
			},
		},
		{
			role: "streamer", introspection: "subscriptionType", rootName: "subscription_root",
			schema: &graph.Schema{
				SubscriptionType: new("subscription_root"),
				Types: []*graph.ObjectType{graphTestObject("subscription_root",
					graphTestField("files_stream", graph.NewNamedType("String")))},
				RestrictedReadRoots: true,
			},
		},
	} {
		t.Run(tt.role, func(t *testing.T) {
			t.Parallel()

			ctrl, err := controller.NewFromConnectors(
				testAdminSecret,
				map[string]connector.Connector{"db": staticConnector{
					schemas: map[string]*graph.Schema{tt.role: tt.schema},
				}},
				nil,
				slog.New(slog.DiscardHandler),
			)
			if err != nil {
				t.Fatalf("building controller: %v", err)
			}

			query := `{
				__schema { queryType { name fields { name description type { kind ofType { name } } } } ` +
				tt.introspection + ` { name } }
				... on query_root { message: no_queries_available }
				hidden: no_queries_available @skip(if: true)
			}`
			ctx := runSessionMiddleware(t, http.Header{
				"X-Hasura-Admin-Secret": {testAdminSecret}, "X-Hasura-Role": {tt.role},
			})

			resp, err := ctrl.Resolve(ctx, controller.GraphQLRequest{Query: query})
			if err != nil || resp.Errors != nil {
				t.Fatalf("resolving fallback query: %v, %+v", err, resp)
			}

			want := map[string]any{
				"__schema": map[string]any{
					"queryType": map[string]any{
						"name": "query_root", "fields": []map[string]any{
							{
								"name":        "no_queries_available",
								"description": new(emptyQueryMessage),
								"type": map[string]any{
									"kind":   "NON_NULL",
									"ofType": map[string]any{"name": "String"},
								},
							},
						},
					},
					tt.introspection: map[string]any{"name": tt.rootName},
				},
				"message": emptyQueryMessage,
			}
			if diff := cmp.Diff(want, resp.Data); diff != "" {
				t.Errorf("fallback response (-want +got):\n%s", diff)
			}
		})
	}
}

func TestResolve_EmptyQueryRootDoesNotShadowConnectorFields(t *testing.T) {
	t.Parallel()

	const (
		field          = "no_queries_available"
		connectorValue = "a real connector response"
	)

	ctrl, err := controller.NewFromConnectors(
		testAdminSecret,
		map[string]connector.Connector{"db": staticConnector{
			schemas: map[string]*graph.Schema{
				"public": {RestrictedReadRoots: true},
				"admin": {
					QueryType: new("query_root"),
					Types: []*graph.ObjectType{graphTestObject("query_root",
						graphTestField(field, graph.NewNamedType("String")))},
				},
			},
			execute: func() (map[string]any, error) {
				return map[string]any{field: connectorValue}, nil
			},
		}},
		nil,
		slog.New(slog.DiscardHandler),
	)
	if err != nil {
		t.Fatalf("building controller: %v", err)
	}

	for _, tt := range []struct{ role, want string }{
		{"public", emptyQueryMessage},
		{"admin", connectorValue},
	} {
		t.Run(tt.role, func(t *testing.T) {
			t.Parallel()

			ctx := runSessionMiddleware(t, http.Header{
				"X-Hasura-Admin-Secret": {testAdminSecret}, "X-Hasura-Role": {tt.role},
			})

			resp, err := ctrl.Resolve(
				ctx,
				controller.GraphQLRequest{Query: `{ __typename no_queries_available }`},
			)
			if err != nil || resp.Errors != nil {
				t.Fatalf("resolving query: %v, %+v", err, resp)
			}

			data, ok := resp.Data.(map[string]any)
			if !ok || data[field] != tt.want {
				t.Errorf("expected %q, got %v", tt.want, resp.Data)
			}
		})
	}
}

func TestResolve_NoFallbackWhenRoleHasQueries(t *testing.T) {
	t.Parallel()

	ctrl := newTestController(t)

	resp, err := ctrl.Resolve(
		adminSessionContext(t),
		controller.GraphQLRequest{Query: `{ no_queries_available }`},
	)
	if err != nil {
		t.Fatalf("resolving query: %v", err)
	}

	if resp.Errors == nil ||
		!strings.Contains(extractErrorMessage(t, resp), "no_queries_available") {
		t.Fatalf("expected the fallback field to fail validation, got %+v", resp)
	}
}
