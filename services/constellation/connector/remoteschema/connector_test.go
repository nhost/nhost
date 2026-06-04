package remoteschema_test

import (
	"context"
	json "encoding/json/v2"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/remoteschema"
	"github.com/nhost/nhost/services/constellation/connector/remoteschema/mock"
	"github.com/nhost/nhost/services/constellation/internal/requestcontext"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/vektah/gqlparser/v2/ast"
	"go.uber.org/mock/gomock"
)

// testIntrospectionResponse covers every kind handled by introspectionToGraphSchema:
// OBJECT (Query, Country, User, Post), INPUT_OBJECT (CountryFilter), INTERFACE
// (Node), UNION (SearchResult), and ENUM (Region). Coverage of all five kinds
// is load-bearing — without an INTERFACE/UNION/ENUM fixture the converter
// branches go untested.
const testIntrospectionResponse = `{
  "data": {
    "__schema": {
      "queryType": {"name": "Query"},
      "mutationType": null,
      "subscriptionType": null,
      "types": [
        {
          "kind": "OBJECT",
          "name": "Query",
          "description": "",
          "fields": [
            {
              "name": "countries",
              "description": "List all countries",
              "args": [
                {
                  "name": "filter",
                  "description": "",
                  "type": {"kind": "INPUT_OBJECT", "name": "CountryFilter", "ofType": null},
                  "defaultValue": null
                },
                {
                  "name": "region",
                  "description": "",
                  "type": {"kind": "ENUM", "name": "Region", "ofType": null},
                  "defaultValue": null
                }
              ],
              "type": {
                "kind": "NON_NULL",
                "name": null,
                "ofType": {
                  "kind": "LIST",
                  "name": null,
                  "ofType": {
                    "kind": "NON_NULL",
                    "name": null,
                    "ofType": {"kind": "OBJECT", "name": "Country", "ofType": null}
                  }
                }
              },
              "isDeprecated": false,
              "deprecationReason": null
            },
            {
              "name": "node",
              "description": "",
              "args": [],
              "type": {"kind": "INTERFACE", "name": "Node", "ofType": null},
              "isDeprecated": false,
              "deprecationReason": null
            },
            {
              "name": "search",
              "description": "",
              "args": [],
              "type": {
                "kind": "LIST",
                "name": null,
                "ofType": {"kind": "UNION", "name": "SearchResult", "ofType": null}
              },
              "isDeprecated": false,
              "deprecationReason": null
            }
          ],
          "inputFields": null,
          "interfaces": [],
          "enumValues": null,
          "possibleTypes": null
        },
        {
          "kind": "OBJECT",
          "name": "Country",
          "description": "",
          "fields": [
            {
              "name": "code",
              "description": "",
              "args": [],
              "type": {"kind": "NON_NULL", "name": null, "ofType": {"kind": "SCALAR", "name": "String", "ofType": null}},
              "isDeprecated": false,
              "deprecationReason": null
            },
            {
              "name": "name",
              "description": "",
              "args": [],
              "type": {"kind": "NON_NULL", "name": null, "ofType": {"kind": "SCALAR", "name": "String", "ofType": null}},
              "isDeprecated": false,
              "deprecationReason": null
            }
          ],
          "inputFields": null,
          "interfaces": [],
          "enumValues": null,
          "possibleTypes": null
        },
        {
          "kind": "INPUT_OBJECT",
          "name": "CountryFilter",
          "description": "",
          "fields": null,
          "inputFields": [
            {
              "name": "code",
              "description": "",
              "type": {"kind": "SCALAR", "name": "String", "ofType": null},
              "defaultValue": null
            }
          ],
          "interfaces": null,
          "enumValues": null,
          "possibleTypes": null
        },
        {
          "kind": "INTERFACE",
          "name": "Node",
          "description": "",
          "fields": [
            {
              "name": "id",
              "description": "",
              "args": [],
              "type": {"kind": "NON_NULL", "name": null, "ofType": {"kind": "SCALAR", "name": "ID", "ofType": null}},
              "isDeprecated": false,
              "deprecationReason": null
            }
          ],
          "inputFields": null,
          "interfaces": [],
          "enumValues": null,
          "possibleTypes": [
            {"kind": "OBJECT", "name": "User", "ofType": null},
            {"kind": "OBJECT", "name": "Post", "ofType": null}
          ]
        },
        {
          "kind": "OBJECT",
          "name": "User",
          "description": "",
          "fields": [
            {
              "name": "id",
              "description": "",
              "args": [],
              "type": {"kind": "NON_NULL", "name": null, "ofType": {"kind": "SCALAR", "name": "ID", "ofType": null}},
              "isDeprecated": false,
              "deprecationReason": null
            }
          ],
          "inputFields": null,
          "interfaces": [
            {"kind": "INTERFACE", "name": "Node", "ofType": null}
          ],
          "enumValues": null,
          "possibleTypes": null
        },
        {
          "kind": "OBJECT",
          "name": "Post",
          "description": "",
          "fields": [
            {
              "name": "id",
              "description": "",
              "args": [],
              "type": {"kind": "NON_NULL", "name": null, "ofType": {"kind": "SCALAR", "name": "ID", "ofType": null}},
              "isDeprecated": false,
              "deprecationReason": null
            }
          ],
          "inputFields": null,
          "interfaces": [
            {"kind": "INTERFACE", "name": "Node", "ofType": null}
          ],
          "enumValues": null,
          "possibleTypes": null
        },
        {
          "kind": "UNION",
          "name": "SearchResult",
          "description": "",
          "fields": null,
          "inputFields": null,
          "interfaces": null,
          "enumValues": null,
          "possibleTypes": [
            {"kind": "OBJECT", "name": "User", "ofType": null},
            {"kind": "OBJECT", "name": "Post", "ofType": null}
          ]
        },
        {
          "kind": "ENUM",
          "name": "Region",
          "description": "",
          "fields": null,
          "inputFields": null,
          "interfaces": null,
          "enumValues": [
            {"name": "AMERICAS", "description": "", "isDeprecated": false, "deprecationReason": null},
            {"name": "EMEA", "description": "", "isDeprecated": false, "deprecationReason": null}
          ],
          "possibleTypes": null
        }
      ]
    }
  }
}`

const interfaceOnlyIntrospectionResponse = `{
  "data": {
    "__schema": {
      "queryType": {"name": "Query"},
      "mutationType": null,
      "subscriptionType": null,
      "types": [
        {
          "kind": "OBJECT",
          "name": "Query",
          "description": "",
          "fields": [
            {
              "name": "node",
              "description": "",
              "args": [],
              "type": {"kind": "INTERFACE", "name": "Node", "ofType": null},
              "isDeprecated": false,
              "deprecationReason": null
            }
          ],
          "inputFields": null,
          "interfaces": [],
          "enumValues": null,
          "possibleTypes": null
        },
        {
          "kind": "INTERFACE",
          "name": "Node",
          "description": "",
          "fields": [
            {
              "name": "id",
              "description": "",
              "args": [],
              "type": {"kind": "NON_NULL", "name": null, "ofType": {"kind": "SCALAR", "name": "ID", "ofType": null}},
              "isDeprecated": false,
              "deprecationReason": null
            }
          ],
          "inputFields": null,
          "interfaces": [],
          "enumValues": null,
          "possibleTypes": [
            {"kind": "OBJECT", "name": "User", "ofType": null},
            {"kind": "OBJECT", "name": "Post", "ofType": null}
          ]
        },
        {
          "kind": "OBJECT",
          "name": "User",
          "description": "",
          "fields": [
            {
              "name": "id",
              "description": "",
              "args": [],
              "type": {"kind": "NON_NULL", "name": null, "ofType": {"kind": "SCALAR", "name": "ID", "ofType": null}},
              "isDeprecated": false,
              "deprecationReason": null
            }
          ],
          "inputFields": null,
          "interfaces": [
            {"kind": "INTERFACE", "name": "Node", "ofType": null}
          ],
          "enumValues": null,
          "possibleTypes": null
        },
        {
          "kind": "OBJECT",
          "name": "Post",
          "description": "",
          "fields": [
            {
              "name": "id",
              "description": "",
              "args": [],
              "type": {"kind": "NON_NULL", "name": null, "ofType": {"kind": "SCALAR", "name": "ID", "ofType": null}},
              "isDeprecated": false,
              "deprecationReason": null
            }
          ],
          "inputFields": null,
          "interfaces": [
            {"kind": "INTERFACE", "name": "Node", "ofType": null}
          ],
          "enumValues": null,
          "possibleTypes": null
        },
        {
          "kind": "OBJECT",
          "name": "Orphan",
          "description": "",
          "fields": [
            {
              "name": "id",
              "description": "",
              "args": [],
              "type": {"kind": "NON_NULL", "name": null, "ofType": {"kind": "SCALAR", "name": "ID", "ofType": null}},
              "isDeprecated": false,
              "deprecationReason": null
            }
          ],
          "inputFields": null,
          "interfaces": [],
          "enumValues": null,
          "possibleTypes": null
        }
      ]
    }
  }
}`

func newTestServer(t *testing.T) *httptest.Server {
	t.Helper()

	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		writeOrFail(t, w, []byte(testIntrospectionResponse))
	}))
}

// writeOrFail writes the payload to w and surfaces any failure through
// t.Errorf rather than swallowing it; a half-written response otherwise turns
// into misleading assertion failures further down the test.
func writeOrFail(t *testing.T, w http.ResponseWriter, payload []byte) {
	t.Helper()

	if _, err := w.Write(payload); err != nil {
		t.Errorf("writing response: %v", err)
	}
}

// readAllOrFail reads r to EOF and fails the test if the read errors. Test
// handlers that ignore io.ReadAll errors can return stale or partial bodies
// that produce confusing downstream assertion mismatches.
func readAllOrFail(t *testing.T, r io.Reader) []byte {
	t.Helper()

	body, err := io.ReadAll(r)
	if err != nil {
		t.Errorf("reading body: %v", err)
	}

	return body
}

func newTestMetadata(
	url string, permissions []metadata.RemoteSchemaPermission,
) *metadata.RemoteSchemaMetadata {
	return &metadata.RemoteSchemaMetadata{
		Name: "test-remote",
		Definition: metadata.RemoteSchemaDefinition{
			URL:                  metadata.EnvString(url),
			TimeoutSeconds:       60,
			Customization:        metadata.Customization{},
			Headers:              nil,
			ForwardClientHeaders: false,
		},
		Comment:             "",
		Permissions:         permissions,
		RemoteRelationships: nil,
	}
}

func TestNew(t *testing.T) { //nolint:gocognit,cyclop,gocyclo,maintidx
	t.Parallel()

	t.Run("introspects remote and returns connector", func(t *testing.T) {
		t.Parallel()

		server := newTestServer(t)
		defer server.Close()

		meta := newTestMetadata(server.URL, nil)

		connector, err := remoteschema.New(context.Background(), meta, nil)
		if err != nil {
			t.Fatalf("New() error: %v", err)
		}

		schemas, err := connector.GetSchema()
		if err != nil {
			t.Fatalf("GetSchema() error: %v", err)
		}

		adminSchema, ok := schemas["admin"]
		if !ok {
			t.Fatal("expected admin schema")
		}

		if adminSchema.QueryType == nil || *adminSchema.QueryType != "Query" {
			t.Error("expected QueryType to be 'Query'")
		}

		// Verify every introspection kind round-tripped into graph.Schema:
		// INTERFACE, UNION, and ENUM exercise converter branches that have
		// no SDL-path equivalent in tests.
		var (
			gotNodeIface   bool
			gotSearchUnion bool
			gotRegionEnum  bool
		)

		for _, iface := range adminSchema.Interfaces {
			if iface.Name == "Node" {
				gotNodeIface = true
			}
		}

		for _, u := range adminSchema.Unions {
			if u.Name == "SearchResult" && len(u.Types) == 2 {
				gotSearchUnion = true
			}
		}

		for _, e := range adminSchema.Enums {
			if e.Name == "Region" && len(e.Values) == 2 {
				gotRegionEnum = true
			}
		}

		if !gotNodeIface {
			t.Error("expected Node interface in admin schema")
		}

		if !gotSearchUnion {
			t.Error("expected SearchResult union (2 members) in admin schema")
		}

		if !gotRegionEnum {
			t.Error("expected Region enum (2 values) in admin schema")
		}
	})

	t.Run("keeps interface-only implementors in admin schema", func(t *testing.T) {
		t.Parallel()

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			writeOrFail(t, w, []byte(interfaceOnlyIntrospectionResponse))
		}))
		defer server.Close()

		connector, err := remoteschema.New(
			context.Background(), newTestMetadata(server.URL, nil), nil,
		)
		if err != nil {
			t.Fatalf("New() error: %v", err)
		}

		schemas, err := connector.GetSchema()
		if err != nil {
			t.Fatalf("GetSchema() error: %v", err)
		}

		adminSchema := schemas[metadata.RoleAdmin]
		if adminSchema == nil {
			t.Fatal("expected admin schema")
		}

		typeNames := make(map[string]struct{}, len(adminSchema.Types))
		for _, typ := range adminSchema.Types {
			typeNames[typ.Name] = struct{}{}
		}

		for _, name := range []string{"Query", "User", "Post"} {
			if _, ok := typeNames[name]; !ok {
				t.Errorf("expected %s to survive pruning", name)
			}
		}

		if _, ok := typeNames["Orphan"]; ok {
			t.Error("expected Orphan to be pruned")
		}
	})

	t.Run("parses SDL permissions for non-admin roles", func(t *testing.T) {
		t.Parallel()

		server := newTestServer(t)
		defer server.Close()

		sdl := `
			type Query {
				countries(filter: CountryFilter @preset(value: "US")): [Country!]!
			}
			type Country {
				code: String!
				name: String!
			}
			input CountryFilter {
				code: String
			}
		`

		meta := newTestMetadata(server.URL, []metadata.RemoteSchemaPermission{
			{
				Role: "user",
				Definition: metadata.RemoteSchemaPermissionDef{
					Schema: sdl,
				},
			},
		})

		connector, err := remoteschema.New(context.Background(), meta, nil)
		if err != nil {
			t.Fatalf("New() error: %v", err)
		}

		schemas, err := connector.GetSchema()
		if err != nil {
			t.Fatalf("GetSchema() error: %v", err)
		}

		if _, ok := schemas["user"]; !ok {
			t.Error("expected user schema")
		}

		if _, ok := schemas["admin"]; !ok {
			t.Error("expected admin schema")
		}
	})

	t.Run("skips admin role in permissions", func(t *testing.T) {
		t.Parallel()

		server := newTestServer(t)
		defer server.Close()

		meta := newTestMetadata(server.URL, []metadata.RemoteSchemaPermission{
			{
				Role: "admin",
				Definition: metadata.RemoteSchemaPermissionDef{
					Schema: `type Query { countries: [Country!]! } type Country { code: String! }`,
				},
			},
		})

		connector, err := remoteschema.New(context.Background(), meta, nil)
		if err != nil {
			t.Fatalf("New() error: %v", err)
		}

		schemas, _ := connector.GetSchema()
		// Admin schema should come from introspection, not SDL
		adminSchema := schemas["admin"]

		var hasCountryFilter bool
		for _, inp := range adminSchema.Inputs {
			if inp.Name == "CountryFilter" {
				hasCountryFilter = true
			}
		}

		if !hasCountryFilter {
			t.Error("admin schema should come from introspection (has CountryFilter input)")
		}
	})

	t.Run("returns error on introspection failure", func(t *testing.T) {
		t.Parallel()

		server := httptest.NewServer(http.HandlerFunc(
			func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(http.StatusInternalServerError)
				writeOrFail(t, w, []byte("server error"))
			},
		))
		defer server.Close()

		meta := newTestMetadata(server.URL, nil)

		_, err := remoteschema.New(context.Background(), meta, nil)
		if err == nil {
			t.Fatal("expected error on introspection failure")
		}
	})

	// Drives the GraphQL-errors branch of introspectRemoteSchema
	// (introspect.go:127-134): the HTTP transport succeeded with 200 OK but
	// the response body carries top-level `errors`. New must surface those
	// errors instead of treating the empty data block as a valid schema.
	t.Run("returns error when introspection response contains GraphQL errors", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		mockDoer := mock.NewMockHTTPDoer(ctrl)

		mockDoer.EXPECT().Do(gomock.Any()).Return(&http.Response{
			StatusCode: http.StatusOK,
			Body: io.NopCloser(strings.NewReader(
				`{"data":null,"errors":[` +
					`{"message":"introspection disabled"},` +
					`{"message":"forbidden"}` +
					`]}`,
			)),
		}, nil)

		_, err := remoteschema.New(
			context.Background(),
			newTestMetadata("http://example.com", nil),
			mockDoer,
		)
		if err == nil {
			t.Fatal("expected error when introspection returns GraphQL errors")
		}

		if !strings.Contains(err.Error(), "introspection disabled") ||
			!strings.Contains(err.Error(), "forbidden") {
			t.Errorf("expected error to include all GraphQL error messages, got: %v", err)
		}
	})

	// Drives the malformed-JSON branch of introspectRemoteSchema
	// (introspect.go:120-125): a 200 OK with a body that fails json.Unmarshal
	// must surface as a parse error from New, not as a silently empty schema.
	t.Run("returns error when introspection response is malformed JSON", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		mockDoer := mock.NewMockHTTPDoer(ctrl)

		mockDoer.EXPECT().Do(gomock.Any()).Return(&http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(strings.NewReader("not json {")),
		}, nil)

		_, err := remoteschema.New(
			context.Background(),
			newTestMetadata("http://example.com", nil),
			mockDoer,
		)
		if err == nil {
			t.Fatal("expected error on malformed introspection JSON")
		}

		if !strings.Contains(err.Error(), "parse introspection response") {
			t.Errorf("expected parse-introspection error, got: %v", err)
		}
	})

	t.Run("returns error on invalid SDL", func(t *testing.T) {
		t.Parallel()

		server := newTestServer(t)
		defer server.Close()

		meta := newTestMetadata(server.URL, []metadata.RemoteSchemaPermission{
			{
				Role:       "user",
				Definition: metadata.RemoteSchemaPermissionDef{Schema: "not valid { graphql"},
			},
		})

		_, err := remoteschema.New(context.Background(), meta, nil)
		if err == nil {
			t.Fatal("expected error on invalid SDL")
		}
	})

	t.Run("uses default timeout when not specified", func(t *testing.T) {
		t.Parallel()

		server := newTestServer(t)
		defer server.Close()

		meta := newTestMetadata(server.URL, nil)
		meta.Definition.TimeoutSeconds = 0

		connector, err := remoteschema.New(context.Background(), meta, nil)
		if err != nil {
			t.Fatalf("New() error: %v", err)
		}

		if connector == nil {
			t.Fatal("expected non-nil connector")
		}
	})
}

func TestGetTypeName(t *testing.T) {
	t.Parallel()

	t.Run("returns type name for known field", func(t *testing.T) {
		t.Parallel()

		server := newTestServer(t)
		defer server.Close()

		connector, err := remoteschema.New(
			context.Background(),
			newTestMetadata(server.URL, nil),
			nil,
		)
		if err != nil {
			t.Fatalf("New() error: %v", err)
		}

		typeName := connector.GetTypeName("countries")
		if typeName != "Country" {
			t.Errorf("expected Country, got %s", typeName)
		}
	})

	t.Run("returns empty for unknown field", func(t *testing.T) {
		t.Parallel()

		server := newTestServer(t)
		defer server.Close()

		connector, err := remoteschema.New(
			context.Background(),
			newTestMetadata(server.URL, nil),
			nil,
		)
		if err != nil {
			t.Fatalf("New() error: %v", err)
		}

		typeName := connector.GetTypeName("nonexistent")
		if typeName != "" {
			t.Errorf("expected empty string, got %s", typeName)
		}
	})
}

func TestClose(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	mockDoer := mock.NewMockHTTPDoer(ctrl)

	connector := newMockConnector(t, mockDoer)

	// Close is a no-op, should not panic.
	connector.Close()

	// Calling Close twice is also safe.
	connector.Close()
}

func TestValidateOperation(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	mockDoer := mock.NewMockHTTPDoer(ctrl)

	// newMockConnector primes only the introspection HTTP call; no further Do
	// expectation is set, so gomock fails the test if ValidateOperation makes
	// any network call. Remote schemas have no pre-execution validation and must
	// return nil without contacting the endpoint.
	connector := newMockConnector(t, mockDoer)

	op := &ast.OperationDefinition{
		Operation:    ast.Query,
		SelectionSet: ast.SelectionSet{&ast.Field{Name: "test"}},
	}

	if err := connector.ValidateOperation(op, nil, nil, "admin", nil); err != nil {
		t.Fatalf("ValidateOperation must be a no-op returning nil, got: %v", err)
	}
}

func TestExecute_BlackBox(t *testing.T) { //nolint:gocognit,cyclop,maintidx
	t.Parallel()

	t.Run("full path through New", func(t *testing.T) {
		t.Parallel()

		var receivedQuery string

		mux := http.NewServeMux()
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			bodyStr := string(readAllOrFail(t, r.Body))

			if strings.Contains(bodyStr, "IntrospectionQuery") ||
				strings.Contains(bodyStr, "__schema") {
				w.Header().Set("Content-Type", "application/json")
				writeOrFail(t, w, []byte(testIntrospectionResponse))

				return
			}

			receivedQuery = bodyStr

			w.Header().Set("Content-Type", "application/json")
			writeOrFail(
				t, w,
				[]byte(`{"data":{"countries":[{"code":"US","name":"United States"}]}}`),
			)
		})

		server := httptest.NewServer(mux)
		defer server.Close()

		connector, err := remoteschema.New(
			context.Background(), newTestMetadata(server.URL, nil), nil,
		)
		if err != nil {
			t.Fatalf("New() error: %v", err)
		}

		op := &ast.OperationDefinition{
			Operation: ast.Query,
			SelectionSet: ast.SelectionSet{
				&ast.Field{
					Name: "countries",
					SelectionSet: ast.SelectionSet{
						&ast.Field{Name: "code"},
						&ast.Field{Name: "name"},
					},
				},
			},
		}

		result, err := connector.Execute(
			context.Background(), op, nil, nil, "admin", nil, slog.Default(),
		)
		if err != nil {
			t.Fatalf("Execute error: %v", err)
		}

		if result["countries"] == nil {
			t.Error("expected countries in result")
		}

		if receivedQuery == "" {
			t.Error("expected query to be sent to server")
		}
	})

	t.Run("with client headers forwarding", func(t *testing.T) {
		t.Parallel()

		var receivedHeaders http.Header

		mux := http.NewServeMux()
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			bodyStr := string(readAllOrFail(t, r.Body))

			if strings.Contains(bodyStr, "IntrospectionQuery") ||
				strings.Contains(bodyStr, "__schema") {
				w.Header().Set("Content-Type", "application/json")
				writeOrFail(t, w, []byte(testIntrospectionResponse))

				return
			}

			receivedHeaders = r.Header.Clone()
			w.Header().Set("Content-Type", "application/json")
			writeOrFail(t, w, []byte(`{"data":{"countries":[]}}`))
		})

		server := httptest.NewServer(mux)
		defer server.Close()

		meta := newTestMetadata(server.URL, nil)
		meta.Definition.ForwardClientHeaders = true

		connector, err := remoteschema.New(context.Background(), meta, nil)
		if err != nil {
			t.Fatalf("New() error: %v", err)
		}

		op := &ast.OperationDefinition{
			Operation: ast.Query,
			SelectionSet: ast.SelectionSet{
				&ast.Field{Name: "countries"},
			},
		}

		clientHeaders := http.Header{"Authorization": {"Bearer test-token"}}
		ctx := requestcontext.ClientHeadersToContext(context.Background(), clientHeaders)

		_, err = connector.Execute(ctx, op, nil, nil, "admin", nil, slog.Default())
		if err != nil {
			t.Fatalf("Execute error: %v", err)
		}

		if receivedHeaders.Get("Authorization") != "Bearer test-token" {
			t.Errorf(
				"expected forwarded Authorization header, got %s",
				receivedHeaders.Get("Authorization"),
			)
		}
	})

	t.Run("remote GraphQL errors returned in result", func(t *testing.T) {
		t.Parallel()

		mux := http.NewServeMux()
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			bodyStr := string(readAllOrFail(t, r.Body))

			if strings.Contains(bodyStr, "IntrospectionQuery") ||
				strings.Contains(bodyStr, "__schema") {
				w.Header().Set("Content-Type", "application/json")
				writeOrFail(t, w, []byte(testIntrospectionResponse))

				return
			}

			w.Header().Set("Content-Type", "application/json")
			writeOrFail(t, w, []byte(
				`{"data":{"countries":[{"code":"US","name":"USA"}]},"errors":[{"message":"field not found","path":["countries",0,"name"]}]}`,
			))
		})

		server := httptest.NewServer(mux)
		defer server.Close()

		connector, err := remoteschema.New(
			context.Background(), newTestMetadata(server.URL, nil), nil,
		)
		if err != nil {
			t.Fatalf("New() error: %v", err)
		}

		op := &ast.OperationDefinition{
			Operation: ast.Query,
			SelectionSet: ast.SelectionSet{
				&ast.Field{Name: "countries"},
			},
		}

		result, err := connector.Execute(
			context.Background(), op, nil, nil, "admin", nil, slog.Default(),
		)

		var gqlErrs *remoteschema.GraphQLError
		if !errors.As(err, &gqlErrs) {
			t.Fatalf("expected GraphQLErrors, got: %v", err)
		}

		if len(gqlErrs.Errors) != 1 {
			t.Fatalf("expected 1 error, got %d", len(gqlErrs.Errors))
		}

		if gqlErrs.Errors[0].Message != "field not found" {
			t.Errorf("expected 'field not found', got %v", gqlErrs.Errors[0].Message)
		}

		countries, ok := result["countries"].([]any)
		if !ok || len(countries) != 1 {
			t.Fatalf("expected partial countries data, got %#v", result)
		}
	})

	t.Run("wraps error with connector name", func(t *testing.T) {
		t.Parallel()

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			bodyStr := string(readAllOrFail(t, r.Body))

			if strings.Contains(bodyStr, "IntrospectionQuery") ||
				strings.Contains(bodyStr, "__schema") {
				w.Header().Set("Content-Type", "application/json")
				writeOrFail(t, w, []byte(testIntrospectionResponse))

				return
			}

			w.WriteHeader(http.StatusInternalServerError)
			writeOrFail(t, w, []byte("boom"))
		}))
		defer server.Close()

		connector, err := remoteschema.New(
			context.Background(), newTestMetadata(server.URL, nil), nil,
		)
		if err != nil {
			t.Fatalf("New() error: %v", err)
		}

		op := &ast.OperationDefinition{
			Operation: ast.Query,
			SelectionSet: ast.SelectionSet{
				&ast.Field{Name: "test"},
			},
		}

		_, err = connector.Execute(
			context.Background(), op, nil, nil, "admin", nil, slog.Default(),
		)
		if err == nil {
			t.Fatal("expected error")
		}

		if !strings.Contains(err.Error(), "test-remote") {
			t.Errorf("expected error to contain connector name, got: %v", err)
		}
	})
}

// newMockConnector constructs a Connector through New using the supplied mock
// doer. The first Do call (admin introspection during New) is wired up to
// return testIntrospectionResponse; the caller adds further EXPECT calls,
// chained with gomock.InOrder, to drive subsequent Execute behavior.
func newMockConnector(
	t *testing.T,
	mockDoer *mock.MockHTTPDoer,
	executeExpectations ...any,
) *remoteschema.Connector {
	t.Helper()

	introspectionCall := mockDoer.EXPECT().Do(gomock.Any()).Return(&http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(testIntrospectionResponse)),
	}, nil)

	calls := append([]any{introspectionCall}, executeExpectations...)
	gomock.InOrder(calls...)

	conn, err := remoteschema.New(
		context.Background(),
		newTestMetadata("http://example.com", nil),
		mockDoer,
	)
	if err != nil {
		t.Fatalf("New() error: %v", err)
	}

	return conn
}

func TestExecute_MockHTTP(t *testing.T) {
	t.Parallel()

	t.Run("request creation failure", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		mockDoer := mock.NewMockHTTPDoer(ctrl)

		executeCall := mockDoer.EXPECT().
			Do(gomock.Any()).
			Return(nil, http.ErrServerClosed)

		connector := newMockConnector(t, mockDoer, executeCall)

		op := &ast.OperationDefinition{
			Operation: ast.Query,
			SelectionSet: ast.SelectionSet{
				&ast.Field{Name: "test"},
			},
		}

		result, err := connector.Execute(
			context.Background(), op, nil, nil, "admin", nil, slog.Default(),
		)
		if err == nil {
			t.Fatal("expected error")
		}

		if result != nil {
			t.Fatalf("expected nil result on transport error, got %#v", result)
		}

		if !strings.Contains(err.Error(), "test-remote") {
			t.Errorf("expected error to contain connector name, got: %v", err)
		}
	})

	t.Run("response read failure", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		mockDoer := mock.NewMockHTTPDoer(ctrl)

		executeCall := mockDoer.EXPECT().
			Do(gomock.Any()).
			Return(&http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(&failingReader{}),
			}, nil)

		connector := newMockConnector(t, mockDoer, executeCall)

		op := &ast.OperationDefinition{
			Operation: ast.Query,
			SelectionSet: ast.SelectionSet{
				&ast.Field{Name: "test"},
			},
		}

		result, err := connector.Execute(
			context.Background(), op, nil, nil, "admin", nil, slog.Default(),
		)
		if err == nil {
			t.Fatal("expected error from read failure")
		}

		if result != nil {
			t.Fatalf("expected nil result on read failure, got %#v", result)
		}
	})

	t.Run("malformed JSON response", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		mockDoer := mock.NewMockHTTPDoer(ctrl)

		executeCall := mockDoer.EXPECT().
			Do(gomock.Any()).
			Return(&http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader("not json")),
			}, nil)

		connector := newMockConnector(t, mockDoer, executeCall)

		op := &ast.OperationDefinition{
			Operation: ast.Query,
			SelectionSet: ast.SelectionSet{
				&ast.Field{Name: "test"},
			},
		}

		result, err := connector.Execute(
			context.Background(), op, nil, nil, "admin", nil, slog.Default(),
		)
		if err == nil {
			t.Fatal("expected error from malformed JSON")
		}

		if result != nil {
			t.Fatalf("expected nil result on malformed JSON, got %#v", result)
		}
	})

	t.Run("non-200 status code", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		mockDoer := mock.NewMockHTTPDoer(ctrl)

		executeCall := mockDoer.EXPECT().
			Do(gomock.Any()).
			Return(&http.Response{
				StatusCode: http.StatusBadGateway,
				Body:       io.NopCloser(strings.NewReader("bad gateway")),
			}, nil)

		connector := newMockConnector(t, mockDoer, executeCall)

		op := &ast.OperationDefinition{
			Operation: ast.Query,
			SelectionSet: ast.SelectionSet{
				&ast.Field{Name: "test"},
			},
		}

		result, err := connector.Execute(
			context.Background(), op, nil, nil, "admin", nil, slog.Default(),
		)
		if err == nil {
			t.Fatal("expected error from non-200 status")
		}

		if result != nil {
			t.Fatalf("expected nil result on non-200 status, got %#v", result)
		}

		if !strings.Contains(err.Error(), "502") {
			t.Errorf("expected error to mention status code, got: %v", err)
		}
	})
}

// failingReader is an io.Reader that always returns an error.
type failingReader struct{}

func (f *failingReader) Read(_ []byte) (int, error) {
	return 0, io.ErrUnexpectedEOF
}

// TestExecute_AppliesPresets wires up a non-admin role whose SDL has a
// @preset-bearing argument and asserts the outgoing query, captured via the
// mock doer, carries the injected argument value from session variables.
// This is the load-bearing role-scoped-argument-injection path; the rest of
// the mock-based suite only exercises the admin (no-preset) fast path.
func TestExecute_AppliesPresets(t *testing.T) {
	t.Parallel()

	const userSDL = `
		type Query {
			getUser(userId: String @preset(value: "x-hasura-user-id")): User
		}
		type User {
			id: String
		}
	`

	ctrl := gomock.NewController(t)
	mockDoer := mock.NewMockHTTPDoer(ctrl)

	introspectionCall := mockDoer.EXPECT().Do(gomock.Any()).Return(&http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(testIntrospectionResponse)),
	}, nil)

	var capturedBody string

	executeCall := mockDoer.EXPECT().Do(gomock.Any()).DoAndReturn(
		func(req *http.Request) (*http.Response, error) {
			capturedBody = string(readAllOrFail(t, req.Body))

			return &http.Response{
				StatusCode: http.StatusOK,
				Body: io.NopCloser(strings.NewReader(
					`{"data":{"getUser":{"id":"user-abc"}}}`,
				)),
			}, nil
		},
	)

	gomock.InOrder(introspectionCall, executeCall)

	meta := newTestMetadata("http://example.com", []metadata.RemoteSchemaPermission{
		{
			Role: "user",
			Definition: metadata.RemoteSchemaPermissionDef{
				Schema: userSDL,
			},
		},
	})

	connector, err := remoteschema.New(context.Background(), meta, mockDoer)
	if err != nil {
		t.Fatalf("New() error: %v", err)
	}

	op := &ast.OperationDefinition{
		Operation: ast.Query,
		SelectionSet: ast.SelectionSet{
			&ast.Field{
				Name: "getUser",
				SelectionSet: ast.SelectionSet{
					&ast.Field{Name: "id"},
				},
			},
		},
	}

	sessionVars := map[string]any{
		"x-hasura-user-id": "user-abc",
	}

	result, err := connector.Execute(
		context.Background(), op, nil, nil, "user", sessionVars, slog.Default(),
	)
	if err != nil {
		t.Fatalf("Execute error: %v", err)
	}

	if !strings.Contains(capturedBody, `userId:\"user-abc\"`) &&
		!strings.Contains(capturedBody, `userId: \"user-abc\"`) {
		t.Errorf(
			"expected preset-injected userId argument in outgoing query, got: %s",
			capturedBody,
		)
	}

	user, ok := result["getUser"].(map[string]any)
	if !ok {
		t.Fatalf("expected getUser in result, got %#v", result)
	}

	if user["id"] != "user-abc" {
		t.Errorf("expected id=user-abc, got %v", user["id"])
	}
}

func TestExecute_AppliesTypedPresets(t *testing.T) {
	t.Parallel()

	const userSDL = `
		type Query {
			topGames(
				limit: Int! @preset(value: 3)
				includeStats: Boolean! @preset(value: true)
				source: Source! @preset(value: OFFICIAL)
			): [Game!]!
		}
		type Game {
			id: ID!
		}
		enum Source {
			OFFICIAL
			USER_REPORTED
		}
	`

	ctrl := gomock.NewController(t)
	mockDoer := mock.NewMockHTTPDoer(ctrl)

	introspectionCall := mockDoer.EXPECT().Do(gomock.Any()).Return(&http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(testIntrospectionResponse)),
	}, nil)

	var capturedBody string

	executeCall := mockDoer.EXPECT().Do(gomock.Any()).DoAndReturn(
		func(req *http.Request) (*http.Response, error) {
			capturedBody = string(readAllOrFail(t, req.Body))

			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(`{"data":{"topGames":[]}}`)),
			}, nil
		},
	)

	gomock.InOrder(introspectionCall, executeCall)

	meta := newTestMetadata("http://example.com", []metadata.RemoteSchemaPermission{
		{
			Role: "user",
			Definition: metadata.RemoteSchemaPermissionDef{
				Schema: userSDL,
			},
		},
	})

	connector, err := remoteschema.New(context.Background(), meta, mockDoer)
	if err != nil {
		t.Fatalf("New() error: %v", err)
	}

	op := &ast.OperationDefinition{
		Operation: ast.Query,
		SelectionSet: ast.SelectionSet{
			&ast.Field{
				Name: "topGames",
				SelectionSet: ast.SelectionSet{
					&ast.Field{Name: "id"},
				},
			},
		},
	}

	_, err = connector.Execute(
		context.Background(), op, nil, nil, "user", nil, slog.Default(),
	)
	if err != nil {
		t.Fatalf("Execute error: %v", err)
	}

	for _, want := range []string{"limit:3", "includeStats:true", "source:OFFICIAL"} {
		if !strings.Contains(capturedBody, want) &&
			!strings.Contains(capturedBody, strings.ReplaceAll(want, ":", ": ")) {
			t.Errorf("expected %s in outgoing query, got: %s", want, capturedBody)
		}
	}

	for _, unwanted := range []string{`limit:\"3\"`, `includeStats:\"true\"`, `source:\"OFFICIAL\"`} {
		if strings.Contains(capturedBody, unwanted) {
			t.Errorf("expected typed preset to be unquoted; found %s in %s", unwanted, capturedBody)
		}
	}
}

func TestExecute_AppliesAllowedRolesListPreset(t *testing.T) {
	t.Parallel()

	const userSDL = `
		type Query {
			games(roles: [String!]! @preset(value: "x-hasura-allowed-roles")): [Game!]!
		}
		type Game {
			id: ID!
		}
	`

	ctrl := gomock.NewController(t)
	mockDoer := mock.NewMockHTTPDoer(ctrl)

	introspectionCall := mockDoer.EXPECT().Do(gomock.Any()).Return(&http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(testIntrospectionResponse)),
	}, nil)

	var capturedQuery string

	executeCall := mockDoer.EXPECT().Do(gomock.Any()).DoAndReturn(
		func(req *http.Request) (*http.Response, error) {
			body := readAllOrFail(t, req.Body)

			var gqlReq struct {
				Query string `json:"query"`
			}
			if err := json.Unmarshal(body, &gqlReq); err != nil {
				t.Fatalf("unmarshalling GraphQL request: %v", err)
			}

			capturedQuery = gqlReq.Query

			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(`{"data":{"games":[]}}`)),
			}, nil
		},
	)

	gomock.InOrder(introspectionCall, executeCall)

	meta := newTestMetadata("http://example.com", []metadata.RemoteSchemaPermission{
		{
			Role: "user",
			Definition: metadata.RemoteSchemaPermissionDef{
				Schema: userSDL,
			},
		},
	})

	connector, err := remoteschema.New(context.Background(), meta, mockDoer)
	if err != nil {
		t.Fatalf("New() error: %v", err)
	}

	op := &ast.OperationDefinition{
		Operation: ast.Query,
		SelectionSet: ast.SelectionSet{
			&ast.Field{
				Name: "games",
				SelectionSet: ast.SelectionSet{
					&ast.Field{Name: "id"},
				},
			},
		},
	}

	sessionVars := map[string]any{
		"x-hasura-allowed-roles": []any{"user", "editor"},
	}

	_, err = connector.Execute(
		context.Background(), op, nil, nil, "user", sessionVars, slog.Default(),
	)
	if err != nil {
		t.Fatalf("Execute error: %v", err)
	}

	normalizedQuery := strings.NewReplacer(" ", "", "\n", "", "\t", "").Replace(capturedQuery)
	if !strings.Contains(normalizedQuery, `roles:["user","editor"]`) {
		t.Fatalf("expected quoted allowed roles list in outgoing query, got: %s", capturedQuery)
	}
}

func TestExecute_AppliesScalarSessionListPreset(t *testing.T) {
	t.Parallel()

	const userSDL = `
		type Query {
			games(levels: [Int!]! @preset(value: "x-hasura-game-level")): [Game!]!
		}
		type Game {
			id: ID!
		}
	`

	ctrl := gomock.NewController(t)
	mockDoer := mock.NewMockHTTPDoer(ctrl)

	introspectionCall := mockDoer.EXPECT().Do(gomock.Any()).Return(&http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(testIntrospectionResponse)),
	}, nil)

	var capturedQuery string

	executeCall := mockDoer.EXPECT().Do(gomock.Any()).DoAndReturn(
		func(req *http.Request) (*http.Response, error) {
			body := readAllOrFail(t, req.Body)

			var gqlReq struct {
				Query string `json:"query"`
			}
			if err := json.Unmarshal(body, &gqlReq); err != nil {
				t.Fatalf("unmarshalling GraphQL request: %v", err)
			}

			capturedQuery = gqlReq.Query

			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(`{"data":{"games":[]}}`)),
			}, nil
		},
	)

	gomock.InOrder(introspectionCall, executeCall)

	meta := newTestMetadata("http://example.com", []metadata.RemoteSchemaPermission{
		{
			Role: "user",
			Definition: metadata.RemoteSchemaPermissionDef{
				Schema: userSDL,
			},
		},
	})

	connector, err := remoteschema.New(context.Background(), meta, mockDoer)
	if err != nil {
		t.Fatalf("New() error: %v", err)
	}

	op := &ast.OperationDefinition{
		Operation: ast.Query,
		SelectionSet: ast.SelectionSet{
			&ast.Field{
				Name: "games",
				SelectionSet: ast.SelectionSet{
					&ast.Field{Name: "id"},
				},
			},
		},
	}

	sessionVars := map[string]any{
		"x-hasura-game-level": "7",
	}

	_, err = connector.Execute(
		context.Background(), op, nil, nil, "user", sessionVars, slog.Default(),
	)
	if err != nil {
		t.Fatalf("Execute error: %v", err)
	}

	normalizedQuery := strings.NewReplacer(" ", "", "\n", "", "\t", "").Replace(capturedQuery)
	if !strings.Contains(normalizedQuery, `levels:[7]`) {
		t.Fatalf("expected unquoted int list in outgoing query, got: %s", capturedQuery)
	}

	if strings.Contains(normalizedQuery, `levels:"7"`) {
		t.Fatalf("expected scalar list preset to be wrapped and unquoted, got: %s", capturedQuery)
	}
}

// TestExecute_AppliesPresetsWithNonDefaultRootType exercises the dashboard-style
// permission SDL shape `schema { query: query_root }` (and the mutation/
// subscription equivalents). Presets are stored under the SDL root type name, so
// Execute must look them up with that real root name rather than the
// operation-kind default ("Query"/"Mutation"/"Subscription"). The mutation and
// subscription cases are the only coverage of the corresponding
// schema.MutationType / schema.SubscriptionType branches of roleRootTypeName.
func TestExecute_AppliesPresetsWithNonDefaultRootType(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		sdl       string
		operation ast.Operation
		field     string
		// response is the remote endpoint's reply for the operation call; its
		// top-level data key must match field so Execute returns it intact.
		response string
	}{
		{
			name: "query",
			sdl: `
				schema { query: query_root }
				type query_root {
					qthings(tenantId: String @preset(value: "x-hasura-tenant-id")): [Thing!]!
				}
				type Thing {
					id: String
					tenantId: String
				}
			`,
			operation: ast.Query,
			field:     "qthings",
			response:  `{"data":{"qthings":[{"id":"thing-1","tenantId":"tenant-A"}]}}`,
		},
		{
			name: "mutation",
			sdl: `
				schema { mutation: mutation_root }
				type mutation_root {
					createThing(tenantId: String @preset(value: "x-hasura-tenant-id")): Thing
				}
				type Thing {
					id: String
					tenantId: String
				}
			`,
			operation: ast.Mutation,
			field:     "createThing",
			response:  `{"data":{"createThing":{"id":"thing-1","tenantId":"tenant-A"}}}`,
		},
		{
			name: "subscription",
			sdl: `
				schema { subscription: subscription_root }
				type subscription_root {
					watchThing(tenantId: String @preset(value: "x-hasura-tenant-id")): Thing
				}
				type Thing {
					id: String
					tenantId: String
				}
			`,
			operation: ast.Subscription,
			field:     "watchThing",
			response:  `{"data":{"watchThing":{"id":"thing-1","tenantId":"tenant-A"}}}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			mockDoer := mock.NewMockHTTPDoer(ctrl)

			introspectionCall := mockDoer.EXPECT().Do(gomock.Any()).Return(&http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(testIntrospectionResponse)),
			}, nil)

			var capturedBody string

			executeCall := mockDoer.EXPECT().Do(gomock.Any()).DoAndReturn(
				func(req *http.Request) (*http.Response, error) {
					capturedBody = string(readAllOrFail(t, req.Body))

					return &http.Response{
						StatusCode: http.StatusOK,
						Body:       io.NopCloser(strings.NewReader(tt.response)),
					}, nil
				},
			)

			gomock.InOrder(introspectionCall, executeCall)

			meta := newTestMetadata("http://example.com", []metadata.RemoteSchemaPermission{
				{
					Role: "user",
					Definition: metadata.RemoteSchemaPermissionDef{
						Schema: tt.sdl,
					},
				},
			})

			connector, err := remoteschema.New(context.Background(), meta, mockDoer)
			if err != nil {
				t.Fatalf("New() error: %v", err)
			}

			op := &ast.OperationDefinition{
				Operation: tt.operation,
				SelectionSet: ast.SelectionSet{
					&ast.Field{
						Name: tt.field,
						SelectionSet: ast.SelectionSet{
							&ast.Field{Name: "id"},
							&ast.Field{Name: "tenantId"},
						},
					},
				},
			}

			sessionVars := map[string]any{
				"x-hasura-tenant-id": "tenant-A",
			}

			_, err = connector.Execute(
				context.Background(), op, nil, nil, "user", sessionVars, slog.Default(),
			)
			if err != nil {
				t.Fatalf("Execute error: %v", err)
			}

			if !strings.Contains(capturedBody, `tenantId:\"tenant-A\"`) &&
				!strings.Contains(capturedBody, `tenantId: \"tenant-A\"`) {
				t.Errorf(
					"expected preset-injected tenantId argument in outgoing %s, got: %s",
					tt.name, capturedBody,
				)
			}
		})
	}
}

// TestExecute_AppliesPresetsInInlineFragment exercises the inline-fragment
// branch of applyPresetsToSelectionSet: the operation wraps the preset-bearing
// field in `... on Query`, so the walker must descend into the fragment using
// its TypeCondition before the "Query.getUser" preset key matches. Without
// this test the InlineFragment case in execute.go:89-100 is unreachable from
// Execute-level coverage.
func TestExecute_AppliesPresetsInInlineFragment(t *testing.T) {
	t.Parallel()

	const userSDL = `
		type Query {
			getUser(userId: String @preset(value: "x-hasura-user-id")): User
		}
		type User {
			id: String
		}
	`

	ctrl := gomock.NewController(t)
	mockDoer := mock.NewMockHTTPDoer(ctrl)

	introspectionCall := mockDoer.EXPECT().Do(gomock.Any()).Return(&http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(testIntrospectionResponse)),
	}, nil)

	var capturedBody string

	executeCall := mockDoer.EXPECT().Do(gomock.Any()).DoAndReturn(
		func(req *http.Request) (*http.Response, error) {
			capturedBody = string(readAllOrFail(t, req.Body))

			return &http.Response{
				StatusCode: http.StatusOK,
				Body: io.NopCloser(strings.NewReader(
					`{"data":{"getUser":{"id":"user-abc"}}}`,
				)),
			}, nil
		},
	)

	gomock.InOrder(introspectionCall, executeCall)

	meta := newTestMetadata("http://example.com", []metadata.RemoteSchemaPermission{
		{
			Role: "user",
			Definition: metadata.RemoteSchemaPermissionDef{
				Schema: userSDL,
			},
		},
	})

	connector, err := remoteschema.New(context.Background(), meta, mockDoer)
	if err != nil {
		t.Fatalf("New() error: %v", err)
	}

	op := &ast.OperationDefinition{
		Operation: ast.Query,
		SelectionSet: ast.SelectionSet{
			&ast.InlineFragment{
				TypeCondition: "Query",
				SelectionSet: ast.SelectionSet{
					&ast.Field{
						Name: "getUser",
						SelectionSet: ast.SelectionSet{
							&ast.Field{Name: "id"},
						},
					},
				},
			},
		},
	}

	sessionVars := map[string]any{
		"x-hasura-user-id": "user-abc",
	}

	_, err = connector.Execute(
		context.Background(), op, nil, nil, "user", sessionVars, slog.Default(),
	)
	if err != nil {
		t.Fatalf("Execute error: %v", err)
	}

	if !strings.Contains(capturedBody, `userId:\"user-abc\"`) &&
		!strings.Contains(capturedBody, `userId: \"user-abc\"`) {
		t.Errorf(
			"expected preset-injected userId argument in outgoing query, got: %s",
			capturedBody,
		)
	}
}

// TestExecute_AppliesPresetsInNamedFragment exercises the named-fragment
// branch of preset injection: Execute formats fragment definitions separately
// from the operation tree, so the fragment list must be cloned and mutated
// before the query is sent upstream.
func TestExecute_AppliesPresetsInNamedFragment(t *testing.T) {
	t.Parallel()

	const userSDL = `
		type Query {
			getUser(userId: String @preset(value: "x-hasura-user-id")): User
		}
		type User {
			id: String
		}
	`

	ctrl := gomock.NewController(t)
	mockDoer := mock.NewMockHTTPDoer(ctrl)

	introspectionCall := mockDoer.EXPECT().Do(gomock.Any()).Return(&http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(testIntrospectionResponse)),
	}, nil)

	var capturedQuery string

	executeCall := mockDoer.EXPECT().Do(gomock.Any()).DoAndReturn(
		func(req *http.Request) (*http.Response, error) {
			body := readAllOrFail(t, req.Body)

			var gqlReq struct {
				Query string `json:"query"`
			}
			if err := json.Unmarshal(body, &gqlReq); err != nil {
				t.Fatalf("unmarshalling GraphQL request: %v", err)
			}

			capturedQuery = gqlReq.Query

			return &http.Response{
				StatusCode: http.StatusOK,
				Body: io.NopCloser(strings.NewReader(
					`{"data":{"getUser":{"id":"user-abc"}}}`,
				)),
			}, nil
		},
	)

	gomock.InOrder(introspectionCall, executeCall)

	meta := newTestMetadata("http://example.com", []metadata.RemoteSchemaPermission{
		{
			Role: "user",
			Definition: metadata.RemoteSchemaPermissionDef{
				Schema: userSDL,
			},
		},
	})

	connector, err := remoteschema.New(context.Background(), meta, mockDoer)
	if err != nil {
		t.Fatalf("New() error: %v", err)
	}

	op := &ast.OperationDefinition{
		Operation: ast.Query,
		SelectionSet: ast.SelectionSet{
			&ast.FragmentSpread{Name: "UserLookup"},
		},
	}
	fragments := ast.FragmentDefinitionList{
		{
			Name:          "UserLookup",
			TypeCondition: "Query",
			SelectionSet: ast.SelectionSet{
				&ast.Field{
					Name: "getUser",
					SelectionSet: ast.SelectionSet{
						&ast.Field{Name: "id"},
					},
				},
			},
		},
	}

	sessionVars := map[string]any{
		"x-hasura-user-id": "user-abc",
	}

	_, err = connector.Execute(
		context.Background(), op, fragments, nil, "user", sessionVars, slog.Default(),
	)
	if err != nil {
		t.Fatalf("Execute error: %v", err)
	}

	normalizedQuery := strings.NewReplacer(" ", "", "\n", "", "\t", "").Replace(capturedQuery)
	if !strings.Contains(normalizedQuery, `fragmentUserLookuponQuery`) {
		t.Fatalf("expected named fragment in outgoing query, got: %s", capturedQuery)
	}

	if !strings.Contains(normalizedQuery, `getUser(userId:"user-abc")`) {
		t.Fatalf("expected preset-injected userId in named fragment, got: %s", capturedQuery)
	}

	fragmentField, ok := fragments[0].SelectionSet[0].(*ast.Field)
	if !ok {
		t.Fatal("expected original fragment field")
	}

	if len(fragmentField.Arguments) != 0 {
		t.Fatalf(
			"expected original fragment to remain unmodified, got %#v",
			fragmentField.Arguments,
		)
	}
}

// TestExecute_AppliesPresetsMissingSessionVar drives the
// resolvePresetValue-misses-session-var branch end-to-end. The preset
// references `x-hasura-user-id` but the session has no such key; the resolver
// returns the empty string and applyFieldPresets must still inject the
// argument with an empty value (i.e. the outgoing query contains userId:""),
// rather than silently dropping the argument. This is the path that a remote
// schema's `where: { userId: { _eq: $userId } }` permission relies on to
// fail-closed when the caller has no user id.
func TestExecute_AppliesPresetsMissingSessionVar(t *testing.T) {
	t.Parallel()

	const userSDL = `
		type Query {
			getUser(userId: String @preset(value: "x-hasura-user-id")): User
		}
		type User {
			id: String
		}
	`

	ctrl := gomock.NewController(t)
	mockDoer := mock.NewMockHTTPDoer(ctrl)

	introspectionCall := mockDoer.EXPECT().Do(gomock.Any()).Return(&http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(testIntrospectionResponse)),
	}, nil)

	var capturedBody string

	executeCall := mockDoer.EXPECT().Do(gomock.Any()).DoAndReturn(
		func(req *http.Request) (*http.Response, error) {
			capturedBody = string(readAllOrFail(t, req.Body))

			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(`{"data":{"getUser":null}}`)),
			}, nil
		},
	)

	gomock.InOrder(introspectionCall, executeCall)

	meta := newTestMetadata("http://example.com", []metadata.RemoteSchemaPermission{
		{
			Role: "user",
			Definition: metadata.RemoteSchemaPermissionDef{
				Schema: userSDL,
			},
		},
	})

	connector, err := remoteschema.New(context.Background(), meta, mockDoer)
	if err != nil {
		t.Fatalf("New() error: %v", err)
	}

	op := &ast.OperationDefinition{
		Operation: ast.Query,
		SelectionSet: ast.SelectionSet{
			&ast.Field{
				Name: "getUser",
				SelectionSet: ast.SelectionSet{
					&ast.Field{Name: "id"},
				},
			},
		},
	}

	_, err = connector.Execute(
		context.Background(), op, nil, nil, "user", map[string]any{}, slog.Default(),
	)
	if err != nil {
		t.Fatalf("Execute error: %v", err)
	}

	if !strings.Contains(capturedBody, `userId:\"\"`) &&
		!strings.Contains(capturedBody, `userId: \"\"`) {
		t.Errorf(
			"expected empty-string preset argument in outgoing query, got: %s",
			capturedBody,
		)
	}
}

func TestNew_RejectsInvalidURL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		url  string
	}{
		{name: "unsupported scheme", url: "file:///etc/passwd"},
		{name: "no scheme", url: "example.com/graphql"},
		{name: "empty host", url: "http://"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			_, err := remoteschema.New(
				context.Background(), newTestMetadata(tt.url, nil), nil,
			)
			if err == nil {
				t.Fatalf("expected error for URL %q, got nil", tt.url)
			}

			if !strings.Contains(err.Error(), "validating remote schema URL") {
				t.Errorf("expected validation error, got: %v", err)
			}
		})
	}
}

// TestExecute_NonOKDoesNotLeakBody asserts the upstream non-200 body never
// reaches the client-facing error message (finding 14). The server returns an
// internal-looking 500 body that must be suppressed.
func TestExecute_NonOKDoesNotLeakBody(t *testing.T) {
	t.Parallel()

	const secretBody = "internal-stack-trace at host db.internal:5432"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		bodyStr := string(readAllOrFail(t, r.Body))

		if strings.Contains(bodyStr, "IntrospectionQuery") ||
			strings.Contains(bodyStr, "__schema") {
			w.Header().Set("Content-Type", "application/json")
			writeOrFail(t, w, []byte(testIntrospectionResponse))

			return
		}

		w.WriteHeader(http.StatusInternalServerError)
		writeOrFail(t, w, []byte(secretBody))
	}))
	defer server.Close()

	connector, err := remoteschema.New(
		context.Background(), newTestMetadata(server.URL, nil), nil,
	)
	if err != nil {
		t.Fatalf("New() error: %v", err)
	}

	op := &ast.OperationDefinition{
		Operation:    ast.Query,
		SelectionSet: ast.SelectionSet{&ast.Field{Name: "test"}},
	}

	_, err = connector.Execute(
		context.Background(), op, nil, nil, "admin", nil, slog.Default(),
	)
	if err == nil {
		t.Fatal("expected error")
	}

	if strings.Contains(err.Error(), secretBody) {
		t.Errorf("upstream body leaked into client error: %v", err)
	}

	if !strings.Contains(err.Error(), "remote schema returned status 500") {
		t.Errorf("expected generic status error, got: %v", err)
	}
}

// TestExecute_DoesNotFollowRedirect asserts the outbound client refuses to
// follow a 3xx redirect (finding 8). A redirect target that would capture the
// configured X-Api-Key must never be reached; the redirect is surfaced as a
// non-200 instead.
func TestExecute_DoesNotFollowRedirect(t *testing.T) {
	t.Parallel()

	var redirectTargetHit bool

	redirectTarget := httptest.NewServer(
		http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			redirectTargetHit = true

			w.Header().Set("Content-Type", "application/json")
			writeOrFail(t, w, []byte(`{"data":{"test":"leaked"}}`))
		}),
	)
	defer redirectTarget.Close()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		bodyStr := string(readAllOrFail(t, r.Body))

		if strings.Contains(bodyStr, "IntrospectionQuery") ||
			strings.Contains(bodyStr, "__schema") {
			w.Header().Set("Content-Type", "application/json")
			writeOrFail(t, w, []byte(testIntrospectionResponse))

			return
		}

		http.Redirect(w, r, redirectTarget.URL, http.StatusFound)
	}))
	defer server.Close()

	connector, err := remoteschema.New(
		context.Background(), newTestMetadata(server.URL, nil), nil,
	)
	if err != nil {
		t.Fatalf("New() error: %v", err)
	}

	op := &ast.OperationDefinition{
		Operation:    ast.Query,
		SelectionSet: ast.SelectionSet{&ast.Field{Name: "test"}},
	}

	_, err = connector.Execute(
		context.Background(), op, nil, nil, "admin", nil, slog.Default(),
	)
	if err == nil {
		t.Fatal("expected error from unfollowed redirect")
	}

	if redirectTargetHit {
		t.Error("redirect was followed — credentials would leak to attacker host")
	}

	if !strings.Contains(err.Error(), "remote schema returned status 302") {
		t.Errorf("expected generic 302 status error, got: %v", err)
	}
}
