package controller_test

import (
	"bytes"
	"encoding/json/jsontext"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector"
	"github.com/nhost/nhost/services/constellation/connector/memconnector"
	"github.com/nhost/nhost/services/constellation/controller"
	plannerpkg "github.com/nhost/nhost/services/constellation/controller/planner"
	"github.com/nhost/nhost/services/constellation/graph"
)

// postQuery drives a GraphQL POST through the admin-secret router and returns
// the decoded JSON body and HTTP status.
func postQuery(t *testing.T, ctrl *controller.Controller, body string) (map[string]any, int) {
	t.Helper()

	router := newTestRouter(t, ctrl)

	req := httptest.NewRequest(http.MethodPost, "/graphql", bytes.NewReader([]byte(body)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	return readJSONBody(t, w), w.Code
}

// --- INCON_MEDIUM_11: root-level fragments -------------------------------

func TestHandlerPost_RootFragmentSpreadResolvesData(t *testing.T) {
	t.Parallel()

	body, code := postQuery(t, newTestController(t),
		`{"query":"query { ...Roots } fragment Roots on query_root { users { id name } }"}`,
	)
	if code != http.StatusOK {
		t.Fatalf("expected 200, got %d", code)
	}

	if _, hasErr := body["errors"]; hasErr {
		t.Fatalf("unexpected errors: %v", body["errors"])
	}

	data, ok := body["data"].(map[string]any)
	if !ok {
		t.Fatalf("expected data object, got %v", body["data"])
	}

	if _, hasUsers := data["users"]; !hasUsers {
		t.Fatalf("root fragment spread dropped data: %v", data)
	}
}

func TestHandlerPost_RootInlineFragmentResolvesData(t *testing.T) {
	t.Parallel()

	body, code := postQuery(t, newTestController(t),
		`{"query":"{ ... on query_root { users { id name } } }"}`,
	)
	if code != http.StatusOK {
		t.Fatalf("expected 200, got %d", code)
	}

	if _, hasErr := body["errors"]; hasErr {
		t.Fatalf("unexpected errors: %v", body["errors"])
	}

	data, ok := body["data"].(map[string]any)
	if !ok {
		t.Fatalf("expected data object, got %v", body["data"])
	}

	if _, hasUsers := data["users"]; !hasUsers {
		t.Fatalf("root inline fragment dropped data: %v", data)
	}
}

// --- INCON_MEDIUM_12: root __typename -----------------------------------

func TestResolve_RootTypenameResolvesToRootTypeName(t *testing.T) {
	t.Parallel()

	ctrl := newTestController(t)

	resp, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{
		OperationName: "",
		Query:         `{ __typename }`,
		Variables:     nil,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp.Errors != nil {
		t.Fatalf("expected no errors for { __typename }, got %v", resp.Errors)
	}

	data, ok := resp.Data.(map[string]any)
	if !ok {
		t.Fatalf("expected map data, got %T", resp.Data)
	}

	if data["__typename"] != "query_root" {
		t.Fatalf("expected __typename query_root, got %v", data["__typename"])
	}
}

func TestResolve_RootTypenameAliasAndMixedWithData(t *testing.T) {
	t.Parallel()

	ctrl := newTestController(t)

	resp, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{
		OperationName: "",
		Query:         `{ tn: __typename users { id } }`,
		Variables:     nil,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp.Errors != nil {
		t.Fatalf("expected no errors, got %v", resp.Errors)
	}

	data, ok := resp.Data.(map[string]any)
	if !ok {
		t.Fatalf("expected map data, got %T", resp.Data)
	}

	if data["tn"] != "query_root" {
		t.Errorf("expected aliased __typename query_root, got %v", data["tn"])
	}

	if _, hasUsers := data["users"]; !hasUsers {
		t.Errorf("expected users data alongside __typename, got %v", data)
	}
}

// --- INCON_LOW_6: mixed introspection + data -----------------------------

func TestResolve_MixedIntrospectionAndDataReturnsBoth(t *testing.T) {
	t.Parallel()

	ctrl := newTestController(t)

	resp, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{
		OperationName: "",
		Query:         `{ __schema { queryType { name } } users { id name } }`,
		Variables:     nil,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp.Errors != nil {
		t.Fatalf("expected no errors, got %v", resp.Errors)
	}

	data, ok := resp.Data.(map[string]any)
	if !ok {
		t.Fatalf("expected map data, got %T", resp.Data)
	}

	if _, hasSchema := data["__schema"]; !hasSchema {
		t.Errorf("expected __schema in mixed response, got %v", data)
	}

	if _, hasUsers := data["users"]; !hasUsers {
		t.Errorf("expected users data in mixed response (was dropped before fix), got %v", data)
	}
}

func TestResolve_PureIntrospectionUnchanged(t *testing.T) {
	t.Parallel()

	ctrl := newTestController(t)

	resp, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{
		OperationName: "",
		Query:         `{ __schema { queryType { name } } }`,
		Variables:     nil,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp.Errors != nil {
		t.Fatalf("expected no errors, got %v", resp.Errors)
	}

	data, ok := resp.Data.(map[string]any)
	if !ok {
		t.Fatalf("expected map data, got %T", resp.Data)
	}

	if _, hasSchema := data["__schema"]; !hasSchema {
		t.Errorf("expected __schema, got %v", data)
	}

	if _, hasUsers := data["users"]; hasUsers {
		t.Errorf("pure introspection must not invent data fields, got %v", data)
	}
}

// --- INCON_MEDIUM_1: @skip / @include ------------------------------------

func TestHandlerPost_SkipIncludeRootField(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name      string
		query     string
		wantUsers bool
	}{
		{
			name:      "skip true drops field",
			query:     `{ users @skip(if: true) { id } }`,
			wantUsers: false,
		},
		{
			name:      "skip false keeps field",
			query:     `{ users @skip(if: false) { id } }`,
			wantUsers: true,
		},
		{
			name:      "include false drops field",
			query:     `{ users @include(if: false) { id } }`,
			wantUsers: false,
		},
		{
			name:      "include true keeps field",
			query:     `{ users @include(if: true) { id } }`,
			wantUsers: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			// The directive queries contain no JSON-special characters, so they
			// embed directly into the request body.
			reqBody := `{"query":"` + tc.query + `"}`

			body, code := postQuery(t, newTestController(t), reqBody)
			if code != http.StatusOK {
				t.Fatalf("expected 200, got %d", code)
			}

			if _, hasErr := body["errors"]; hasErr {
				t.Fatalf("unexpected errors: %v", body["errors"])
			}

			data, _ := body["data"].(map[string]any)
			_, hasUsers := data["users"]

			if hasUsers != tc.wantUsers {
				t.Fatalf("users present=%v, want %v (data=%v)", hasUsers, tc.wantUsers, data)
			}
		})
	}
}

func TestResolve_SkipVariableDriven(t *testing.T) {
	t.Parallel()

	ctrl := newTestController(t)

	resp, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{
		OperationName: "Q",
		Query:         `query Q($s: Boolean!) { users @skip(if: $s) { id } }`,
		Variables:     map[string]any{"s": true},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp.Errors != nil {
		t.Fatalf("unexpected errors: %v", resp.Errors)
	}

	data, ok := resp.Data.(map[string]any)
	if !ok {
		t.Fatalf("expected map data, got %T (%v)", resp.Data, resp.Data)
	}

	if _, hasUsers := data["users"]; hasUsers {
		t.Fatalf("variable-driven @skip(if:true) should drop users, got %v", data)
	}
}

// --- INCON_LOW_10: operation name diagnostics ----------------------------

func TestHandlerPost_UnmatchedOperationNameReturnsNotFound(t *testing.T) {
	t.Parallel()

	body, _ := postQuery(t, newTestController(t),
		`{"query":"query A { users { id } } query B { users { name } }","operationName":"C"}`,
	)

	errs, ok := body["errors"].([]any)
	if !ok || len(errs) == 0 {
		t.Fatalf("expected an error, got %v", body)
	}

	errObj, _ := errs[0].(map[string]any)

	msg, _ := errObj["message"].(string)
	if msg != `no such operation found in the document: "C"` {
		t.Fatalf("expected Hasura not-found message naming the operation, got %q", msg)
	}

	ext, _ := errObj["extensions"].(map[string]any)
	if ext["code"] != "validation-failed" {
		t.Errorf("expected validation-failed code, got %v", ext["code"])
	}
}

func TestHandlerPost_NoNameMultipleOperationsStillReportsAmbiguity(t *testing.T) {
	t.Parallel()

	body, _ := postQuery(t, newTestController(t),
		`{"query":"query A { users { id } } query B { users { name } }"}`,
	)

	errs, ok := body["errors"].([]any)
	if !ok || len(errs) == 0 {
		t.Fatalf("expected an error, got %v", body)
	}

	msg, _ := errs[0].(map[string]any)["message"].(string)
	if !strings.Contains(msg, "exactly one operation has to be present") {
		t.Fatalf("expected the ambiguous-operation message, got %q", msg)
	}
}

// --- BUG_LOW_6: phantom join columns on the partial-error path -----------

// TestResolve_PhantomFieldStrippedOnPartialErrorPath pins that phantom join
// columns the planner injects for a remote relationship never leak into the
// partial `data` payload when a sibling connector errors. Connector "a" owns
// users with a remote "orders" relationship joined on id→userId; the client
// omits id, so id is injected as a phantom. Connector "c" errors, forcing the
// partial-error path that previously skipped phantom cleanup.
func TestResolve_PhantomFieldStrippedOnPartialErrorPath(t *testing.T) {
	t.Parallel()

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
				jsontext.Value(`[{"id":"1","name":"Alice"}]`),
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
				jsontext.Value(`[]`),
			),
		},
	)
	if err != nil {
		t.Fatalf("memconnector.New(connB): %v", err)
	}

	baseC, err := memconnector.New(
		[]*graph.ObjectType{
			memconnector.Object("Thing", memconnector.ID("id")),
		},
		[]memconnector.QueryDef{
			memconnector.Query(
				"failing",
				graph.NewNonNullListType(graph.NewNonNullType("Thing")),
				jsontext.Value(`[]`),
			),
		},
	)
	if err != nil {
		t.Fatalf("memconnector.New(baseC): %v", err)
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
			"b": connB,
			"c": &errorConnector{Connector: baseC, execErr: errSentinel},
		},
		relationships,
		slog.New(slog.DiscardHandler),
	)
	if err != nil {
		t.Fatalf("NewFromConnectors: %v", err)
	}

	resp, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{
		OperationName: "",
		Query:         `{ users { name orders { product } } failing { id } }`,
		Variables:     nil,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// The sibling connector error must surface.
	errs, ok := resp.Errors.([]map[string]any)
	if !ok || len(errs) == 0 {
		t.Fatalf("expected partial errors, got %+v", resp.Errors)
	}

	data, ok := resp.Data.(map[string]any)
	if !ok {
		t.Fatalf("expected partial data map, got %T (%v)", resp.Data, resp.Data)
	}

	users, ok := data["users"].([]any)
	if !ok || len(users) == 0 {
		t.Fatalf("expected partial users data, got %v", data["users"])
	}

	for _, u := range users {
		userMap, ok := u.(map[string]any)
		if !ok {
			t.Fatalf("user not a map: %v", u)
		}

		if _, leaked := userMap["id"]; leaked {
			t.Fatalf("phantom join column 'id' leaked into partial-error data: %v", userMap)
		}
	}
}
