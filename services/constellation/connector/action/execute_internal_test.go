package action

import (
	"bytes"
	"context"
	json "encoding/json/v2"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"reflect"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	"github.com/nhost/nhost/services/constellation/internal/requestcontext"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/validator"
	"github.com/vektah/gqlparser/v2/validator/rules"
)

type stubDoer struct {
	t             *testing.T
	handle        func(*http.Request) (*http.Response, error)
	requests      []*http.Request
	requestBodies [][]byte
}

func (d *stubDoer) Do(req *http.Request) (*http.Response, error) {
	d.t.Helper()

	body, err := io.ReadAll(req.Body)
	if err != nil {
		d.t.Fatalf("reading request body: %v", err)
	}

	if err := req.Body.Close(); err != nil {
		d.t.Fatalf("closing request body: %v", err)
	}

	req.Body = io.NopCloser(bytes.NewReader(body))

	d.requests = append(d.requests, req)
	d.requestBodies = append(d.requestBodies, body)

	return d.handle(req)
}

func TestExecuteBuildsPayloadAndSecureHeaders(t *testing.T) {
	t.Parallel()

	const queryText = `query EchoAction {
		echoResult: echoHeaders(message: "hello") {
			message
			role
			userId
			forwardedHeader
			webhookSecretPresent
			requestQuery
		}
	}`

	doer := &stubDoer{t: t}
	doer.handle = func(req *http.Request) (*http.Response, error) {
		assertNoHeader(t, req, "X-Hasura-Role")
		assertNoHeader(t, req, "X-Hasura-User-Id")
		assertHeader(t, req, "X-Action-Echo", "forwarded")
		assertHeader(t, req, "X-Nhost-Webhook-Secret", "configured-secret")
		assertHeader(t, req, "X-Forwarded-Host", "client.example.test")
		assertHeader(t, req, "X-Forwarded-User-Agent", "action-test")
		assertHeader(t, req, "X-Forwarded-Origin", "https://app.example.test")

		if got := req.Header.Get("Content-Md5"); got != "" {
			t.Fatalf("Content-Md5 forwarded as %q", got)
		}

		var payload actionPayload
		if err := json.UnmarshalRead(req.Body, &payload); err != nil {
			t.Fatalf("decoding payload: %v", err)
		}

		wantPayload := actionPayload{
			Action: actionPayloadName{Name: "echoHeaders"},
			Input:  map[string]any{"message": "hello"},
			SessionVariables: map[string]any{
				"x-hasura-role":    "user",
				"x-hasura-user-id": "action-user-123",
			},
			RequestQuery: queryText,
		}
		if diff := cmp.Diff(wantPayload, payload); diff != "" {
			t.Fatalf("payload mismatch (-want +got):\n%s", diff)
		}

		return jsonHTTPResponse(t, http.StatusOK, map[string]any{
			"message":              payload.Input["message"],
			"role":                 payload.SessionVariables["x-hasura-role"],
			"userId":               payload.SessionVariables["x-hasura-user-id"],
			"forwardedHeader":      req.Header.Get("X-Action-Echo"),
			"webhookSecretPresent": req.Header.Get("X-Nhost-Webhook-Secret") != "",
			"requestQuery":         payload.RequestQuery,
		}), nil
	}

	conn := newConnectorWithDoer(
		t.Context(),
		executionMetadata(
			[]metadata.ActionMetadata{
				actionMeta(
					"echoHeaders",
					metadata.ActionOperationQuery,
					"EchoHeadersOutput!",
					nil,
					[]metadata.ActionArgument{actionArg("message", "String!", "")},
					withActionForwardClientHeaders(true),
					withActionHeaders(metadata.ActionHeader{
						Name:         "x-nhost-webhook-secret",
						Value:        "configured-secret",
						ValueFromEnv: "",
					}),
				),
			},
			customTypes(withObjects(objectType(
				"EchoHeadersOutput",
				nil,
				objectField("message", "String!"),
				objectField("role", "String!"),
				objectField("userId", "String"),
				objectField("forwardedHeader", "String"),
				objectField("webhookSecretPresent", "Boolean!"),
				objectField("requestQuery", "String!"),
			))),
		),
		metadata.NewInconsistencies(),
		slog.Default(),
		doer,
	)

	ctx := requestcontext.GraphQLQueryToContext(t.Context(), queryText)
	ctx = requestcontext.ClientHeadersToContext(ctx, http.Header{
		"Host":                   []string{"client.example.test"},
		"User-Agent":             []string{"action-test"},
		"Origin":                 []string{"https://app.example.test"},
		"Content-Md5":            []string{"ignored"},
		"X-Action-Echo":          []string{"forwarded"},
		"X-Hasura-Role":          []string{"evil"},
		"X-Hasura-User-Id":       []string{"evil"},
		"X-Nhost-Webhook-Secret": []string{"client-secret"},
	})

	result, err := executeQuery(
		ctx,
		t,
		conn,
		metadata.RoleAdmin,
		queryText,
		nil,
		map[string]any{
			"x-hasura-role":    "user",
			"X-Hasura-User-Id": "action-user-123",
		},
	)
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}

	want := map[string]any{
		"echoResult": map[string]any{
			"message":              "hello",
			"role":                 "user",
			"userId":               "action-user-123",
			"forwardedHeader":      "forwarded",
			"webhookSecretPresent": true,
			"requestQuery":         queryText,
		},
	}
	if diff := cmp.Diff(want, result); diff != "" {
		t.Fatalf("result mismatch (-want +got):\n%s", diff)
	}
}

func TestExecuteAppliesRequestAndResponseTransforms(t *testing.T) {
	t.Parallel()

	const queryText = `query TransformAction($message: String!) {
		transformEcho(message: $message) {
			message
			role
			trace
		}
	}`

	doer := &stubDoer{t: t}
	doer.handle = func(req *http.Request) (*http.Response, error) {
		if req.Method != http.MethodPatch {
			t.Fatalf("method = %s, want PATCH", req.Method)
		}

		if want := "https://actions.example.test/transformEcho/transformed?user=action-user-123"; req.URL.String() != want {
			t.Fatalf("url = %s, want %s", req.URL.String(), want)
		}

		assertHeader(t, req, "Content-Type", "application/x-www-form-urlencoded")
		assertHeader(t, req, "X-Transformed", "user")
		assertNoHeader(t, req, "X-Remove")

		body, err := io.ReadAll(req.Body)
		if err != nil {
			t.Fatalf("reading transformed request body: %v", err)
		}

		if want := "message=hello+transforms&role=user"; string(body) != want {
			t.Fatalf("transformed request body = %s, want %s", body, want)
		}

		resp := jsonHTTPResponse(t, http.StatusAccepted, map[string]any{
			"data": map[string]any{
				"text": "hello transforms",
				"role": "user",
			},
		})
		resp.Header.Set("X-Trace-Id", "trace-123")

		return resp, nil
	}

	conn := newConnectorWithDoer(
		t.Context(),
		executionMetadata(
			[]metadata.ActionMetadata{
				actionMeta(
					"transformEcho",
					metadata.ActionOperationQuery,
					"TransformEchoOutput!",
					[]string{"user"},
					[]metadata.ActionArgument{actionArg("message", "String!", "")},
					withActionHeaders(metadata.ActionHeader{
						Name:         "x-remove",
						Value:        "remove-me",
						ValueFromEnv: "",
					}),
					withRequestTransform(map[string]any{
						"version":      2,
						"method":       "PATCH",
						"url":          "{{$base_url}}/transformed",
						"content_type": "application/x-www-form-urlencoded",
						"query_params": map[string]any{
							"user": "{{$session_variables['x-hasura-user-id']}}",
						},
						"request_headers": map[string]any{
							"remove_headers": []any{"x-remove"},
							"add_headers": map[string]any{
								"x-transformed": `{{ getSessionVariable("x-hasura-role") }}`,
							},
						},
						"body": map[string]any{
							"action": "x_www_form_urlencoded",
							"form_template": map[string]any{
								"message": "{{$body.input.message}}",
								"role":    `{{ getSessionVariable("x-hasura-role") }}`,
							},
						},
					}),
					withResponseTransform(map[string]any{
						"version": "2",
						"body": map[string]any{
							"action": "transform",
							"template": `{
								"message": {{$body.data.text}},
								"role": {{$body.data.role}},
								"trace": {{$response.headers['x-trace-id']}}
							}`,
						},
					}),
				),
			},
			customTypes(withObjects(objectType(
				"TransformEchoOutput",
				nil,
				objectField("message", "String!"),
				objectField("role", "String!"),
				objectField("trace", "String!"),
			))),
		),
		metadata.NewInconsistencies(),
		slog.Default(),
		doer,
	)

	result, err := executeQuery(
		requestcontext.GraphQLQueryToContext(t.Context(), queryText),
		t,
		conn,
		"user",
		queryText,
		map[string]any{"message": "hello transforms"},
		map[string]any{
			"x-hasura-role":    "user",
			"x-hasura-user-id": "action-user-123",
		},
	)
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}

	want := map[string]any{
		"transformEcho": map[string]any{
			"message": "hello transforms",
			"role":    "user",
			"trace":   "trace-123",
		},
	}
	if diff := cmp.Diff(want, result); diff != "" {
		t.Fatalf("result mismatch (-want +got):\n%s", diff)
	}
}

func TestExecuteSurfacesTransformRuntimeErrors(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name           string
		actionName     string
		actionOption   actionOption
		handle         func(*testing.T, *http.Request) (*http.Response, error)
		wantResult     map[string]any
		wantErrMessage string
	}{
		{
			// A structurally-valid Kriti body template whose expression errors
			// at render time (field access on a string) must abort before HTTP
			// dispatch and surface as an Execute error.
			name:       "request transform render error",
			actionName: "brokenRequest",
			actionOption: withRequestTransform(map[string]any{
				"body": `{ "message": {{$body.input.message.missing}} }`,
			}),
			handle: func(t *testing.T, _ *http.Request) (*http.Response, error) {
				t.Helper()
				t.Error("request transform error should stop before HTTP dispatch")

				return rawHTTPResponse(http.StatusInternalServerError, nil), nil
			},
			wantResult: map[string]any{"brokenRequest": nil},
			wantErrMessage: "executing action \"brokenRequest\": applying request transform: " +
				"rendering request body: ",
		},
		{
			// The webhook response body lacks the nested field the response
			// transform dereferences, so rendering errors at runtime.
			name:       "response transform render error",
			actionName: "brokenResponse",
			actionOption: withResponseTransform(map[string]any{
				"version": 2,
				"body": map[string]any{
					"action":   "transform",
					"template": `{ "value": {{$body.value.missing}} }`,
				},
			}),
			handle: func(t *testing.T, _ *http.Request) (*http.Response, error) {
				t.Helper()

				return jsonHTTPResponse(t, http.StatusOK, map[string]any{"value": "ok"}), nil
			},
			wantResult: map[string]any{"brokenResponse": nil},
			wantErrMessage: "executing action \"brokenResponse\": applying response transform: " +
				"rendering response body: ",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			doer := &stubDoer{t: t}
			doer.handle = func(req *http.Request) (*http.Response, error) {
				t.Helper()

				return tt.handle(t, req)
			}
			conn := newConnectorWithDoer(
				t.Context(),
				executionMetadata(
					[]metadata.ActionMetadata{
						actionMeta(
							tt.actionName,
							metadata.ActionOperationQuery,
							"TransformErrorOutput",
							[]string{"user"},
							[]metadata.ActionArgument{actionArg("message", "String!", "")},
							tt.actionOption,
						),
					},
					customTypes(withObjects(objectType(
						"TransformErrorOutput",
						nil,
						objectField("value", "String"),
					))),
				),
				metadata.NewInconsistencies(),
				slog.Default(),
				doer,
			)

			queryText := "query TransformError($message: String!) { " + tt.actionName + "(message: $message) { value } }"

			result, err := executeQuery(
				requestcontext.GraphQLQueryToContext(t.Context(), queryText),
				t,
				conn,
				"user",
				queryText,
				map[string]any{"message": "hello"},
				map[string]any{"x-hasura-role": "user"},
			)
			if err == nil {
				t.Fatal("Execute error = nil, want transform runtime error")
			}

			if diff := cmp.Diff(tt.wantResult, result); diff != "" {
				t.Fatalf("result mismatch (-want +got):\n%s", diff)
			}

			if got := err.Error(); !strings.Contains(got, tt.wantErrMessage) {
				t.Fatalf("error = %q, want to contain %q", got, tt.wantErrMessage)
			}
		})
	}
}

func TestExecuteShapesNestedAliasesFragmentsAndScalars(t *testing.T) {
	t.Parallel()

	const queryText = `query ProfileAction {
		profile {
			identifier: id
			...ProfileFields
			nested {
				aliasValue: value
				optional
			}
			nestedList {
				value
				__typename
			}
			meta
		}
	}

	fragment ProfileFields on Profile {
		name
		status
		tags
	}`

	doer := &stubDoer{t: t}
	doer.handle = func(*http.Request) (*http.Response, error) {
		return jsonHTTPResponse(t, http.StatusOK, map[string]any{
			"id":     42,
			"name":   "Ada",
			"status": "ACTIVE",
			"tags":   []any{"go", "graphql"},
			"nested": map[string]any{
				"value": "inner",
			},
			"nestedList": []any{
				map[string]any{"value": "first"},
			},
			"meta":  map[string]any{"arbitrary": []any{float64(1)}},
			"extra": "ignored",
		}), nil
	}

	conn := newConnectorWithDoer(
		t.Context(),
		profileExecutionMetadata(),
		metadata.NewInconsistencies(),
		slog.Default(),
		doer,
	)

	result, err := executeQuery(
		requestcontext.GraphQLQueryToContext(t.Context(), queryText),
		t,
		conn,
		metadata.RoleAdmin,
		queryText,
		nil,
		map[string]any{"x-hasura-role": "admin"},
	)
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}

	want := map[string]any{
		"profile": map[string]any{
			"identifier": "42",
			"name":       "Ada",
			"status":     "ACTIVE",
			"tags":       []any{"go", "graphql"},
			"nested": map[string]any{
				"aliasValue": "inner",
				"optional":   nil,
			},
			"nestedList": []any{
				map[string]any{
					"value":      "first",
					"__typename": "Nested",
				},
			},
			"meta": map[string]any{"arbitrary": []any{float64(1)}},
		},
	}
	if diff := cmp.Diff(want, result); diff != "" {
		t.Fatalf("result mismatch (-want +got):\n%s", diff)
	}
}

func TestExecutePreservesInjectedPhantomFields(t *testing.T) {
	t.Parallel()

	const queryText = `query ProfileAction { actionProfile { label } }`

	doer := &stubDoer{t: t}
	doer.handle = func(*http.Request) (*http.Response, error) {
		return jsonHTTPResponse(t, http.StatusOK, map[string]any{
			"label":  "primary profile",
			"userId": "550e8400-e29b-41d4-a716-446655440001",
		}), nil
	}

	conn := newConnectorWithDoer(
		t.Context(),
		executionMetadata(
			[]metadata.ActionMetadata{
				actionMeta(
					"actionProfile",
					metadata.ActionOperationQuery,
					"ActionProfile!",
					nil,
					nil,
				),
			},
			customTypes(withObjects(objectType(
				"ActionProfile",
				nil,
				objectField("label", "String!"),
				objectField("userId", "ID!"),
			))),
		),
		metadata.NewInconsistencies(),
		slog.Default(),
		doer,
	)

	operation, fragments, variables := validatedOperation(
		t,
		conn,
		metadata.RoleAdmin,
		queryText,
		nil,
	)

	root, ok := operation.SelectionSet[0].(*ast.Field)
	if !ok {
		t.Fatalf("root selection = %T, want *ast.Field", operation.SelectionSet[0])
	}

	root.SelectionSet = append(root.SelectionSet, &ast.Field{Name: "userId"})

	result, err := conn.Execute(
		requestcontext.GraphQLQueryToContext(t.Context(), queryText),
		operation,
		fragments,
		variables,
		metadata.RoleAdmin,
		map[string]any{"x-hasura-role": "admin"},
		slog.Default(),
	)
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}

	want := map[string]any{
		"actionProfile": map[string]any{
			"label":  "primary profile",
			"userId": "550e8400-e29b-41d4-a716-446655440001",
		},
	}
	if diff := cmp.Diff(want, result); diff != "" {
		t.Fatalf("result mismatch (-want +got):\n%s", diff)
	}
}

func TestExecuteMapsActionErrorsAndNullability(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		status     int
		body       any
		wantResult map[string]any
		wantErrs   []map[string]any
	}{
		{
			name:   "handler error payload",
			status: http.StatusBadRequest,
			body: actionErrorPayload{
				Message: "invalid action input",
				Code:    "invalid-action-input",
				Extensions: map[string]any{
					"detail": "safe detail",
				},
			},
			wantResult: map[string]any{"profile": nil},
			wantErrs: []map[string]any{
				{
					"message": "invalid action input",
					"path":    []any{"profile"},
					"extensions": map[string]any{
						"code":   "invalid-action-input",
						"detail": "safe detail",
					},
				},
			},
		},
		{
			name:       "missing non-null field",
			status:     http.StatusOK,
			body:       map[string]any{"id": "profile-1"},
			wantResult: map[string]any{"profile": nil},
			wantErrs: []map[string]any{
				{
					"message": "cannot return null for non-null action field",
					"path":    []any{"profile", "name"},
					"extensions": map[string]any{
						"code": "validation-failed",
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			doer := &stubDoer{t: t}
			doer.handle = func(*http.Request) (*http.Response, error) {
				return jsonHTTPResponse(t, tt.status, tt.body), nil
			}

			conn := newConnectorWithDoer(
				t.Context(),
				profileExecutionMetadata(),
				metadata.NewInconsistencies(),
				slog.Default(),
				doer,
			)

			result, err := executeQuery(
				requestcontext.GraphQLQueryToContext(t.Context(), profileQuery()),
				t,
				conn,
				metadata.RoleAdmin,
				profileQuery(),
				nil,
				map[string]any{"x-hasura-role": "admin"},
			)
			if err == nil {
				t.Fatal("Execute error = nil, want structured GraphQL errors")
			}

			if diff := cmp.Diff(tt.wantResult, result); diff != "" {
				t.Fatalf("result mismatch (-want +got):\n%s", diff)
			}

			gotErrs := graphQLErrors(t, err)
			if diff := cmp.Diff(tt.wantErrs, gotErrs); diff != "" {
				t.Fatalf("errors mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestHTTPClientHardening(t *testing.T) {
	t.Parallel()

	t.Run("blocks redirects", func(t *testing.T) {
		t.Parallel()

		client := newHTTPClient(nil)

		defaultClient, ok := client.doer.(*http.Client)
		if !ok {
			t.Fatalf("default doer has type %T, want *http.Client", client.doer)
		}

		err := defaultClient.CheckRedirect(&http.Request{}, nil)
		if !errors.Is(err, http.ErrUseLastResponse) {
			t.Fatalf("CheckRedirect = %v, want http.ErrUseLastResponse", err)
		}
	})

	t.Run("caps response body", func(t *testing.T) {
		t.Parallel()

		doer := &stubDoer{t: t}
		doer.handle = func(*http.Request) (*http.Response, error) {
			return rawHTTPResponse(http.StatusOK, []byte(`{"too":"large"}`)), nil
		}

		client := &httpClient{
			doer:                 doer,
			maxRequestBodyBytes:  defaultMaxRequestBodyBytes,
			maxResponseBodyBytes: 1,
		}

		_, _, err := client.do(
			t.Context(),
			runtimeAction{
				name:                 "small",
				operation:            ast.Query,
				url:                  "https://actions.example.test/small",
				headers:              nil,
				timeout:              time.Second,
				forwardClientHeaders: false,
				requestTransform:     nil,
				responseTransform:    nil,
			},
			actionPayload{
				Action:           actionPayloadName{Name: "small"},
				Input:            nil,
				SessionVariables: nil,
				RequestQuery:     "",
			},
			nil,
		)
		if !errors.Is(err, errActionResponseTooLarge) {
			t.Fatalf("do error = %v, want errActionResponseTooLarge", err)
		}
	})
}

func withActionForwardClientHeaders(forward bool) actionOption {
	return func(action *metadata.ActionMetadata) {
		action.Definition.ForwardClientHeaders = forward
	}
}

func withActionHeaders(headers ...metadata.ActionHeader) actionOption {
	return func(action *metadata.ActionMetadata) {
		action.Definition.Headers = headers
	}
}

func executionMetadata(
	actions []metadata.ActionMetadata,
	customTypes metadata.CustomTypes,
) *metadata.Metadata {
	return &metadata.Metadata{
		Databases:       nil,
		RemoteSchemas:   nil,
		Actions:         actions,
		CustomTypes:     customTypes,
		LoadDiagnostics: nil,
	}
}

func profileExecutionMetadata() *metadata.Metadata {
	return executionMetadata(
		[]metadata.ActionMetadata{
			actionMeta("profile", metadata.ActionOperationQuery, "Profile!", nil, nil),
		},
		customTypes(
			withScalars(metadata.CustomScalarType{Name: "Metadata", Description: ""}),
			withEnums(metadata.CustomEnumType{
				Name:        "Status",
				Description: "",
				Values: []metadata.CustomEnumValue{
					{
						Value:             "ACTIVE",
						Description:       "",
						IsDeprecated:      false,
						DeprecationReason: "",
					},
				},
			}),
			withObjects(
				objectType(
					"Nested",
					nil,
					objectField("value", "String!"),
					objectField("optional", "String"),
				),
				objectType(
					"Profile",
					nil,
					objectField("id", "ID!"),
					objectField("name", "String!"),
					objectField("status", "Status!"),
					objectField("tags", "[String!]!"),
					objectField("nested", "Nested"),
					objectField("nestedList", "[Nested!]!"),
					objectField("meta", "Metadata"),
				),
			),
		),
	)
}

func profileQuery() string {
	return `query ProfileAction { profile { id name } }`
}

func executeQuery(
	ctx context.Context,
	t *testing.T,
	conn *Connector,
	role string,
	query string,
	variables map[string]any,
	sessionVariables map[string]any,
) (map[string]any, error) {
	t.Helper()

	operation, fragments, validatedVariables := validatedOperation(t, conn, role, query, variables)

	return conn.Execute(
		ctx,
		operation,
		fragments,
		validatedVariables,
		role,
		sessionVariables,
		slog.Default(),
	)
}

func validatedOperation(
	t *testing.T,
	conn *Connector,
	role string,
	query string,
	variables map[string]any,
) (*ast.OperationDefinition, ast.FragmentDefinitionList, map[string]any) {
	t.Helper()

	schemas, err := conn.GetSchema()
	if err != nil {
		t.Fatalf("GetSchema: %v", err)
	}

	schema := schemas[role]
	if schema == nil {
		t.Fatalf("schema for role %q not found", role)
	}

	_, validatedSchema, err := schemamerge.BuildValidatedSchema(schema, role)
	if err != nil {
		t.Fatalf("BuildValidatedSchema: %v", err)
	}

	doc, gqlErrs := gqlparser.LoadQueryWithRules(validatedSchema, query, rules.NewDefaultRules())
	if gqlErrs != nil {
		t.Fatalf("LoadQuery: %v", gqlErrs)
	}

	operation := doc.Operations[0]

	validatedVariables, err := validator.VariableValues(validatedSchema, operation, variables)
	if err != nil {
		t.Fatalf("VariableValues: %v", err)
	}

	return operation, doc.Fragments, validatedVariables
}

func assertHeader(t *testing.T, req *http.Request, name, want string) {
	t.Helper()

	if got := req.Header.Get(name); got != want {
		t.Fatalf("header %s = %q, want %q", name, got, want)
	}
}

func assertNoHeader(t *testing.T, req *http.Request, name string) {
	t.Helper()

	if got := req.Header.Values(name); len(got) > 0 {
		t.Fatalf("header %s forwarded as %q", name, got)
	}
}

func jsonHTTPResponse(t *testing.T, status int, payload any) *http.Response {
	t.Helper()

	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshaling response: %v", err)
	}

	return rawHTTPResponse(status, body)
}

func rawHTTPResponse(status int, body []byte) *http.Response {
	return &http.Response{
		StatusCode: status,
		Body:       io.NopCloser(bytes.NewReader(body)),
		Header:     make(http.Header),
	}
}

func graphQLErrors(t *testing.T, err error) []map[string]any {
	t.Helper()

	var provider interface {
		GraphQLErrors() []map[string]any
	}
	if !errors.As(err, &provider) {
		t.Fatalf("error %T does not expose GraphQLErrors", err)
	}

	return provider.GraphQLErrors()
}

func TestGraphQLErrorCopies(t *testing.T) {
	t.Parallel()

	err := newGraphQLError([]map[string]any{
		{
			"message":    "boom",
			"path":       []any{"field"},
			"extensions": map[string]any{"code": "boom"},
		},
	})

	first := graphQLErrors(t, err)
	second := graphQLErrors(t, err)

	first[0]["message"] = "mutated"

	path, ok := first[0]["path"].([]any)
	if !ok {
		t.Fatalf("path has type %T, want []any", first[0]["path"])
	}

	path[0] = "mutated"

	extensions, ok := first[0]["extensions"].(map[string]any)
	if !ok {
		t.Fatalf("extensions has type %T, want map[string]any", first[0]["extensions"])
	}

	extensions["code"] = "mutated"

	if !reflect.DeepEqual(second, graphQLErrors(t, err)) {
		t.Fatalf("GraphQLErrors result was not stable")
	}
}

func TestExecuteForwardsSetCookieResponseHeaders(t *testing.T) {
	t.Parallel()

	const queryText = `query CookieAction {
		login(message: "hi") {
			message
		}
	}`

	doer := &stubDoer{t: t}
	doer.handle = func(*http.Request) (*http.Response, error) {
		resp := jsonHTTPResponse(t, http.StatusOK, map[string]any{"message": "ok"})
		resp.Header.Add("Set-Cookie", "session=abc; HttpOnly")
		resp.Header.Add("Set-Cookie", "csrf=xyz")
		resp.Header.Set("X-Other", "should-not-forward")

		return resp, nil
	}

	conn := newConnectorWithDoer(
		t.Context(),
		executionMetadata(
			[]metadata.ActionMetadata{
				actionMeta(
					"login",
					metadata.ActionOperationQuery,
					"LoginOutput!",
					nil,
					[]metadata.ActionArgument{actionArg("message", "String!", "")},
				),
			},
			customTypes(withObjects(objectType(
				"LoginOutput",
				nil,
				objectField("message", "String!"),
			))),
		),
		metadata.NewInconsistencies(),
		slog.Default(),
		doer,
	)

	collector := &requestcontext.ResponseHeaderCollector{}
	ctx := requestcontext.ResponseHeaderCollectorToContext(t.Context(), collector)

	if _, err := executeQuery(
		ctx, t, conn, metadata.RoleAdmin, queryText, nil,
		map[string]any{"x-hasura-role": "user"},
	); err != nil {
		t.Fatalf("Execute: %v", err)
	}

	// Only Set-Cookie is forwarded, in order; X-Other is dropped.
	if got, want := collector.SetCookies(), []string{"session=abc; HttpOnly", "csrf=xyz"}; !slices.Equal(got, want) {
		t.Fatalf("forwarded cookies = %v, want %v", got, want)
	}
}
