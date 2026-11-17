package controller

import (
	"context"
	json "encoding/json/v2"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/internal/lib/syncmap"
	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	"github.com/nhost/nhost/services/constellation/controller/middleware"
	"github.com/nhost/nhost/services/constellation/controller/planner"
	"github.com/nhost/nhost/services/constellation/controller/websocket"
	"github.com/nhost/nhost/services/constellation/subscription"
	subscriptionmock "github.com/nhost/nhost/services/constellation/subscription/mock"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"go.uber.org/mock/gomock"
)

// --- getConnectorForOperation tests ---------------------------------------

func TestWebSocketHandlerConnectionExpiresAt(t *testing.T) {
	t.Parallel()

	expiresAt := time.Unix(1893456000, 0).UTC()
	handler := &webSocketHandler{
		session: &middleware.SessionVariables{ExpiresAt: &expiresAt},
	}

	got, ok := handler.ConnectionExpiresAt()
	if !ok {
		t.Fatal("expected expiration to be available")
	}

	if !got.Equal(expiresAt) {
		t.Fatalf("expiration mismatch: want %s, got %s", expiresAt, got)
	}

	handler.session = &middleware.SessionVariables{}
	if _, ok := handler.ConnectionExpiresAt(); ok {
		t.Fatal("expected no expiration for non-JWT session")
	}
}

func TestWebSocketHandlerOnSubscribeRejectsMissingRequiredDirectiveVariable(t *testing.T) {
	t.Parallel()

	sendCh := make(chan *websocket.Message, 1)

	h := &webSocketHandler{
		state: &controllerState{
			validatedSchemas: wsTestSchemas(t),
			queryCache:       newQueryCache(),
		},
		adminSecret:     "",
		jwtAuth:         nil,
		pollingInterval: defaultPollingInterval,
		devMode:         false,
		logger:          slog.New(slog.DiscardHandler),
		session:         &middleware.SessionVariables{Role: "admin", Variables: nil},
		sendCh:          sendCh,
		subs:            syncmap.New[string, *subscriptionState](),
	}

	h.OnSubscribe(context.Background(), "sub-1", websocket.SubscribePayload{
		OperationName: "Q",
		Query:         `subscription Q($includeUsers: Boolean!) { users @include(if: $includeUsers) { id } }`,
		Variables:     nil,
		Extensions:    nil,
	})

	errs := firstErrorPayload(t, sendCh)

	got, _ := errs[0]["message"].(string)
	if got != "must be defined" {
		t.Fatalf("expected missing-variable validation error, got %q", got)
	}

	path, ok := errs[0]["path"].([]any)
	if !ok || len(path) != 2 || path[0] != "variable" || path[1] != "includeUsers" {
		t.Fatalf("expected variable path, got %v", errs[0]["path"])
	}

	if _, exists := h.subs.Load("sub-1"); exists {
		t.Fatal("subscription must not be registered after variable validation fails")
	}
}

func TestWebSocketHandlerOnSubscribeCoercesDefaultedDirectiveVariable(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	mockHandler := subscriptionmock.NewMockHandler(ctrl)

	updates := make(chan subscription.Update)
	close(updates)

	mockHandler.EXPECT().
		Start(gomock.Any(), gomock.Any(), gomock.Any()).
		DoAndReturn(func(
			_ context.Context,
			req subscription.Request,
			_ *slog.Logger,
		) (<-chan subscription.Update, error) {
			gotDefault, ok := req.Variables["includeUsers"].(bool)
			if !ok || !gotDefault {
				t.Fatalf("expected defaulted includeUsers=true, got %v", req.Variables)
			}

			if len(req.Operation.SelectionSet) != 1 {
				t.Fatalf(
					"expected one selected root field, got %d",
					len(req.Operation.SelectionSet),
				)
			}

			field, ok := req.Operation.SelectionSet[0].(*ast.Field)
			if !ok || field.Name != "users" {
				t.Fatalf("expected selected users field, got %#v", req.Operation.SelectionSet[0])
			}

			return updates, nil
		})

	sendCh := make(chan *websocket.Message, 1)

	h := &webSocketHandler{
		state: &controllerState{
			validatedSchemas: wsTestSchemas(t),
			fieldToConnector: map[string]string{
				schemamerge.FieldKey(ast.Subscription, "users"): "db",
			},
			subHandlers: map[string]subscription.Handler{"db": mockHandler},
			queryCache:  newQueryCache(),
			queryPlanner: planner.New(wsTestSchemas(t), map[string]string{
				schemamerge.FieldKey(ast.Subscription, "users"): "db",
			}, nil, nil),
		},
		adminSecret:     "",
		jwtAuth:         nil,
		pollingInterval: defaultPollingInterval,
		devMode:         false,
		logger:          slog.New(slog.DiscardHandler),
		session:         &middleware.SessionVariables{Role: "admin", Variables: nil},
		sendCh:          sendCh,
		subs:            syncmap.New[string, *subscriptionState](),
	}

	h.OnSubscribe(context.Background(), "sub-1", websocket.SubscribePayload{
		OperationName: "Q",
		Query:         `subscription Q($includeUsers: Boolean = true) { users @include(if: $includeUsers) { id } }`,
		Variables:     nil,
		Extensions:    nil,
	})

	select {
	case msg := <-sendCh:
		t.Fatalf("unexpected websocket message: %+v", msg)
	default:
	}
}

//nolint:cyclop,tparallel,gocognit // Directive matrix shares one WebSocket handler and mock; subtests cannot run in parallel.
func TestWebSocketHandlerRejectsRemoteRelationships(t *testing.T) {
	t.Parallel()

	schema, err := gqlparser.LoadSchema(&ast.Source{Input: `
		type query_root { users: [User!]! }
		type User { id: ID! item_label: String computedRemote: User physicalRemote: User }
		schema { query: query_root subscription: query_root }
	`})
	if err != nil {
		t.Fatal(err)
	}

	deniedSchema, err := gqlparser.LoadSchema(&ast.Source{Input: `
		type query_root { users: [User!]! }
		type User { id: ID! }
		schema { query: query_root subscription: query_root }
	`})
	if err != nil {
		t.Fatal(err)
	}

	schemas := map[string]*ast.Schema{"admin": schema, "denied": deniedSchema}
	owners := map[string]string{schemamerge.FieldKey(ast.Subscription, "users"): "db"}
	rels := map[string][]*planner.RelationshipMetadata{"db": {
		{
			Name:            "computedRemote",
			SourceType:      "User",
			TargetConnector: "other",
			TargetTable:     "users",
			JoinMapping:     map[string]string{"item_label": "id"},
			IsRemote:        true,
		},
		{
			Name:            "physicalRemote",
			SourceType:      "User",
			TargetConnector: "other",
			TargetTable:     "users",
			JoinMapping:     map[string]string{"id": "id"},
			IsRemote:        true,
		},
	}}
	mockHandler := subscriptionmock.NewMockHandler(gomock.NewController(t))
	updates := make(chan subscription.Update)
	starts := 0
	mockHandler.EXPECT().
		Start(gomock.Any(), gomock.Any(), gomock.Any()).
		DoAndReturn(func(context.Context, subscription.Request, *slog.Logger) (<-chan subscription.Update, error) {
			starts++
			return updates, nil
		}).
		AnyTimes()
	mockHandler.EXPECT().Stop(gomock.Any(), gomock.Any()).AnyTimes()

	sendCh := make(chan *websocket.Message, 2)
	h := &webSocketHandler{
		state: &controllerState{
			validatedSchemas: schemas,
			queryCache:       newQueryCache(),
			queryPlanner:     planner.New(schemas, owners, nil, rels),
			fieldToConnector: owners,
			subHandlers:      map[string]subscription.Handler{"db": mockHandler},
		},
		logger:  slog.New(slog.DiscardHandler),
		session: &middleware.SessionVariables{Role: "admin"},
		sendCh:  sendCh, subs: syncmap.New[string, *subscriptionState](),
	}

	for _, name := range []string{"computedRemote", "physicalRemote"} {
		h.OnSubscribe(t.Context(), name, websocket.SubscribePayload{
			Query: `subscription { users { id ` + name + ` { id } } }`,
		})

		errs := firstErrorPayload(t, sendCh)
		if errs[0]["message"] != "Remote relationships are not allowed in subscriptions" {
			t.Fatalf("%s: unexpected error: %v", name, errs)
		}

		if ext, ok := errs[0]["extensions"].(map[string]any); !ok ||
			ext["code"] != "not-supported" {
			t.Fatalf("%s: missing not-supported code: %v", name, errs)
		}

		if _, exists := h.subs.Load(name); exists {
			t.Fatalf("%s registered a subscription", name)
		}
	}

	for _, tc := range []struct { //nolint:paralleltest // All cases share one WebSocket handler and subscription mock.
		name, selection string
		variables       map[string]any
		rejected        bool
	}{
		{"field include true", `physicalRemote @include(if:$x) { id }`, map[string]any{"x": true}, true},
		{"field include false", `physicalRemote @include(if:$x) { id }`, map[string]any{"x": false}, false},
		{"field skip false", `physicalRemote @skip(if:$x) { id }`, map[string]any{"x": false}, true},
		{"field skip true", `physicalRemote @skip(if:$x) { id }`, map[string]any{"x": true}, false},
		{"inline include true", `... on User @include(if:$x) { physicalRemote { id } }`, map[string]any{"x": true}, true},
		{"inline include false", `... on User @include(if:$x) { physicalRemote { id } }`, map[string]any{"x": false}, false},
		{"inline skip false", `... on User @skip(if:$x) { physicalRemote { id } }`, map[string]any{"x": false}, true},
		{"inline skip true", `... on User @skip(if:$x) { physicalRemote { id } }`, map[string]any{"x": true}, false},
		{"spread include true", `...Remote @include(if:$x)`, map[string]any{"x": true}, true},
		{"spread include false", `...Remote @include(if:$x)`, map[string]any{"x": false}, false},
		{"spread skip false", `...Remote @skip(if:$x)`, map[string]any{"x": false}, true},
		{"spread skip true", `...Remote @skip(if:$x)`, map[string]any{"x": true}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			id := tc.name

			query := `subscription($x:Boolean!) { users { id ` + tc.selection + ` } }`
			if strings.Contains(tc.selection, "...Remote") {
				query += ` fragment Remote on User { physicalRemote { id } }`
			}

			before := starts

			h.OnSubscribe(t.Context(), id, websocket.SubscribePayload{
				Query: query, Variables: tc.variables,
			})

			if tc.rejected {
				if starts != before {
					t.Fatal("rejected subscription started a SQL poll")
				}

				errs := firstErrorPayload(t, sendCh)
				if errs[0]["message"] != "Remote relationships are not allowed in subscriptions" {
					t.Fatalf("remote relationship not rejected: %v", errs)
				}

				if _, exists := h.subs.Load(id); exists {
					t.Fatal("rejected subscription registered")
				}

				return
			}

			if starts != before+1 {
				t.Fatal("excluded relationship did not start ordinary subscription")
			}

			select {
			case msg := <-sendCh:
				t.Fatalf("excluded relationship rejected: %+v", msg)
			default:
			}
		})
	}

	h.OnSubscribe(t.Context(), "ordinary", websocket.SubscribePayload{
		Query: `subscription { users { id } }`,
	})

	select {
	case msg := <-sendCh:
		t.Fatalf("ordinary subscription rejected: %+v", msg)
	default:
	}

	before := starts
	h.session.Role = "denied"
	h.OnSubscribe(t.Context(), "denied", websocket.SubscribePayload{
		Query: `subscription { users { physicalRemote { id } } }`,
	})

	if message := firstErrorMessage(
		t,
		sendCh,
	); !strings.Contains(
		message,
		`Cannot query field "physicalRemote"`,
	) {
		t.Fatalf("role denial validation: %s", message)
	}

	if starts != before {
		t.Fatal("denied remote field started a SQL poll")
	}

	if _, exists := h.subs.Load("denied"); exists {
		t.Fatal("denied remote field registered a subscription")
	}

	h.OnClose(t.Context())
}

func TestGetConnectorForOperation(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)

	mockHandler := subscriptionmock.NewMockHandler(ctrl)

	cases := []struct {
		name             string
		fieldToConnector map[string]string
		subHandlers      map[string]subscription.Handler
		selectionFields  []string
		want             string
	}{
		{
			name: "routes to known connector",
			fieldToConnector: map[string]string{
				schemamerge.FieldKey(ast.Subscription, "users"): "db1",
				schemamerge.FieldKey(ast.Subscription, "posts"): "db2",
			},
			selectionFields: []string{"users"},
			want:            "db1",
		},
		{
			name: "routes using subscription key when names overlap",
			fieldToConnector: map[string]string{
				schemamerge.FieldKey(ast.Query, "foo"):        "dbQ",
				schemamerge.FieldKey(ast.Subscription, "foo"): "dbS",
			},
			selectionFields: []string{"foo"},
			want:            "dbS",
		},
		{
			name:             "unknown field falls through to default handler",
			fieldToConnector: map[string]string{},
			subHandlers:      map[string]subscription.Handler{"fallback": mockHandler},
			selectionFields:  []string{"unknown"},
			want:             "fallback",
		},
		{
			name:             "no handlers returns empty string",
			fieldToConnector: map[string]string{},
			subHandlers:      map[string]subscription.Handler{},
			selectionFields:  []string{"unknown"},
			want:             "",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			state := &controllerState{
				fieldToConnector: tc.fieldToConnector,
				subHandlers:      tc.subHandlers,
			}

			selections := make(ast.SelectionSet, len(tc.selectionFields))
			for i, name := range tc.selectionFields {
				selections[i] = &ast.Field{Name: name}
			}

			op := &ast.OperationDefinition{
				Operation:    ast.Subscription,
				SelectionSet: selections,
			}

			got := getConnectorForOperation(state, op)
			if got != tc.want {
				t.Errorf("got %q, want %q", got, tc.want)
			}
		})
	}
}

// --- startSubscription error-classification tests -------------------------

// firstErrorPayload drains a single error frame from ch and returns the
// decoded GraphQL errors payload.
func firstErrorPayload(t *testing.T, ch <-chan *websocket.Message) []map[string]any {
	t.Helper()

	select {
	case msg := <-ch:
		var errs []map[string]any
		if err := json.Unmarshal(msg.Payload, &errs); err != nil {
			t.Fatalf("decoding error payload: %v", err)
		}

		if len(errs) == 0 {
			t.Fatalf("expected at least one error entry, got none")
		}

		return errs
	default:
		t.Fatalf("expected an error frame on sendCh, got none")
		return nil
	}
}

// firstErrorMessage drains a single error frame from ch and returns the
// message string carried in its first error entry.
func firstErrorMessage(t *testing.T, ch <-chan *websocket.Message) string {
	t.Helper()

	errs := firstErrorPayload(t, ch)

	got, ok := errs[0]["message"].(string)
	if !ok {
		t.Fatalf("error entry missing string message: %v", errs[0])
	}

	return got
}

func queryValidationSubscriptionError(t *testing.T, rootField string) error {
	t.Helper()

	vErr := distinctOnOrderByMismatchError(t, rootField)

	return fmt.Errorf(
		"%w: failed to build subscription SQL: %w",
		subscription.ErrInvalidSubscription,
		vErr,
	)
}

func queryValidationErrors(rootField string) []map[string]any {
	return []map[string]any{
		{
			"message": `"distinct_on" columns must match initial "order_by" columns`,
			"extensions": map[string]any{
				"code": "validation-failed",
				"path": "$.selectionSet." + rootField + ".args",
			},
		},
	}
}

func TestStartSubscriptionStartErrorClassification(t *testing.T) {
	t.Parallel()

	buildErr := fmt.Errorf(
		"%w: failed to build query: column does not exist",
		subscription.ErrInvalidSubscription,
	)
	runtimeErr := errors.New( //nolint:err113 // test sentinel error used to verify error propagation
		"Key (email)=(alice@example.com) already exists",
	)

	cases := []struct {
		name           string
		startErr       error
		wantSubstr     string
		wantSanitized  bool
		forbiddenSubst string
	}{
		{
			name:           "invalid subscription surfaces verbatim",
			startErr:       buildErr,
			wantSubstr:     "failed to build query: column does not exist",
			wantSanitized:  false,
			forbiddenSubst: "trace id",
		},
		{
			name:           "runtime error is sanitized",
			startErr:       runtimeErr,
			wantSubstr:     "internal server error (trace id:",
			wantSanitized:  true,
			forbiddenSubst: "alice@example.com",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			mockHandler := subscriptionmock.NewMockHandler(ctrl)
			mockHandler.EXPECT().
				Start(gomock.Any(), gomock.Any(), gomock.Any()).
				Return(nil, tc.startErr)

			sendCh := make(chan *websocket.Message, 1)

			h := &webSocketHandler{
				state:           &controllerState{},
				adminSecret:     "",
				jwtAuth:         nil,
				pollingInterval: defaultPollingInterval,
				devMode:         false,
				logger:          slog.New(slog.DiscardHandler),
				session:         &middleware.SessionVariables{Role: "user", Variables: nil},
				sendCh:          sendCh,
				subs:            syncmap.New[string, *subscriptionState](),
			}

			op := &ast.OperationDefinition{
				Operation:           ast.Subscription,
				Name:                "",
				VariableDefinitions: nil,
				Directives:          nil,
				SelectionSet: ast.SelectionSet{
					&ast.Field{Name: "users"},
				},
				Position: nil,
				Comment:  nil,
			}

			h.startSubscription(
				context.Background(),
				"sub-1",
				websocket.SubscribePayload{
					OperationName: "",
					Query:         "subscription { users { id } }",
					Variables:     nil,
					Extensions:    nil,
				},
				mockHandler,
				op,
				nil,
				nil,
				h.logger,
			)

			got := firstErrorMessage(t, sendCh)
			if !strings.Contains(got, tc.wantSubstr) {
				t.Errorf("message %q does not contain %q", got, tc.wantSubstr)
			}

			if tc.forbiddenSubst != "" && strings.Contains(got, tc.forbiddenSubst) {
				t.Errorf("message %q must not contain %q", got, tc.forbiddenSubst)
			}

			if _, exists := h.subs.Load("sub-1"); exists {
				t.Error("subscription should have been removed after a Start failure")
			}
		})
	}
}

func TestStartSubscriptionQueryValidationErrorPreservesStructuredEnvelope(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)

	mockHandler := subscriptionmock.NewMockHandler(ctrl)
	mockHandler.EXPECT().
		Start(gomock.Any(), gomock.Any(), gomock.Any()).
		Return(nil, queryValidationSubscriptionError(t, "users"))

	sendCh := make(chan *websocket.Message, 1)

	h := &webSocketHandler{
		state:           &controllerState{},
		adminSecret:     "",
		jwtAuth:         nil,
		pollingInterval: defaultPollingInterval,
		devMode:         false,
		logger:          slog.New(slog.DiscardHandler),
		session:         &middleware.SessionVariables{Role: "user", Variables: nil},
		sendCh:          sendCh,
		subs:            syncmap.New[string, *subscriptionState](),
	}

	op := &ast.OperationDefinition{
		Operation:           ast.Subscription,
		Name:                "",
		VariableDefinitions: nil,
		Directives:          nil,
		SelectionSet: ast.SelectionSet{
			&ast.Field{Name: "users"},
		},
		Position: nil,
		Comment:  nil,
	}

	h.startSubscription(
		context.Background(),
		"sub-1",
		websocket.SubscribePayload{
			OperationName: "",
			Query:         "subscription { users { id } }",
			Variables:     nil,
			Extensions:    nil,
		},
		mockHandler,
		op,
		nil,
		nil,
		h.logger,
	)

	got := firstErrorPayload(t, sendCh)
	want := queryValidationErrors("users")

	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("structured error payload mismatch (-want +got):\n%s", diff)
	}

	if _, exists := h.subs.Load("sub-1"); exists {
		t.Error("subscription should have been removed after a Start failure")
	}
}

// TestStartSubscriptionNewRequestErrorClassification ensures that an
// ErrInvalidRequest from subscription.NewRequest (e.g. an empty session role)
// is surfaced verbatim to the client rather than collapsed into an opaque
// internal-error trace id. The missing-field message names the offending field
// (no PII), so it is safe to surface and more actionable than a sanitized
// generic message.
func TestStartSubscriptionNewRequestErrorClassification(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)

	// Start is never called when NewRequest fails first.
	mockHandler := subscriptionmock.NewMockHandler(ctrl)

	sendCh := make(chan *websocket.Message, 1)

	h := &webSocketHandler{
		state:           &controllerState{},
		adminSecret:     "",
		jwtAuth:         nil,
		pollingInterval: defaultPollingInterval,
		devMode:         false,
		logger:          slog.New(slog.DiscardHandler),
		// Empty role makes subscription.NewRequest return ErrInvalidRequest.
		session: &middleware.SessionVariables{Role: "", Variables: nil},
		sendCh:  sendCh,
		subs:    syncmap.New[string, *subscriptionState](),
	}

	op := &ast.OperationDefinition{
		Operation:           ast.Subscription,
		Name:                "",
		VariableDefinitions: nil,
		Directives:          nil,
		SelectionSet: ast.SelectionSet{
			&ast.Field{Name: "users"},
		},
		Position: nil,
		Comment:  nil,
	}

	h.startSubscription(
		context.Background(),
		"sub-1",
		websocket.SubscribePayload{
			OperationName: "",
			Query:         "subscription { users { id } }",
			Variables:     nil,
			Extensions:    nil,
		},
		mockHandler,
		op,
		nil,
		nil,
		h.logger,
	)

	got := firstErrorMessage(t, sendCh)
	if !strings.Contains(got, "invalid subscription request: Role is required") {
		t.Errorf(
			"message %q does not contain the verbatim ErrInvalidRequest reason",
			got,
		)
	}

	if strings.Contains(got, "trace id") {
		t.Errorf(
			"message %q must not be sanitized into a trace id; ErrInvalidRequest should be surfaced verbatim",
			got,
		)
	}

	if _, exists := h.subs.Load("sub-1"); exists {
		t.Error("subscription should have been removed after a NewRequest failure")
	}
}

// --- forwardUpdates classification tests ----------------------------------

// TestForwardUpdatesErrorClassification ensures that a non-structured plan
// failure surfaced asynchronously via Update.Error reaches the client verbatim
// (mirroring the startSubscription path) while driver/runtime faults remain
// sanitized into a trace id. Live-query subscriptions only build SQL inside
// their polling goroutine, so this is the sole place where
// ErrInvalidSubscription crosses the protocol boundary for them.
func TestForwardUpdatesErrorClassification(t *testing.T) {
	t.Parallel()

	planErr := fmt.Errorf(
		"%w: failed to build subscription SQL: column does not exist",
		subscription.ErrInvalidSubscription,
	)
	runtimeErr := errors.New( //nolint:err113 // test sentinel error used to verify error propagation
		"Key (email)=(alice@example.com) already exists",
	)

	cases := []struct {
		name           string
		updateErr      error
		wantSubstr     string
		forbiddenSubst string
	}{
		{
			name:           "invalid subscription surfaces verbatim",
			updateErr:      planErr,
			wantSubstr:     "failed to build subscription SQL: column does not exist",
			forbiddenSubst: "trace id",
		},
		{
			name:           "runtime error is sanitized",
			updateErr:      runtimeErr,
			wantSubstr:     "internal server error (trace id:",
			forbiddenSubst: "alice@example.com",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			sendCh := make(chan *websocket.Message, 1)

			h := &webSocketHandler{
				state:           &controllerState{},
				adminSecret:     "",
				jwtAuth:         nil,
				pollingInterval: defaultPollingInterval,
				devMode:         false,
				logger:          slog.New(slog.DiscardHandler),
				session:         &middleware.SessionVariables{Role: "user", Variables: nil},
				sendCh:          sendCh,
				subs:            syncmap.New[string, *subscriptionState](),
			}

			sub := &subscriptionState{
				id:            "sub-1",
				handler:       nil,
				query:         "subscription { users { id } }",
				operationName: "",
				variables:     nil,
				lastHash:      "",
				stopCh:        make(chan struct{}),
			}

			updateCh := make(chan subscription.Update, 1)
			updateCh <- subscription.NewUpdateError("sub-1", tc.updateErr)

			close(updateCh)

			h.forwardUpdates(context.Background(), sub, updateCh, h.logger)

			got := firstErrorMessage(t, sendCh)
			if !strings.Contains(got, tc.wantSubstr) {
				t.Errorf("message %q does not contain %q", got, tc.wantSubstr)
			}

			if tc.forbiddenSubst != "" && strings.Contains(got, tc.forbiddenSubst) {
				t.Errorf("message %q must not contain %q", got, tc.forbiddenSubst)
			}
		})
	}
}

func TestForwardUpdatesQueryValidationErrorPreservesStructuredEnvelope(t *testing.T) {
	t.Parallel()

	sendCh := make(chan *websocket.Message, 1)

	h := &webSocketHandler{
		state:           &controllerState{},
		adminSecret:     "",
		jwtAuth:         nil,
		pollingInterval: defaultPollingInterval,
		devMode:         false,
		logger:          slog.New(slog.DiscardHandler),
		session:         &middleware.SessionVariables{Role: "user", Variables: nil},
		sendCh:          sendCh,
		subs:            syncmap.New[string, *subscriptionState](),
	}

	sub := &subscriptionState{
		id:            "sub-1",
		handler:       nil,
		query:         "subscription { users { id } }",
		operationName: "",
		variables:     nil,
		lastHash:      "",
		stopCh:        make(chan struct{}),
	}

	updateCh := make(chan subscription.Update, 1)
	updateCh <- subscription.NewUpdateError(
		"sub-1",
		queryValidationSubscriptionError(t, "users"),
	)

	close(updateCh)

	h.forwardUpdates(context.Background(), sub, updateCh, h.logger)

	got := firstErrorPayload(t, sendCh)
	want := queryValidationErrors("users")

	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("structured error payload mismatch (-want +got):\n%s", diff)
	}
}

// --- extractHeadersFromPayload tests --------------------------------------

func TestExtractHeadersFromPayload(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		payload string
		want    http.Header
	}{
		{
			name:    "nil payload",
			payload: "",
			want:    nil,
		},
		{
			name:    "nested headers format",
			payload: `{"headers":{"x-hasura-admin-secret":"secret123"}}`,
			want: http.Header{
				"X-Hasura-Admin-Secret": {"secret123"},
			},
		},
		{
			name:    "flat string format",
			payload: `{"x-hasura-admin-secret":"secret123","x-hasura-role":"admin"}`,
			want: http.Header{
				"X-Hasura-Admin-Secret": {"secret123"},
				"X-Hasura-Role":         {"admin"},
			},
		},
		{
			name:    "flat mixed types format",
			payload: `{"x-hasura-admin-secret":"secret123","numeric":42}`,
			want: http.Header{
				"X-Hasura-Admin-Secret": {"secret123"},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var payload []byte
			if tc.payload != "" {
				payload = []byte(tc.payload)
			}

			got := extractHeadersFromPayload(payload)
			if diff := cmp.Diff(tc.want, got); diff != "" {
				t.Errorf("mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
