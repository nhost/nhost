package controller_test

import (
	"context"
	"encoding/json/jsontext"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/constellation/connector"
	"github.com/nhost/nhost/services/constellation/connector/memconnector"
	"github.com/nhost/nhost/services/constellation/connector/remoteschema"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	argmock "github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments/mock"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/controller"
	"github.com/nhost/nhost/services/constellation/controller/middleware"
	plannerpkg "github.com/nhost/nhost/services/constellation/controller/planner"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/vektah/gqlparser/v2/ast"
	"go.uber.org/mock/gomock"
)

// distinctOnOrderByMismatchError builds a real *arguments.QueryValidationError
// by driving the public arguments.ParseQuery with a distinct_on that does not
// match the leading order_by, then stamps the given root-field argument path.
// Using the production parser (rather than a hand-minted error through an
// exported constructor) keeps the arguments trust boundary closed while still
// feeding the controller a faithful structured error. order_by references
// budget while distinct_on references name, which ParseQuery rejects.
func distinctOnOrderByMismatchError(
	t *testing.T,
	rootField string,
) *arguments.QueryValidationError {
	t.Helper()

	ctrl := gomock.NewController(t)
	tbl := argmock.NewMockTable(ctrl)
	tbl.EXPECT().ColumnFromGraphqlName("budget").
		Return(&core.Column{SQLName: "budget", GraphqlName: "budget", SQLType: "numeric"})
	tbl.EXPECT().ColumnFromGraphqlName("name").
		Return(&core.Column{SQLName: "name", GraphqlName: "name", SQLType: "text"})

	args := ast.ArgumentList{
		&ast.Argument{
			Name: "order_by",
			Value: &ast.Value{
				Kind: ast.ObjectValue,
				Children: []*ast.ChildValue{
					{Name: "budget", Value: &ast.Value{Kind: ast.EnumValue, Raw: "desc"}},
				},
			},
		},
		&ast.Argument{Name: "distinct_on", Value: &ast.Value{Kind: ast.EnumValue, Raw: "name"}},
	}

	clause, _, _, err := arguments.ParseQuery(tbl, args, nil, "user", nil, "")
	if clause != nil {
		t.Fatalf("ParseQuery: expected nil where clause on the error path, got %v", clause)
	}

	var vErr *arguments.QueryValidationError
	if !errors.As(err, &vErr) {
		t.Fatalf("ParseQuery: expected a *QueryValidationError, got %T (%v)", err, err)
	}

	vErr.StampArgumentPath(rootField)

	return vErr
}

func negativeLimitValidationError(
	t *testing.T,
	rootField string,
) *arguments.QueryValidationError {
	t.Helper()

	args := ast.ArgumentList{
		&ast.Argument{Name: "limit", Value: &ast.Value{Kind: ast.IntValue, Raw: "-1"}},
	}

	whereClause, _, _, err := arguments.ParseQuery(nil, args, nil, "user", nil, "")
	if whereClause != nil {
		t.Fatalf("ParseQuery: expected nil where clause on the error path, got %v", whereClause)
	}

	var vErr *arguments.QueryValidationError
	if !errors.As(err, &vErr) {
		t.Fatalf("ParseQuery: expected a *QueryValidationError, got %T (%v)", err, err)
	}

	vErr.StampArgumentPath(rootField)

	return vErr
}

// adminSessionContext returns a context with an admin SessionVariables populated
// by running an HTTP request through the production Session middleware. We do
// this rather than constructing a context directly because the session context
// key is unexported in the middleware package — exercising the real middleware
// is the only black-box way to install a session.
func adminSessionContext(t *testing.T) context.Context {
	t.Helper()

	return runSessionMiddleware(t, http.Header{
		"X-Hasura-Admin-Secret": {testAdminSecret},
	})
}

// publicSessionContext returns a context with the fallback public SessionVariables.
func publicSessionContext(t *testing.T) context.Context {
	t.Helper()

	// No admin-secret header → no JWT → falls back to public role.
	return runSessionMiddleware(t, nil)
}

// runSessionMiddleware drives a single request through the production Session
// middleware and returns the request context the middleware produced. We do
// this rather than constructing a context directly because the session context
// key is unexported in the middleware package — exercising the real middleware
// is the only black-box way to install a session.
func runSessionMiddleware(t *testing.T, headers http.Header) context.Context {
	t.Helper()

	gin.SetMode(gin.TestMode)

	capturedCh := make(chan context.Context, 1)

	router := gin.New()
	router.Use(middleware.Session(testAdminSecret, middleware.NewNoOpJWTAuthenticator()))
	router.GET("/probe", func(ctx *gin.Context) {
		capturedCh <- ctx.Request.Context()
	})

	req := httptest.NewRequest(http.MethodGet, "/probe", nil)
	for k, vs := range headers {
		for _, v := range vs {
			req.Header.Add(k, v)
		}
	}

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	select {
	case captured := <-capturedCh:
		return captured
	default:
		t.Fatal("session middleware did not invoke the probe handler")

		return nil
	}
}

// extractErrorMessage pulls the first error message out of a GraphQLResponse,
// failing the test if the envelope is shaped unexpectedly.
func extractErrorMessage(t *testing.T, resp *controller.GraphQLResponse) string {
	t.Helper()

	if resp == nil {
		t.Fatal("expected response, got nil")
	}

	errs, ok := resp.Errors.([]map[string]any)
	if !ok || len(errs) == 0 {
		t.Fatalf("expected non-empty errors, got %+v", resp)
	}

	msg, _ := errs[0]["message"].(string)

	return msg
}

func TestResolve_NoSchemaForRole(t *testing.T) {
	t.Parallel()

	ctrl := newTestController(t)

	// memconnector only registers an "admin" schema; a public-role session
	// should hit the "no schema available for role" branch.
	resp, err := ctrl.Resolve(publicSessionContext(t), controller.GraphQLRequest{
		OperationName: "",
		Query:         `{ users { id } }`,
		Variables:     nil,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	msg := extractErrorMessage(t, resp)
	if !strings.Contains(msg, "no schema available for role: public") {
		t.Errorf("expected no-schema-for-role message, got %q", msg)
	}
}

func TestResolve_ParseError(t *testing.T) {
	t.Parallel()

	ctrl := newTestController(t)

	// Unbalanced braces force gqlparser to emit a parse-error envelope.
	resp, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{
		OperationName: "",
		Query:         `{ users { id name `, // missing closing braces
		Variables:     nil,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	msg := extractErrorMessage(t, resp)
	if msg == "" {
		t.Fatalf("expected parse error message, got %+v", resp)
	}

	if resp.Data != nil {
		t.Errorf("expected Data nil on parse error, got %v", resp.Data)
	}
}

func TestResolve_ValidateVariableError(t *testing.T) {
	t.Parallel()

	ctrl := newTestController(t)

	// `$skip: Boolean!` is declared but a non-boolean is passed at coercion
	// time, which forces validator.VariableValues to fail. The query itself
	// parses and validates fine — only the variable coercion step errors.
	resp, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{
		OperationName: "Q",
		Query:         `query Q($skip: Boolean!) { users @skip(if: $skip) { id } }`,
		Variables:     map[string]any{"skip": "not-a-boolean"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	msg := extractErrorMessage(t, resp)
	if msg == "" {
		t.Fatalf("expected variable-validation error, got %+v", resp)
	}

	if resp.Data != nil {
		t.Errorf("expected Data nil on variable-validation error, got %v", resp.Data)
	}
}

func TestResolve_IntrospectionQueryReturnsSchemaData(t *testing.T) {
	t.Parallel()

	ctrl := newTestController(t)

	resp, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{
		OperationName: "",
		Query:         `{ __schema { types { name } } }`,
		Variables:     nil,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp == nil {
		t.Fatal("expected response, got nil")
	}

	if resp.Errors != nil {
		t.Fatalf("expected no errors on introspection query, got %+v", resp.Errors)
	}

	data, ok := resp.Data.(map[string]any)
	if !ok {
		t.Fatalf("expected map data from introspection, got %T", resp.Data)
	}

	if _, hasSchema := data["__schema"]; !hasSchema {
		t.Errorf("expected __schema field in introspection response, got %v", data)
	}
}

func TestResolve_RemoteRelationshipSuccess(t *testing.T) {
	t.Parallel()

	// Two memconnectors with a cross-connector array relationship. Driving
	// Resolve directly (rather than through HandlerPost) confirms the planner
	// is wired with the supplied relationships and the resolver path produces
	// a clean envelope with an "orders" field stitched onto each parent.
	usersResponse := []any{
		map[string]any{"id": "1", "name": "Alice"},
		map[string]any{"id": "2", "name": "Bob"},
	}

	connA, err := memconnector.New(
		[]*graph.ObjectType{
			memconnector.Object(
				"User",
				memconnector.ID("id"),
				memconnector.String("name"),
				memconnector.Field("orders",
					memconnector.NonNullList(memconnector.NonNull("Order"))),
			),
		},
		[]memconnector.QueryDef{
			memconnector.Query(
				"users",
				graph.NewNonNullListType(graph.NewNonNullType("User")),
				usersResponse,
			),
		},
	)
	if err != nil {
		t.Fatalf("memconnector.New(connA): %v", err)
	}

	ordersResponse := []any{
		map[string]any{"id": "o1", "userId": "1", "product": "Widget"},
		map[string]any{"id": "o2", "userId": "2", "product": "Gadget"},
	}

	connB, err := memconnector.New(
		[]*graph.ObjectType{
			memconnector.Object(
				"Order",
				memconnector.ID("id"),
				memconnector.String("userId"),
				memconnector.String("product"),
			),
		},
		[]memconnector.QueryDef{
			memconnector.Query(
				"orders",
				graph.NewNonNullListType(graph.NewNonNullType("Order")),
				ordersResponse,
			),
		},
	)
	if err != nil {
		t.Fatalf("memconnector.New(connB): %v", err)
	}

	relationships := map[string][]*plannerpkg.RelationshipMetadata{
		"a": {
			{
				Name:              "orders",
				SourceType:        "User",
				TargetConnector:   "b",
				TargetTable:       "orders",
				TargetTableSchema: "",
				JoinMapping:       map[string]string{"id": "userId"},
				IsArray:           true,
				IsArrayAggregate:  false,
				IsRemote:          true,
				LHSFields:         nil,
				RemoteFieldPath:   nil,
			},
		},
	}

	logger := slog.New(slog.DiscardHandler)

	ctrl, err := controller.NewFromConnectors(
		testAdminSecret,
		map[string]connector.Connector{"a": connA, "b": connB},
		relationships,
		logger,
	)
	if err != nil {
		t.Fatalf("NewFromConnectors: %v", err)
	}

	resp, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{
		OperationName: "",
		Query:         `{ users { id orders { id product } } }`,
		Variables:     nil,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp.Errors != nil {
		t.Fatalf("expected no errors, got %+v", resp.Errors)
	}

	data, ok := resp.Data.(map[string]any)
	if !ok {
		t.Fatalf("expected map data, got %T (raw=%v)", resp.Data, resp.Data)
	}

	users, ok := data["users"].([]any)
	if !ok || len(users) != 2 {
		t.Fatalf("expected 2 users in data, got %v", data["users"])
	}

	for i, u := range users {
		userMap, ok := u.(map[string]any)
		if !ok {
			t.Fatalf("user[%d] not a map: %v", i, u)
		}

		if _, hasOrders := userMap["orders"]; !hasOrders {
			t.Errorf("user[%d] missing stitched 'orders' field: %v", i, userMap)
		}
	}
}

// execErrConnector wraps a real connector but overrides Execute to return a
// fixed error. It is used to drive the resolveRemoteRelationships error
// branches: the embedded connector supplies a correct GetSchema/GetTypeName so
// the planner wires the remote relationship exactly as it would in production,
// while Execute (invoked only through the remote-relationship resolver path
// for the wrapped target connector) deterministically fails.
type execErrConnector struct {
	connector.Connector

	execErr error
}

func (c execErrConnector) Execute(
	context.Context,
	*ast.OperationDefinition,
	ast.FragmentDefinitionList,
	map[string]any,
	string,
	map[string]any,
	*slog.Logger,
) (map[string]any, error) {
	return nil, c.execErr
}

// remoteRelationshipControllerWithTargetExecErr builds the same two-connector
// cross-connector array relationship as TestResolve_RemoteRelationshipSuccess,
// but wraps the target connector ("b") so its Execute — reached only via the
// remote-relationship resolver — returns targetExecErr. This exercises the
// real planner + real RemoteRelationshipResolver path so the error surfaces
// through resolveRemoteRelationships, not a re-implementation.
func remoteRelationshipControllerWithTargetExecErr(
	t *testing.T, targetExecErr error,
) *controller.Controller {
	t.Helper()

	usersResponse := []any{
		map[string]any{"id": "1", "name": "Alice"},
		map[string]any{"id": "2", "name": "Bob"},
	}

	connA, err := memconnector.New(
		[]*graph.ObjectType{
			memconnector.Object(
				"User",
				memconnector.ID("id"),
				memconnector.String("name"),
				memconnector.Field("orders",
					memconnector.NonNullList(memconnector.NonNull("Order"))),
			),
		},
		[]memconnector.QueryDef{
			memconnector.Query(
				"users",
				graph.NewNonNullListType(graph.NewNonNullType("User")),
				usersResponse,
			),
		},
	)
	if err != nil {
		t.Fatalf("memconnector.New(connA): %v", err)
	}

	connB, err := memconnector.New(
		[]*graph.ObjectType{
			memconnector.Object(
				"Order",
				memconnector.ID("id"),
				memconnector.String("userId"),
				memconnector.String("product"),
			),
		},
		[]memconnector.QueryDef{
			memconnector.Query(
				"orders",
				graph.NewNonNullListType(graph.NewNonNullType("Order")),
				[]any{},
			),
		},
	)
	if err != nil {
		t.Fatalf("memconnector.New(connB): %v", err)
	}

	relationships := map[string][]*plannerpkg.RelationshipMetadata{
		"a": {
			{
				Name:              "orders",
				SourceType:        "User",
				TargetConnector:   "b",
				TargetTable:       "orders",
				TargetTableSchema: "",
				JoinMapping:       map[string]string{"id": "userId"},
				IsArray:           true,
				IsArrayAggregate:  false,
				IsRemote:          true,
				LHSFields:         nil,
				RemoteFieldPath:   nil,
			},
		},
	}

	ctrl, err := controller.NewFromConnectors(
		testAdminSecret,
		map[string]connector.Connector{
			"a": connA,
			"b": execErrConnector{Connector: connB, execErr: targetExecErr},
		},
		relationships,
		slog.New(slog.DiscardHandler),
	)
	if err != nil {
		t.Fatalf("NewFromConnectors: %v", err)
	}

	return ctrl
}

func TestResolve_RemoteRelationshipRawErrorIsSanitized(t *testing.T) {
	t.Parallel()

	// A raw pgx/SQLite-style driver error from the remote-relationship target
	// connector must reach the client only through sanitizeConnectorError: a
	// generic message with a trace id, never the raw constraint/data
	// detail.
	rawErr := errors.New( //nolint:err113 // test sentinel error used to verify error propagation
		"ERROR: duplicate key value violates unique constraint " +
			"\"orders_pkey\" (SQLSTATE 23505): Key (id)=(o1) already exists",
	)

	ctrl := remoteRelationshipControllerWithTargetExecErr(t, rawErr)

	resp, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{
		OperationName: "",
		Query:         `{ users { id orders { id product } } }`,
		Variables:     nil,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	msg := extractErrorMessage(t, resp)

	if !strings.Contains(msg, "internal server error") {
		t.Errorf("expected generic internal-server-error message, got %q", msg)
	}

	if !strings.Contains(msg, "trace id:") {
		t.Errorf("expected trace id in sanitized message, got %q", msg)
	}

	for _, secret := range []string{"orders_pkey", "23505", "duplicate key", "(id)=(o1)"} {
		if strings.Contains(msg, secret) {
			t.Errorf("sanitized message %q leaked raw driver detail %q", msg, secret)
		}
	}
}

func TestResolve_RemoteRelationshipStructuredErrorPassesThrough(t *testing.T) {
	t.Parallel()

	// A *remoteschema.GraphQLError from a trusted remote schema must pass
	// through verbatim (message/path/extensions per RemoteError.AsMap), not be
	// sanitized — mirroring the executeConnectors primary-path branch.
	structuredErr := remoteschema.NewGraphQLError([]remoteschema.RemoteError{
		{
			Message:    "remote validation failed",
			Path:       []any{"orders", 0, "product"},
			Locations:  nil,
			Extensions: map[string]any{"code": "BAD_USER_INPUT"},
		},
	})

	ctrl := remoteRelationshipControllerWithTargetExecErr(t, structuredErr)

	resp, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{
		OperationName: "",
		Query:         `{ users { id orders { id product } } }`,
		Variables:     nil,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	errs, ok := resp.Errors.([]map[string]any)
	if !ok || len(errs) != 1 {
		t.Fatalf("expected exactly one structured error, got %+v", resp.Errors)
	}

	got := errs[0]

	if msg, _ := got["message"].(string); msg != "remote validation failed" {
		t.Errorf("expected verbatim remote message, got %q", msg)
	}

	if strings.Contains(getMessage(got), "trace id:") {
		t.Errorf("structured error must NOT be sanitized, got %+v", got)
	}

	path, _ := got["path"].([]any)
	if len(path) != 3 || path[0] != "orders" || path[2] != "product" {
		t.Errorf("expected verbatim path [orders 0 product], got %v", got["path"])
	}

	ext, _ := got["extensions"].(map[string]any)
	if ext["code"] != "BAD_USER_INPUT" {
		t.Errorf("expected verbatim extensions, got %v", got["extensions"])
	}
}

func TestResolve_RemoteRelationshipExecutionValidationErrorUsesClientPath(t *testing.T) {
	t.Parallel()

	queryRoot := "query_root"

	sourceSchema := &graph.Schema{
		Types: []*graph.ObjectType{
			graphTestObject(
				"query_root",
				graphTestField(
					"users",
					graph.NewNonNullListType(graph.NewNonNullType("User")),
				),
			),
			graphTestObject(
				"User",
				graphTestField("id", graph.NewNonNullType("ID")),
				graphTestField(
					"orders",
					graph.NewNonNullListType(graph.NewNonNullType("Order")),
					graphTestLimitArgument(),
				),
			),
		},
		Scalars:          nil,
		Enums:            nil,
		Interfaces:       nil,
		Unions:           nil,
		Inputs:           nil,
		Directives:       nil,
		QueryType:        &queryRoot,
		MutationType:     nil,
		SubscriptionType: nil,
	}

	targetSchema := &graph.Schema{
		Types: []*graph.ObjectType{
			graphTestObject(
				"query_root",
				graphTestField(
					"orders",
					graph.NewNonNullListType(graph.NewNonNullType("Order")),
					graphTestLimitArgument(),
				),
			),
			graphTestObject(
				"Order",
				graphTestField("id", graph.NewNonNullType("ID")),
				graphTestField("userId", graph.NewNamedType("ID")),
			),
		},
		Scalars:          nil,
		Enums:            nil,
		Interfaces:       nil,
		Unions:           nil,
		Inputs:           nil,
		Directives:       nil,
		QueryType:        &queryRoot,
		MutationType:     nil,
		SubscriptionType: nil,
	}

	var targetExecuted bool

	sourceConn := staticConnector{
		schemas: map[string]*graph.Schema{"admin": sourceSchema},
		types:   nil,
		execute: func() (map[string]any, error) {
			return map[string]any{
				"users": []any{map[string]any{"id": "u1"}},
			}, nil
		},
		validate: nil,
	}
	targetConn := staticConnector{
		schemas: map[string]*graph.Schema{"admin": targetSchema},
		types:   nil,
		execute: func() (map[string]any, error) {
			targetExecuted = true

			return nil, negativeLimitValidationError(t, "orders")
		},
		validate: nil,
	}

	relationships := map[string][]*plannerpkg.RelationshipMetadata{
		"source": {
			{
				Name:              "orders",
				SourceType:        "User",
				TargetConnector:   "target",
				TargetTable:       "orders",
				TargetTableSchema: "",
				JoinMapping:       map[string]string{"id": "userId"},
				IsArray:           true,
				IsArrayAggregate:  false,
				IsRemote:          true,
				LHSFields:         nil,
				RemoteFieldPath:   nil,
			},
		},
	}

	ctrl, err := controller.NewFromConnectors(
		testAdminSecret,
		map[string]connector.Connector{
			"source": sourceConn,
			"target": targetConn,
		},
		relationships,
		slog.New(slog.DiscardHandler),
	)
	if err != nil {
		t.Fatalf("NewFromConnectors: %v", err)
	}

	resp, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{
		OperationName: "",
		Query:         `{ users { id orders(limit: -1) { id } } }`,
		Variables:     nil,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !targetExecuted {
		t.Fatal("target remote relationship was not executed")
	}

	if resp.Data != nil {
		t.Errorf("validation failure must return no data, got %+v", resp.Data)
	}

	errs, ok := resp.Errors.([]map[string]any)
	if !ok || len(errs) != 1 {
		t.Fatalf("expected exactly one error, got %+v", resp.Errors)
	}

	if got := getMessage(errs[0]); got != "unexpected negative value for limit" {
		t.Errorf("unexpected validation message: %q", got)
	}

	ext, ok := errs[0]["extensions"].(map[string]any)
	if !ok {
		t.Fatalf("error missing extensions: %+v", errs[0])
	}

	if ext["code"] != "validation-failed" {
		t.Errorf("expected validation-failed code, got %v", ext["code"])
	}

	wantPath := "$.selectionSet.users.selectionSet.orders.args.limit"
	if ext["path"] != wantPath {
		t.Errorf("expected path %q, got %v", wantPath, ext["path"])
	}
}

// getMessage returns the "message" entry of a GraphQL error map as a string,
// or "" when absent.
func getMessage(m map[string]any) string {
	msg, _ := m["message"].(string)

	return msg
}

type staticConnector struct {
	schemas  map[string]*graph.Schema
	types    map[string]string
	execute  func() (map[string]any, error)
	validate func() error
}

func (c staticConnector) GetSchema() (map[string]*graph.Schema, error) {
	return c.schemas, nil
}

func (c staticConnector) Execute(
	context.Context,
	*ast.OperationDefinition,
	ast.FragmentDefinitionList,
	map[string]any,
	string,
	map[string]any,
	*slog.Logger,
) (map[string]any, error) {
	if c.execute == nil {
		return map[string]any{}, nil
	}

	return c.execute()
}

func (c staticConnector) ValidateOperation(
	*ast.OperationDefinition,
	ast.FragmentDefinitionList,
	map[string]any,
	string,
	map[string]any,
) error {
	if c.validate == nil {
		return nil
	}

	return c.validate()
}

func (c staticConnector) GetTypeName(identifier string) string {
	return c.types[identifier]
}

func (c staticConnector) Close() {}

func graphTestObject(name string, fields ...*graph.Field) *graph.ObjectType {
	return &graph.ObjectType{
		Name:        name,
		Description: "",
		Fields:      fields,
		Interfaces:  nil,
		Directives:  nil,
	}
}

func graphTestField(name string, typ *graph.Type, args ...*graph.Argument) *graph.Field {
	return &graph.Field{
		Name:        name,
		Description: "",
		Type:        typ,
		Arguments:   args,
		Directives:  nil,
	}
}

func graphTestLimitArgument() *graph.Argument {
	return &graph.Argument{
		Name:         "limit",
		Description:  "",
		Type:         graph.NewNamedType("Int"),
		DefaultValue: nil,
		Directives:   nil,
	}
}

// validateErrConnector wraps a real connector but overrides ValidateOperation
// to return a fixed error, so a multi-connector request can be driven into the
// "one root field fails query validation" branch without a real SQL backend.
type validateErrConnector struct {
	connector.Connector

	validateErr error
}

func (c validateErrConnector) ValidateOperation(
	*ast.OperationDefinition,
	ast.FragmentDefinitionList,
	map[string]any,
	string,
	map[string]any,
) error {
	return c.validateErr
}

// validateSpyConnector wraps a real connector and records pre-execution
// validation calls while preserving the wrapped connector's Execute behavior.
type validateSpyConnector struct {
	connector.Connector

	validateCalls *int
}

func (c validateSpyConnector) ValidateOperation(
	*ast.OperationDefinition,
	ast.FragmentDefinitionList,
	map[string]any,
	string,
	map[string]any,
) error {
	(*c.validateCalls)++

	return nil
}

// execSpyConnector wraps a real connector and records whether Execute was
// called. It is the side-effect proxy: in a multi-connector request where a
// sibling connector fails query validation, a correct validate-before-execute
// controller must never reach this connector's Execute (which, for a real SQL
// mutation, would have committed rows).
type execSpyConnector struct {
	connector.Connector

	executed *bool
}

func (c execSpyConnector) Execute(
	ctx context.Context,
	operation *ast.OperationDefinition,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	logger *slog.Logger,
) (map[string]any, error) {
	*c.executed = true

	res, err := c.Connector.Execute(
		ctx, operation, fragments, variables, role, sessionVariables, logger,
	)
	if err != nil {
		return res, fmt.Errorf("exec spy: %w", err)
	}

	return res, nil
}

// TestResolve_MultiConnectorQueryValidationErrorAbortsWholeRequest pins the
// Hasura-matching contract that a query-validation failure in one root field
// rejects the whole multi-connector request: no data, only the validation-failed
// envelope, and crucially the sibling connector that owns the other root field
// is never executed (so a sibling mutation would commit nothing). Two
// memconnectors own one root field each; the "items" connector's
// ValidateOperation fails, the "things" connector spies on Execute. Because map
// iteration order is randomized, the spy assertion would flake if the fix only
// stopped on the invalid connector after already executing the valid one — it
// holds only because validation runs for every connector before any executes.
func TestResolve_MultiConnectorQueryValidationErrorAbortsWholeRequest(t *testing.T) {
	t.Parallel()

	itemsConn, err := memconnector.New(
		[]*graph.ObjectType{
			memconnector.Object("Item", memconnector.ID("id")),
		},
		[]memconnector.QueryDef{
			memconnector.Query(
				"items",
				graph.NewNonNullListType(graph.NewNonNullType("Item")),
				[]any{map[string]any{"id": "i1"}},
			),
		},
	)
	if err != nil {
		t.Fatalf("memconnector.New(items): %v", err)
	}

	thingsConn, err := memconnector.New(
		[]*graph.ObjectType{
			memconnector.Object("Thing", memconnector.ID("id")),
		},
		[]memconnector.QueryDef{
			memconnector.Query(
				"things",
				graph.NewNonNullListType(graph.NewNonNullType("Thing")),
				[]any{map[string]any{"id": "t1"}},
			),
		},
	)
	if err != nil {
		t.Fatalf("memconnector.New(things): %v", err)
	}

	vErr := distinctOnOrderByMismatchError(t, "items")

	var thingsExecuted bool

	ctrl, err := controller.NewFromConnectors(
		testAdminSecret,
		map[string]connector.Connector{
			"items":  validateErrConnector{Connector: itemsConn, validateErr: vErr},
			"things": execSpyConnector{Connector: thingsConn, executed: &thingsExecuted},
		},
		nil,
		slog.New(slog.DiscardHandler),
	)
	if err != nil {
		t.Fatalf("NewFromConnectors: %v", err)
	}

	resp, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{
		OperationName: "",
		Query:         `{ items { id } things { id } }`,
		Variables:     nil,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp.Data != nil {
		t.Errorf("validation failure must return no data, got %+v", resp.Data)
	}

	if thingsExecuted {
		t.Error(
			"sibling connector was executed despite a query-validation failure in another root field",
		)
	}

	errs, ok := resp.Errors.([]map[string]any)
	if !ok || len(errs) != 1 {
		t.Fatalf("expected exactly one error, got %+v", resp.Errors)
	}

	if got := getMessage(
		errs[0],
	); got != `"distinct_on" columns must match initial "order_by" columns` {
		t.Errorf("unexpected validation message: %q", got)
	}

	ext, _ := errs[0]["extensions"].(map[string]any)
	if ext["code"] != "validation-failed" {
		t.Errorf("expected validation-failed code, got %v", errs[0]["extensions"])
	}

	if ext["path"] != "$.selectionSet.items.args" {
		t.Errorf("expected stamped argument path, got %v", ext["path"])
	}
}

func TestResolve_RemoteRelationshipValidationErrorAbortsMutation(t *testing.T) {
	t.Parallel()

	queryRoot := "query_root"
	mutationRoot := "mutation_root"

	sourceSchema := &graph.Schema{
		Types: []*graph.ObjectType{
			graphTestObject(
				"query_root",
				graphTestField("source_noop", graph.NewNamedType("String")),
			),
			graphTestObject(
				"mutation_root",
				graphTestField(
					"insert_users",
					graph.NewNonNullType("UserMutationResponse"),
				),
			),
			graphTestObject(
				"UserMutationResponse",
				graphTestField(
					"returning",
					graph.NewNonNullListType(graph.NewNonNullType("User")),
				),
			),
			graphTestObject(
				"User",
				graphTestField("id", graph.NewNonNullType("ID")),
				graphTestField(
					"orders",
					graph.NewNonNullListType(graph.NewNonNullType("Order")),
					graphTestLimitArgument(),
				),
			),
		},
		Scalars:          nil,
		Enums:            nil,
		Interfaces:       nil,
		Unions:           nil,
		Inputs:           nil,
		Directives:       nil,
		QueryType:        &queryRoot,
		MutationType:     &mutationRoot,
		SubscriptionType: nil,
	}

	targetSchema := &graph.Schema{
		Types: []*graph.ObjectType{
			graphTestObject(
				"query_root",
				graphTestField(
					"orders",
					graph.NewNonNullListType(graph.NewNonNullType("Order")),
					graphTestLimitArgument(),
				),
			),
			graphTestObject(
				"Order",
				graphTestField("id", graph.NewNonNullType("ID")),
				graphTestField("userId", graph.NewNamedType("ID")),
			),
		},
		Scalars:          nil,
		Enums:            nil,
		Interfaces:       nil,
		Unions:           nil,
		Inputs:           nil,
		Directives:       nil,
		QueryType:        &queryRoot,
		MutationType:     nil,
		SubscriptionType: nil,
	}

	var (
		sourceExecuted bool
		targetExecuted bool
	)

	sourceConn := staticConnector{
		schemas: map[string]*graph.Schema{"admin": sourceSchema},
		types:   nil,
		execute: func() (map[string]any, error) {
			sourceExecuted = true

			return map[string]any{
				"insert_users": map[string]any{
					"returning": []any{map[string]any{"id": "u1"}},
				},
			}, nil
		},
		validate: nil,
	}
	targetConn := staticConnector{
		schemas: map[string]*graph.Schema{"admin": targetSchema},
		types:   nil,
		execute: func() (map[string]any, error) {
			targetExecuted = true

			return nil, negativeLimitValidationError(t, "orders")
		},
		validate: func() error {
			return negativeLimitValidationError(t, "orders")
		},
	}

	relationships := map[string][]*plannerpkg.RelationshipMetadata{
		"source": {
			{
				Name:              "orders",
				SourceType:        "User",
				TargetConnector:   "target",
				TargetTable:       "orders",
				TargetTableSchema: "",
				JoinMapping:       map[string]string{"id": "userId"},
				IsArray:           true,
				IsArrayAggregate:  false,
				IsRemote:          true,
				LHSFields:         nil,
				RemoteFieldPath:   nil,
			},
		},
	}

	ctrl, err := controller.NewFromConnectors(
		testAdminSecret,
		map[string]connector.Connector{
			"source": sourceConn,
			"target": targetConn,
		},
		relationships,
		slog.New(slog.DiscardHandler),
	)
	if err != nil {
		t.Fatalf("NewFromConnectors: %v", err)
	}

	resp, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{
		OperationName: "",
		Query: `mutation {
			insert_users {
				returning {
					id
					orders(limit: -1) { id }
				}
			}
		}`,
		Variables: nil,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if sourceExecuted {
		t.Fatal("source mutation executed before remote relationship arguments were validated")
	}

	if targetExecuted {
		t.Fatal("target remote relationship executed instead of failing in pre-validation")
	}

	if resp.Data != nil {
		t.Errorf("validation failure must return no data, got %+v", resp.Data)
	}

	errs, ok := resp.Errors.([]map[string]any)
	if !ok || len(errs) != 1 {
		t.Fatalf("expected exactly one error, got %+v", resp.Errors)
	}

	if got := getMessage(errs[0]); got != "unexpected negative value for limit" {
		t.Errorf("unexpected validation message: %q", got)
	}

	ext, ok := errs[0]["extensions"].(map[string]any)
	if !ok {
		t.Fatalf("error missing extensions: %+v", errs[0])
	}

	if ext["code"] != "validation-failed" {
		t.Errorf("expected validation-failed code, got %v", ext["code"])
	}

	wantPath := "$.selectionSet.insert_users.selectionSet.returning.selectionSet.orders.args.limit"
	if ext["path"] != wantPath {
		t.Errorf("expected path %q, got %v", wantPath, ext["path"])
	}
}

func TestResolve_MultiConnectorQueryValidationErrorsAreDeterministic(t *testing.T) {
	t.Parallel()

	itemsConn, err := memconnector.New(
		[]*graph.ObjectType{
			memconnector.Object("Item", memconnector.ID("id")),
		},
		[]memconnector.QueryDef{
			memconnector.Query(
				"items",
				graph.NewNonNullListType(graph.NewNonNullType("Item")),
				[]any{map[string]any{"id": "i1"}},
			),
		},
	)
	if err != nil {
		t.Fatalf("memconnector.New(items): %v", err)
	}

	thingsConn, err := memconnector.New(
		[]*graph.ObjectType{
			memconnector.Object("Thing", memconnector.ID("id")),
		},
		[]memconnector.QueryDef{
			memconnector.Query(
				"things",
				graph.NewNonNullListType(graph.NewNonNullType("Thing")),
				[]any{map[string]any{"id": "t1"}},
			),
		},
	)
	if err != nil {
		t.Fatalf("memconnector.New(things): %v", err)
	}

	ctrl, err := controller.NewFromConnectors(
		testAdminSecret,
		map[string]connector.Connector{
			"z_items": validateErrConnector{
				Connector:   itemsConn,
				validateErr: distinctOnOrderByMismatchError(t, "items"),
			},
			"a_things": validateErrConnector{
				Connector:   thingsConn,
				validateErr: distinctOnOrderByMismatchError(t, "things"),
			},
		},
		nil,
		slog.New(slog.DiscardHandler),
	)
	if err != nil {
		t.Fatalf("NewFromConnectors: %v", err)
	}

	resp, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{
		OperationName: "",
		Query:         `{ items { id } things { id } }`,
		Variables:     nil,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp.Data != nil {
		t.Errorf("validation failure must return no data, got %+v", resp.Data)
	}

	errs, ok := resp.Errors.([]map[string]any)
	if !ok || len(errs) != 2 {
		t.Fatalf("expected two structured errors, got %+v", resp.Errors)
	}

	// The query asks for items first, but connector names sort as a_things before
	// z_items. This pins the validation-error envelope to a stable connector-name
	// order instead of Go's randomized map iteration order.
	wantPaths := []string{
		"$.selectionSet.things.args",
		"$.selectionSet.items.args",
	}

	for i, wantPath := range wantPaths {
		ext, ok := errs[i]["extensions"].(map[string]any)
		if !ok {
			t.Fatalf("error %d missing extensions: %+v", i, errs[i])
		}

		if ext["code"] != "validation-failed" {
			t.Errorf("error %d expected validation-failed code, got %v", i, ext["code"])
		}

		if ext["path"] != wantPath {
			t.Errorf("error %d expected path %q, got %v", i, wantPath, ext["path"])
		}
	}
}

func TestResolve_SingleConnectorSkipsPreExecutionValidation(t *testing.T) {
	t.Parallel()

	conn, err := memconnector.New(
		[]*graph.ObjectType{
			memconnector.Object(
				"User",
				memconnector.ID("id"),
				memconnector.String("name"),
			),
		},
		[]memconnector.QueryDef{
			memconnector.Query(
				"users",
				graph.NewNonNullListType(graph.NewNonNullType("User")),
				[]any{map[string]any{"id": "1", "name": "Alice"}},
			),
		},
	)
	if err != nil {
		t.Fatalf("memconnector.New: %v", err)
	}

	var validateCalls int

	ctrl, err := controller.NewFromConnectors(
		testAdminSecret,
		map[string]connector.Connector{
			"mem": validateSpyConnector{Connector: conn, validateCalls: &validateCalls},
		},
		nil,
		slog.New(slog.DiscardHandler),
	)
	if err != nil {
		t.Fatalf("NewFromConnectors: %v", err)
	}

	resp, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{
		OperationName: "",
		Query:         `{ users { id name } }`,
		Variables:     nil,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp.Errors != nil {
		t.Fatalf("expected no errors, got %+v", resp.Errors)
	}

	if validateCalls != 0 {
		t.Fatalf(
			"single-connector request ran redundant pre-execution validation %d time(s)",
			validateCalls,
		)
	}
}

// --- NewFromConnectors direct happy-path -----------------------------------

func TestNewFromConnectors_PlannerWiredWithRelationships(t *testing.T) {
	t.Parallel()

	// Build two connectors and pass a non-trivial relationships map, then
	// drive Resolve to confirm the planner consults the relationships argument
	// (any other wiring would fail to stitch the cross-connector field).
	connA, err := memconnector.New(
		[]*graph.ObjectType{
			memconnector.Object(
				"User",
				memconnector.ID("id"),
				memconnector.Field("orders",
					memconnector.NonNullList(memconnector.NonNull("Order"))),
			),
		},
		[]memconnector.QueryDef{
			memconnector.Query(
				"users",
				graph.NewNonNullListType(graph.NewNonNullType("User")),
				[]any{map[string]any{"id": "1"}},
			),
		},
	)
	if err != nil {
		t.Fatalf("memconnector.New(connA): %v", err)
	}

	connB, err := memconnector.New(
		[]*graph.ObjectType{
			memconnector.Object(
				"Order",
				memconnector.ID("id"),
				memconnector.String("userId"),
			),
		},
		[]memconnector.QueryDef{
			memconnector.Query(
				"orders",
				graph.NewNonNullListType(graph.NewNonNullType("Order")),
				[]any{},
			),
		},
	)
	if err != nil {
		t.Fatalf("memconnector.New(connB): %v", err)
	}

	relationships := map[string][]*plannerpkg.RelationshipMetadata{
		"a": {
			{
				Name:              "orders",
				SourceType:        "User",
				TargetConnector:   "b",
				TargetTable:       "orders",
				TargetTableSchema: "",
				JoinMapping:       map[string]string{"id": "userId"},
				IsArray:           true,
				IsArrayAggregate:  false,
				IsRemote:          true,
				LHSFields:         nil,
				RemoteFieldPath:   nil,
			},
		},
	}

	logger := slog.New(slog.DiscardHandler)

	ctrl, err := controller.NewFromConnectors(
		testAdminSecret,
		map[string]connector.Connector{"a": connA, "b": connB},
		relationships,
		logger,
	)
	if err != nil {
		t.Fatalf("NewFromConnectors: %v", err)
	}

	if ctrl == nil {
		t.Fatal("expected non-nil controller")
	}

	// A query requesting the relationship field forces the planner to look up
	// the "a"→"orders"→"b" relationship; without the relationships argument
	// reaching the planner, the field would either be rejected by validation
	// (no schema entry) or fall through to a no-connector error.
	resp, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{
		OperationName: "",
		Query:         `{ users { id orders { id } } }`,
		Variables:     nil,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp.Errors != nil {
		t.Fatalf("expected no errors, got %+v", resp.Errors)
	}

	data, ok := resp.Data.(map[string]any)
	if !ok {
		t.Fatalf("expected map data, got %T", resp.Data)
	}

	users, ok := data["users"].([]any)
	if !ok || len(users) != 1 {
		t.Fatalf("expected 1 user, got %v", data["users"])
	}

	user, ok := users[0].(map[string]any)
	if !ok {
		t.Fatalf("user not a map: %v", users[0])
	}

	if _, hasOrders := user["orders"]; !hasOrders {
		t.Errorf("expected stitched 'orders' field on user, got %v", user)
	}
}

func TestNewFromConnectors_NilRelationshipsResolvesPlainQuery(t *testing.T) {
	t.Parallel()

	// nil relationships is a documented input. The planner must still be
	// constructed and drive an ordinary single-connector query.
	usersResponse := jsontext.Value(`[{"id":"1","name":"Alice"}]`)

	conn, err := memconnector.New(
		[]*graph.ObjectType{
			memconnector.Object(
				"User",
				memconnector.ID("id"),
				memconnector.String("name"),
			),
		},
		[]memconnector.QueryDef{
			memconnector.Query(
				"users",
				graph.NewNonNullListType(graph.NewNonNullType("User")),
				usersResponse,
			),
		},
	)
	if err != nil {
		t.Fatalf("memconnector.New: %v", err)
	}

	logger := slog.New(slog.DiscardHandler)

	ctrl, err := controller.NewFromConnectors(
		testAdminSecret,
		map[string]connector.Connector{"mem": conn},
		nil,
		logger,
	)
	if err != nil {
		t.Fatalf("NewFromConnectors: %v", err)
	}

	resp, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{
		OperationName: "",
		Query:         `{ users { id name } }`,
		Variables:     nil,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp.Errors != nil {
		t.Fatalf("expected no errors, got %+v", resp.Errors)
	}
}
