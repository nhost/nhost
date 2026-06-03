package controller_test

import (
	"context"
	json "encoding/json/v2"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector"
	"github.com/nhost/nhost/services/constellation/connector/remoteschema"
	"github.com/nhost/nhost/services/constellation/controller"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/validator/rules"
)

const remoteSchemaIntrospectionResponse = `{
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
              "description": "",
              "args": [],
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
              "deprecationReason": ""
            }
          ],
          "inputFields": [],
          "interfaces": [],
          "enumValues": [],
          "possibleTypes": []
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
              "type": {
                "kind": "NON_NULL",
                "name": null,
                "ofType": {"kind": "SCALAR", "name": "String", "ofType": null}
              },
              "isDeprecated": false,
              "deprecationReason": ""
            },
            {
              "name": "name",
              "description": "",
              "args": [],
              "type": {
                "kind": "NON_NULL",
                "name": null,
                "ofType": {"kind": "SCALAR", "name": "String", "ofType": null}
              },
              "isDeprecated": false,
              "deprecationReason": ""
            }
          ],
          "inputFields": [],
          "interfaces": [],
          "enumValues": [],
          "possibleTypes": []
        }
      ]
    }
  }
}`

const remoteSchemaTestSDL = `
type Query {
  countries: [Country!]!
}

type Country {
  code: String!
  name: String!
}
`

type remoteSchemaGraphQLRequest struct {
	Query     string         `json:"query"`
	Variables map[string]any `json:"variables,omitempty"`
}

type validatingRemoteSchemaDoer struct {
	schema   *ast.Schema
	requests chan remoteSchemaGraphQLRequest
}

func newValidatingRemoteSchemaController(
	t *testing.T,
) (*controller.Controller, *validatingRemoteSchemaDoer) {
	t.Helper()

	schema, err := gqlparser.LoadSchema(&ast.Source{
		Name:  "remote_schema_test",
		Input: remoteSchemaTestSDL,
	})
	if err != nil {
		t.Fatalf("LoadSchema(remoteSchemaTestSDL): %v", err)
	}

	doer := &validatingRemoteSchemaDoer{
		schema:   schema,
		requests: make(chan remoteSchemaGraphQLRequest, 4),
	}

	remoteConn, err := remoteschema.New(
		context.Background(),
		&metadata.RemoteSchemaMetadata{
			Name: "remote",
			Definition: metadata.RemoteSchemaDefinition{
				URL: metadata.EnvString("http://remote.test/graphql"),
			},
		},
		doer,
	)
	if err != nil {
		t.Fatalf("remoteschema.New: %v", err)
	}

	ctrl, err := controller.NewFromConnectors(
		testAdminSecret,
		map[string]connector.Connector{"remote": remoteConn},
		nil,
		slog.New(slog.DiscardHandler),
	)
	if err != nil {
		t.Fatalf("NewFromConnectors(remote): %v", err)
	}

	return ctrl, doer
}

func (d *validatingRemoteSchemaDoer) Do(req *http.Request) (*http.Response, error) {
	body, err := io.ReadAll(req.Body)
	if err != nil {
		return nil, fmt.Errorf("reading remote GraphQL request: %w", err)
	}

	var gqlReq remoteSchemaGraphQLRequest
	if err := json.Unmarshal(body, &gqlReq); err != nil {
		return nil, fmt.Errorf("decoding remote GraphQL request: %w", err)
	}

	if strings.Contains(gqlReq.Query, "__schema") {
		return remoteSchemaHTTPResponse(remoteSchemaIntrospectionResponse), nil
	}

	d.requests <- gqlReq

	if _, gqlErrs := gqlparser.LoadQueryWithRules(
		d.schema, gqlReq.Query, rules.NewDefaultRules(),
	); gqlErrs != nil {
		return remoteSchemaHTTPResponse(
			`{"errors":[{"message":` + strconv.Quote(gqlErrs.Error()) + `}]}`,
		), nil
	}

	return remoteSchemaHTTPResponse(
		`{"data":{"countries":[{"code":"US","name":"United States"}]}}`,
	), nil
}

func remoteSchemaHTTPResponse(body string) *http.Response {
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}

func (d *validatingRemoteSchemaDoer) nextRequest(t *testing.T) remoteSchemaGraphQLRequest {
	t.Helper()

	select {
	case req := <-d.requests:
		return req
	default:
		t.Fatal("remote schema execute request was not sent")

		return remoteSchemaGraphQLRequest{}
	}
}

func TestResolve_RemoteSchemaRootFragmentForwardsExecutableDocument(t *testing.T) {
	t.Parallel()

	ctrl, remote := newValidatingRemoteSchemaController(t)

	resp, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{
		OperationName: "Q",
		Query: `query Q($withCountries: Boolean!) {
			...CountriesRoot @include(if: $withCountries)
		}
		fragment CountriesRoot on query_root {
			countries { code name }
		}`,
		Variables: map[string]any{"withCountries": true},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp.Errors != nil {
		t.Fatalf("expected remote schema document to validate, got errors: %v", resp.Errors)
	}

	data, ok := resp.Data.(map[string]any)
	if !ok {
		t.Fatalf("expected data object, got %T (%v)", resp.Data, resp.Data)
	}

	if _, hasCountries := data["countries"]; !hasCountries {
		t.Fatalf("remote root fragment dropped countries data: %v", data)
	}

	forwarded := remote.nextRequest(t).Query
	if strings.Contains(forwarded, "fragment CountriesRoot") {
		t.Fatalf("forwarded remote query kept the expanded root fragment: %s", forwarded)
	}

	if strings.Contains(forwarded, "$withCountries") {
		t.Fatalf("forwarded remote query kept root-spread-only variable: %s", forwarded)
	}
}

func TestResolve_RemoteSchemaDirectivePruningForwardsExecutableDocument(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name             string
		includeName      bool
		wantVariableUsed bool
	}{
		{
			name:             "pruned field drops now-unused variable definition",
			includeName:      false,
			wantVariableUsed: false,
		},
		{
			name:             "kept directive preserves variable definition",
			includeName:      true,
			wantVariableUsed: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctrl, remote := newValidatingRemoteSchemaController(t)

			resp, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{
				OperationName: "Q",
				Query: `query Q($includeName: Boolean!) {
					countries {
						code
						name @include(if: $includeName)
					}
				}`,
				Variables: map[string]any{"includeName": tt.includeName},
			})
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if resp.Errors != nil {
				t.Fatalf("expected remote schema document to validate, got errors: %v", resp.Errors)
			}

			forwarded := remote.nextRequest(t).Query

			variableUsed := strings.Contains(forwarded, "$includeName")
			if variableUsed != tt.wantVariableUsed {
				t.Fatalf(
					"forwarded remote query variable presence=%v, want %v: %s",
					variableUsed,
					tt.wantVariableUsed,
					forwarded,
				)
			}
		})
	}
}
