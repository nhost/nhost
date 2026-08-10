package subscription_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/subscription"
	"github.com/vektah/gqlparser/v2/ast"
)

func TestNewRequest(t *testing.T) {
	t.Parallel()

	validOp := &ast.OperationDefinition{
		Operation: ast.Subscription,
		SelectionSet: ast.SelectionSet{
			&ast.Field{Name: "users"},
		},
	}

	tests := []struct {
		name             string
		id               string
		queryString      string
		operationName    string
		role             string
		operation        *ast.OperationDefinition
		fragments        ast.FragmentDefinitionList
		variables        map[string]any
		sessionVariables map[string]any
		wantErrSubstr    string
	}{
		{
			name:             "all required fields",
			id:               "sub-1",
			queryString:      "subscription { users { id } }",
			operationName:    "Users",
			role:             "user",
			operation:        validOp,
			fragments:        nil,
			variables:        nil,
			sessionVariables: nil,
			wantErrSubstr:    "",
		},
		{
			name:             "optional fields populated",
			id:               "sub-2",
			queryString:      "subscription { users { id } }",
			operationName:    "Users",
			role:             "user",
			operation:        validOp,
			fragments:        ast.FragmentDefinitionList{{Name: "F"}},
			variables:        map[string]any{"limit": 10},
			sessionVariables: map[string]any{"x-hasura-user-id": "u1"},
			wantErrSubstr:    "",
		},
		{
			name:          "missing ID",
			id:            "",
			queryString:   "subscription { users { id } }",
			role:          "user",
			operation:     validOp,
			wantErrSubstr: "ID is required",
		},
		{
			name:          "missing QueryString",
			id:            "sub-3",
			queryString:   "",
			role:          "user",
			operation:     validOp,
			wantErrSubstr: "QueryString is required",
		},
		{
			name:          "missing Operation",
			id:            "sub-4",
			queryString:   "subscription { users { id } }",
			role:          "user",
			operation:     nil,
			wantErrSubstr: "Operation is required",
		},
		{
			name:          "missing Role",
			id:            "sub-5",
			queryString:   "subscription { users { id } }",
			role:          "",
			operation:     validOp,
			wantErrSubstr: "Role is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			req, err := subscription.NewRequest(subscription.Request{
				ID:               tt.id,
				QueryString:      tt.queryString,
				Operation:        tt.operation,
				Fragments:        tt.fragments,
				OperationName:    tt.operationName,
				Role:             tt.role,
				Variables:        tt.variables,
				SessionVariables: tt.sessionVariables,
			})

			if tt.wantErrSubstr != "" {
				if err == nil {
					t.Fatalf("expected error containing %q, got nil", tt.wantErrSubstr)
				}

				if !errors.Is(err, subscription.ErrInvalidRequest) {
					t.Errorf("error %v does not wrap ErrInvalidRequest", err)
				}

				if !strings.Contains(err.Error(), tt.wantErrSubstr) {
					t.Errorf("error %q does not contain %q", err.Error(), tt.wantErrSubstr)
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if req.ID != tt.id ||
				req.QueryString != tt.queryString ||
				req.OperationName != tt.operationName ||
				req.Role != tt.role ||
				req.Operation != tt.operation {
				t.Errorf("fields not set correctly: %+v", req)
			}
		})
	}
}

func TestNewUpdateData(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name           string
		subscriptionID string
		data           []byte
	}{
		{
			name:           "json payload",
			subscriptionID: "sub-1",
			data:           []byte(`{"users":[]}`),
		},
		{
			name:           "empty subscription id",
			subscriptionID: "",
			data:           []byte(`{}`),
		},
		{
			name:           "nil data",
			subscriptionID: "sub-2",
			data:           nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			update := subscription.NewUpdateData(tt.subscriptionID, tt.data)

			if update.SubscriptionID != tt.subscriptionID {
				t.Errorf(
					"SubscriptionID = %q, want %q",
					update.SubscriptionID,
					tt.subscriptionID,
				)
			}

			if string(update.Data) != string(tt.data) {
				t.Errorf("Data = %q, want %q", string(update.Data), string(tt.data))
			}

			if update.Error != nil {
				t.Errorf("Error = %v, want nil for a data update", update.Error)
			}
		})
	}
}

// errBoom is a test sentinel used to verify error propagation through Update.
var errBoom = errors.New("boom")

func TestNewUpdateError(t *testing.T) {
	t.Parallel()

	sentinel := errBoom

	tests := []struct {
		name           string
		subscriptionID string
		err            error
	}{
		{
			name:           "non-nil error",
			subscriptionID: "sub-1",
			err:            sentinel,
		},
		{
			name:           "empty subscription id",
			subscriptionID: "",
			err:            sentinel,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			update := subscription.NewUpdateError(tt.subscriptionID, tt.err)

			if update.SubscriptionID != tt.subscriptionID {
				t.Errorf(
					"SubscriptionID = %q, want %q",
					update.SubscriptionID,
					tt.subscriptionID,
				)
			}

			if !errors.Is(update.Error, tt.err) {
				t.Errorf("Error = %v, want %v", update.Error, tt.err)
			}

			if update.Data != nil {
				t.Errorf("Data = %q, want nil for an error update", string(update.Data))
			}
		})
	}
}
