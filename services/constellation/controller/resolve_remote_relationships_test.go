package controller_test

import (
	"encoding/json/jsontext"
	"log/slog"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector"
	"github.com/nhost/nhost/services/constellation/connector/memconnector"
	"github.com/nhost/nhost/services/constellation/controller"
	plannerpkg "github.com/nhost/nhost/services/constellation/controller/planner"
	"github.com/nhost/nhost/services/constellation/graph"
)

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
