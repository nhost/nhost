package connector

import (
	"context"
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"log/slog"
	"testing"
	"time"

	"github.com/nhost/nhost/services/constellation/connector/customization"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/nhost/nhost/services/constellation/subscription"
	"github.com/vektah/gqlparser/v2/ast"
)

// fakeSubHandler is an inline subscription.Handler stub: it records the request
// it was started with and exposes the channel updates are pushed onto.
type fakeSubHandler struct {
	startedOp *ast.OperationDefinition
	ch        chan subscription.Update
	stopped   []string
	shutdown  bool
}

func (f *fakeSubHandler) Start(
	_ context.Context,
	req subscription.Request,
	_ *slog.Logger,
) (<-chan subscription.Update, error) {
	f.startedOp = req.Operation

	return f.ch, nil
}

func (f *fakeSubHandler) Stop(_ context.Context, subscriptionID string) {
	f.stopped = append(f.stopped, subscriptionID)
}

func (f *fakeSubHandler) Shutdown(_ context.Context) { f.shutdown = true }

// fakeConnector is an inline connector.Connector stub. It is NOT
// subscription-capable unless embedded in fakeSubConnector.
//
// Execute returns execData/execErr and records the operation/fragments it was
// invoked with (so tests can assert the decorator reversed them to native
// names before calling through). typeName is returned verbatim by GetTypeName
// and closed records a Close() call so delegation can be asserted.
type fakeConnector struct {
	schema      *graph.Schema
	execData    map[string]any
	execErr     error
	validateErr error
	gotOp       *ast.OperationDefinition
	gotFrags    ast.FragmentDefinitionList
	gotValOp    *ast.OperationDefinition
	typeName    string
	closed      bool
}

func (f *fakeConnector) GetSchema() (map[string]*graph.Schema, error) {
	return map[string]*graph.Schema{metadata.RoleAdmin: f.schema}, nil
}

func (f *fakeConnector) Execute(
	_ context.Context,
	operation *ast.OperationDefinition,
	fragments ast.FragmentDefinitionList,
	_ map[string]any,
	_ string,
	_ map[string]any,
	_ *slog.Logger,
) (map[string]any, error) {
	f.gotOp = operation
	f.gotFrags = fragments

	if f.execData == nil && f.execErr == nil {
		return map[string]any{}, nil
	}

	return f.execData, f.execErr
}

func (f *fakeConnector) ValidateOperation(
	operation *ast.OperationDefinition,
	_ ast.FragmentDefinitionList,
	_ map[string]any,
	_ string,
	_ map[string]any,
) error {
	f.gotValOp = operation

	return f.validateErr
}

func (f *fakeConnector) GetTypeName(string) string { return f.typeName }
func (f *fakeConnector) Close()                    { f.closed = true }

// fakeSubConnector adds subscription capability to fakeConnector.
type fakeSubConnector struct {
	fakeConnector

	handler subscription.Handler
}

func (f *fakeSubConnector) NewSubscriptionHandler(
	_ time.Duration,
	_ *slog.Logger,
) subscription.Handler {
	return f.handler
}

// teamSchema returns a minimal schema with a Team type so a primed Customizer
// maps Team<->LeagueTeam.
func teamSchema() *graph.Schema {
	queryName := "Query"

	return &graph.Schema{
		Types: []*graph.ObjectType{
			{
				Name: "Query",
				Fields: []*graph.Field{
					{
						Name: "teams",
						Type: graph.NewNonNullListType(graph.NewNonNullType("Team")),
					},
				},
			},
			{
				Name: "Team",
				Fields: []*graph.Field{
					{Name: "id", Type: graph.NewNonNullType("ID")},
				},
			},
		},
		QueryType: &queryName,
	}
}

func primedCustomizer() *customization.Customizer {
	c := customization.New(metadata.Customization{
		RootFieldsNamespace: "league",
		TypeNamesPrefix:     "League",
	}, customization.FlavorDatabase)
	c.Apply(teamSchema())

	return c
}

// namespacedSubscriptionOp returns subscription { league { teams { __typename } } }.
func namespacedSubscriptionOp() *ast.OperationDefinition {
	return &ast.OperationDefinition{
		Operation: ast.Subscription,
		SelectionSet: ast.SelectionSet{
			&ast.Field{
				Name: "league",
				SelectionSet: ast.SelectionSet{
					&ast.Field{
						Name: "teams",
						SelectionSet: ast.SelectionSet{
							&ast.Field{Name: "__typename"},
						},
					},
				},
			},
		},
	}
}

func TestCustomizedConnectorNewSubscriptionHandlerNotCapable(t *testing.T) {
	t.Parallel()

	conn, err := newCustomizedConnector(
		"rs",
		&fakeConnector{schema: teamSchema()},
		metadata.Customization{RootFieldsNamespace: "league"},
		customization.FlavorRemoteSchema,
	)
	if err != nil {
		t.Fatalf("newCustomizedConnector: %v", err)
	}

	if h := conn.NewSubscriptionHandler(time.Second, slog.Default()); h != nil {
		t.Errorf("expected nil handler for non-subscription-capable connector, got %T", h)
	}
}

func TestCustomizedConnectorNewSubscriptionHandlerCapable(t *testing.T) {
	t.Parallel()

	inner := &fakeSubConnector{
		fakeConnector: fakeConnector{schema: teamSchema()},
		handler:       &fakeSubHandler{ch: make(chan subscription.Update, 1)},
	}

	conn, err := newCustomizedConnector(
		"default",
		inner,
		metadata.Customization{
			RootFieldsNamespace: "league",
			TypeNamesPrefix:     "League",
		},
		customization.FlavorDatabase,
	)
	if err != nil {
		t.Fatalf("newCustomizedConnector: %v", err)
	}

	h := conn.NewSubscriptionHandler(time.Second, slog.Default())
	if _, ok := h.(*customizedSubscriptionHandler); !ok {
		t.Fatalf("expected *customizedSubscriptionHandler, got %T", h)
	}
}

func TestCustomizedSubscriptionHandlerReversesAndReshapes(t *testing.T) {
	t.Parallel()

	fake := &fakeSubHandler{ch: make(chan subscription.Update, 1)}
	handler := &customizedSubscriptionHandler{inner: fake, customizer: primedCustomizer()}

	out, err := handler.Start(
		t.Context(),
		subscription.Request{
			ID:        "sub-1",
			Operation: namespacedSubscriptionOp(),
		},
		slog.Default(),
	)
	if err != nil {
		t.Fatalf("Start: %v", err)
	}

	// The inner handler must receive the native operation: the league
	// namespace unwrapped so its root field is `teams`.
	if fake.startedOp == nil || len(fake.startedOp.SelectionSet) != 1 {
		t.Fatalf("inner did not receive a reversed operation: %#v", fake.startedOp)
	}

	root, ok := fake.startedOp.SelectionSet[0].(*ast.Field)
	if !ok || root.Name != "teams" {
		t.Fatalf("inner root selection = %#v, want field teams", fake.startedOp.SelectionSet[0])
	}

	// Push a native update; expect it re-wrapped under league with __typename
	// remapped Team -> LeagueTeam.
	fake.ch <- subscription.NewUpdateData(
		"sub-1",
		jsontext.Value(`{"teams":[{"__typename":"Team"}]}`),
	)

	update := <-out

	var got map[string]any
	if err := json.Unmarshal(update.Data, &got); err != nil {
		t.Fatalf("decoding reshaped update: %v", err)
	}

	league, ok := got["league"].(map[string]any)
	if !ok {
		t.Fatalf("update not re-wrapped under league: %#v", got)
	}

	teams, ok := league["teams"].([]any)
	if !ok || len(teams) == 0 {
		t.Fatalf("teams missing under league: %#v", league)
	}

	first, ok := teams[0].(map[string]any)
	if !ok {
		t.Fatalf("team element not an object: %#v", teams[0])
	}

	if first["__typename"] != "LeagueTeam" {
		t.Errorf("__typename = %v, want LeagueTeam", first["__typename"])
	}

	// Closing the inner channel must close the forwarded channel.
	close(fake.ch)

	if _, open := <-out; open {
		t.Errorf("forwarded channel should close when inner channel closes")
	}
}

func TestCustomizedSubscriptionHandlerStopShutdownDelegate(t *testing.T) {
	t.Parallel()

	fake := &fakeSubHandler{ch: make(chan subscription.Update, 1)}
	handler := &customizedSubscriptionHandler{inner: fake, customizer: primedCustomizer()}

	handler.Stop(t.Context(), "sub-9")
	handler.Shutdown(t.Context())

	if len(fake.stopped) != 1 || fake.stopped[0] != "sub-9" {
		t.Errorf("Stop not delegated: %v", fake.stopped)
	}

	if !fake.shutdown {
		t.Errorf("Shutdown not delegated")
	}
}
