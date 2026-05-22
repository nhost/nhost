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

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/controller/middleware"
	"github.com/nhost/nhost/services/constellation/controller/websocket"
	"github.com/nhost/nhost/services/constellation/internal/lib/syncmap"
	"github.com/nhost/nhost/services/constellation/subscription"
	subscriptionmock "github.com/nhost/nhost/services/constellation/subscription/mock"
	"github.com/vektah/gqlparser/v2/ast"
	"go.uber.org/mock/gomock"
)

// --- getConnectorForOperation tests ---------------------------------------

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
			name:             "routes to known connector",
			fieldToConnector: map[string]string{"users": "db1", "posts": "db2"},
			selectionFields:  []string{"users"},
			want:             "db1",
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

			op := &ast.OperationDefinition{SelectionSet: selections}

			got := getConnectorForOperation(state, op)
			if got != tc.want {
				t.Errorf("got %q, want %q", got, tc.want)
			}
		})
	}
}

// --- startSubscription error-classification tests -------------------------

// firstErrorMessage drains a single error frame from ch and returns the
// message string carried in its first error entry.
func firstErrorMessage(t *testing.T, ch <-chan *websocket.Message) string {
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

		got, ok := errs[0]["message"].(string)
		if !ok {
			t.Fatalf("error entry missing string message: %v", errs[0])
		}

		return got
	default:
		t.Fatalf("expected an error frame on sendCh, got none")
		return ""
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

// TestForwardUpdatesErrorClassification ensures that a plan failure surfaced
// asynchronously via Update.Error reaches the client verbatim (mirroring the
// startSubscription path) while driver/runtime faults remain sanitized into a
// trace id. Live-query subscriptions only build SQL inside their polling
// goroutine, so this is the sole place where ErrInvalidSubscription crosses
// the protocol boundary for them.
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
