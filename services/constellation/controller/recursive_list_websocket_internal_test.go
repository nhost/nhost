package controller

import (
	"context"
	"log/slog"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"go.uber.org/mock/gomock"

	"github.com/nhost/nhost/internal/lib/syncmap"
	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	"github.com/nhost/nhost/services/constellation/controller/middleware"
	"github.com/nhost/nhost/services/constellation/controller/planner"
	"github.com/nhost/nhost/services/constellation/controller/websocket"
	"github.com/nhost/nhost/services/constellation/subscription"
	subscriptionmock "github.com/nhost/nhost/services/constellation/subscription/mock"
)

func TestWebSocketHandlerRecursiveListVariables(t *testing.T) {
	t.Parallel()

	schema := gqlparser.MustLoadSchema(&ast.Source{Input: `
type Query { ping: Int }
type Subscription { lists(xs: [[String!]!]!): Int }
`})

	tests := []struct {
		name, definition string
		variables        map[string]any
	}{
		{"explicit", "!", map[string]any{"xs": []any{[]any{"{a,b}"}}}},
		{"flat", "!", map[string]any{"xs": []any{"{a,b}"}}},
		{"scalar", "!", map[string]any{"xs": "{a,b}"}},
		{"default", `!="{a,b}"`, nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			before := normalizedCoercionVariables(t, tt.variables)
			mockHandler := subscriptionmock.NewMockHandler(gomock.NewController(t))
			updates := make(chan subscription.Update)
			close(updates)
			mockHandler.EXPECT().Start(gomock.Any(), gomock.Any(), gomock.Any()).DoAndReturn(func(
				_ context.Context, req subscription.Request, _ *slog.Logger,
			) (<-chan subscription.Update, error) {
				want := map[string]any{"xs": []any{[]any{"{a,b}"}}}
				if diff := cmp.Diff(
					want,
					normalizedCoercionVariables(t, req.Variables),
				); diff != "" {
					t.Errorf("subscription variables (-want +got):\n%s", diff)
				}

				return updates, nil
			})

			schemas := map[string]*ast.Schema{"admin": schema}
			routes := map[string]string{schemamerge.FieldKey(ast.Subscription, "lists"): "db"}
			sendCh := make(chan *websocket.Message, 1)
			h := &webSocketHandler{
				state: &controllerState{
					validatedSchemas: schemas,
					fieldToConnector: routes,
					subHandlers:      map[string]subscription.Handler{"db": mockHandler},
					queryCache:       newQueryCache(),
					queryPlanner:     planner.New(schemas, routes, nil, nil),
				},
				adminSecret: "", jwtAuth: nil, pollingInterval: defaultPollingInterval,
				devMode: false, logger: slog.New(slog.DiscardHandler),
				session: &middleware.SessionVariables{Role: "admin", Variables: nil},
				sendCh:  sendCh, subs: syncmap.New[string, *subscriptionState](),
			}
			h.OnSubscribe(t.Context(), "sub", websocket.SubscribePayload{
				Query:     `subscription($xs:[[String!]!]` + tt.definition + `){lists(xs:$xs)}`,
				Variables: tt.variables,
			})

			if diff := cmp.Diff(before, normalizedCoercionVariables(t, tt.variables)); diff != "" {
				t.Errorf("subscription mutated caller input (-before +after):\n%s", diff)
			}

			select {
			case msg := <-sendCh:
				t.Fatalf("unexpected websocket message: %+v", msg)
			default:
			}
		})
	}
}
