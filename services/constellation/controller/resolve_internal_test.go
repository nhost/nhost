package controller

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/gqlerror"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/internal/lib/oapi/tracing"
)

func TestFormatGQLErrors_MessageOnly(t *testing.T) {
	t.Parallel()

	errs := gqlerror.List{
		{Message: "something went wrong"},
	}

	got := formatGQLErrors(errs)
	want := []map[string]any{
		{"message": "something went wrong"},
	}

	if diff := cmp.Diff(want, got); diff != "" {
		t.Fatalf("mismatch (-want +got):\n%s", diff)
	}
}

func TestFormatGQLErrors_WithLocations(t *testing.T) {
	t.Parallel()

	errs := gqlerror.List{
		{
			Message:   "syntax error",
			Locations: []gqlerror.Location{{Line: 3, Column: 12}},
		},
	}

	got := formatGQLErrors(errs)
	want := []map[string]any{
		{
			"message":   "syntax error",
			"locations": []gqlerror.Location{{Line: 3, Column: 12}},
		},
	}

	if diff := cmp.Diff(want, got); diff != "" {
		t.Fatalf("mismatch (-want +got):\n%s", diff)
	}
}

func TestFormatGQLErrors_WithPath(t *testing.T) {
	t.Parallel()

	errs := gqlerror.List{
		{
			Message: "field error",
			Path:    ast.Path{ast.PathName("users"), ast.PathIndex(0), ast.PathName("name")},
		},
	}

	got := formatGQLErrors(errs)
	want := []map[string]any{
		{
			"message": "field error",
			"path":    []any{"users", 0, "name"},
		},
	}

	if diff := cmp.Diff(want, got); diff != "" {
		t.Fatalf("mismatch (-want +got):\n%s", diff)
	}
}

func TestFormatGQLErrors_WithExtensions(t *testing.T) {
	t.Parallel()

	errs := gqlerror.List{
		{
			Message:    "not allowed",
			Extensions: map[string]any{"code": "FORBIDDEN"},
		},
	}

	got := formatGQLErrors(errs)
	want := []map[string]any{
		{
			"message":    "not allowed",
			"extensions": map[string]any{"code": "FORBIDDEN"},
		},
	}

	if diff := cmp.Diff(want, got); diff != "" {
		t.Fatalf("mismatch (-want +got):\n%s", diff)
	}
}

func TestFormatGQLErrors_AllFields(t *testing.T) {
	t.Parallel()

	errs := gqlerror.List{
		{
			Message:    "validation failed",
			Locations:  []gqlerror.Location{{Line: 1, Column: 5}},
			Path:       ast.Path{ast.PathName("query"), ast.PathName("user")},
			Extensions: map[string]any{"code": "VALIDATION_ERROR"},
		},
	}

	got := formatGQLErrors(errs)
	want := []map[string]any{
		{
			"message":    "validation failed",
			"locations":  []gqlerror.Location{{Line: 1, Column: 5}},
			"path":       []any{"query", "user"},
			"extensions": map[string]any{"code": "VALIDATION_ERROR"},
		},
	}

	if diff := cmp.Diff(want, got); diff != "" {
		t.Fatalf("mismatch (-want +got):\n%s", diff)
	}
}

func TestFormatGQLErrors_MultipleErrors(t *testing.T) {
	t.Parallel()

	errs := gqlerror.List{
		{Message: "error one", Locations: []gqlerror.Location{{Line: 1, Column: 1}}},
		{Message: "error two"},
	}

	got := formatGQLErrors(errs)
	want := []map[string]any{
		{"message": "error one", "locations": []gqlerror.Location{{Line: 1, Column: 1}}},
		{"message": "error two"},
	}

	if diff := cmp.Diff(want, got); diff != "" {
		t.Fatalf("mismatch (-want +got):\n%s", diff)
	}
}

func TestPathToAny(t *testing.T) {
	t.Parallel()

	path := ast.Path{ast.PathName("users"), ast.PathIndex(2), ast.PathName("email")}
	got := pathToAny(path)
	want := []any{"users", 2, "email"}

	if diff := cmp.Diff(want, got); diff != "" {
		t.Fatalf("mismatch (-want +got):\n%s", diff)
	}
}

func TestGqlValidationError_ErrorsAs(t *testing.T) {
	t.Parallel()

	original := gqlerror.List{
		{
			Message:   "bad field",
			Locations: []gqlerror.Location{{Line: 5, Column: 10}},
		},
	}

	err := formatGQLErrorsAsError(original)

	var valErr *gqlValidationError
	if !errors.As(err, &valErr) {
		t.Fatal("expected errors.As to succeed for gqlValidationError")
	}

	if valErr.Error() != "bad field" {
		t.Fatalf("got %q, want %q", valErr.Error(), "bad field")
	}

	if len(valErr.errs) != 1 {
		t.Fatalf("expected 1 error, got %d", len(valErr.errs))
	}
}

func TestGqlValidationError_NilForEmpty(t *testing.T) {
	t.Parallel()

	err := formatGQLErrorsAsError(nil)
	if err != nil {
		t.Fatalf("expected nil, got %v", err)
	}
}

func TestGqlValidationError_PlainErrorDoesNotMatch(t *testing.T) {
	t.Parallel()

	//nolint:err113 // test sentinel error used to verify error propagation
	err := errors.New("plain error")

	var valErr *gqlValidationError
	if errors.As(err, &valErr) {
		t.Fatal("expected errors.As to fail for plain error")
	}
}

func TestSanitizeConnectorError_SuppressesRawDetail(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		err         error
		secretParts []string
	}{
		{
			name: "constraint violation with data value",
			err: errors.New( //nolint:err113 // test sentinel error used to verify error propagation
				"failed to execute operations: ERROR: duplicate key value " +
					"violates unique constraint \"users_email_key\" (SQLSTATE 23505): " +
					"Key (email)=(alice@example.com) already exists",
			),
			secretParts: []string{
				"users_email_key",
				"23505",
				"alice@example.com",
				"duplicate key",
				"constraint",
			},
		},
		{
			name: "sqlite no such column",
			err: errors.New( //nolint:err113 // test sentinel error used to verify error propagation
				"failed to execute operations: no such column: secret_col",
			),
			secretParts: []string{
				"secret_col",
				"no such column",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var buf bytes.Buffer

			logger := slog.New(slog.NewTextHandler(&buf, &slog.HandlerOptions{
				AddSource:   false,
				Level:       slog.LevelDebug,
				ReplaceAttr: nil,
			}))

			msg := sanitizeConnectorError(context.Background(), logger, false, tt.err)

			// Client-facing message must be generic with a trace id and
			// must not contain any of the raw driver detail.
			if !strings.Contains(msg, "internal server error") {
				t.Fatalf("client message %q missing generic prefix", msg)
			}

			if !strings.Contains(msg, "trace id:") {
				t.Fatalf("client message %q missing trace id", msg)
			}

			for _, secret := range tt.secretParts {
				if strings.Contains(msg, secret) {
					t.Fatalf(
						"client message %q leaked raw detail %q",
						msg,
						secret,
					)
				}
			}

			// Server-side log must retain the full detail for debugging. The
			// slog text handler escapes embedded quotes, so assert on the
			// quote-free secret fragments rather than the verbatim string.
			logged := buf.String()
			for _, secret := range tt.secretParts {
				if strings.Contains(secret, `"`) {
					continue
				}

				if !strings.Contains(logged, secret) {
					t.Fatalf(
						"server log %q did not retain raw detail %q",
						logged,
						secret,
					)
				}
			}

			if !strings.Contains(logged, "trace_id") {
				t.Fatalf("server log %q missing trace_id attribute", logged)
			}
		})
	}
}

func TestSanitizeConnectorError_DevModeReturnsRaw(t *testing.T) {
	t.Parallel()

	raw := "failed to execute operations: ERROR: duplicate key value " +
		"violates unique constraint \"users_email_key\" (SQLSTATE 23505): " +
		"Key (email)=(alice@example.com) already exists"

	var buf bytes.Buffer

	logger := slog.New(slog.NewTextHandler(&buf, &slog.HandlerOptions{
		AddSource:   false,
		Level:       slog.LevelDebug,
		ReplaceAttr: nil,
	}))

	msg := sanitizeConnectorError(
		context.Background(),
		logger,
		true,
		errors.New(raw), //nolint:err113 // test sentinel error used to verify error propagation
	)

	// Dev mode surfaces the raw error verbatim (Hasura DEV_MODE parity); the
	// generic trace-id message must NOT be used.
	if msg != raw {
		t.Fatalf("dev mode should return raw error verbatim\n got: %q\nwant: %q", msg, raw)
	}

	if strings.Contains(msg, "trace id:") {
		t.Errorf("dev mode message unexpectedly carries a trace id: %q", msg)
	}

	// The full detail is still logged server-side regardless of mode.
	if !strings.Contains(buf.String(), "users_email_key") {
		t.Errorf("server log %q did not retain raw detail in dev mode", buf.String())
	}
}

func TestSanitizeConnectorError_NilLoggerSafe(t *testing.T) {
	t.Parallel()

	msg := sanitizeConnectorError(
		context.Background(),
		nil,
		false,
		errors.New( //nolint:err113 // test sentinel error used to verify error propagation
			"Key (email)=(alice@example.com) already exists",
		),
	)

	if strings.Contains(msg, "alice@example.com") {
		t.Fatalf("client message %q leaked data value with nil logger", msg)
	}

	if !strings.Contains(msg, "trace id:") {
		t.Fatalf("client message %q missing trace id", msg)
	}
}

// TestSanitizeConnectorError_UsesTraceFromContext pins the product invariant
// that the client-facing message and the server-side log share one trace id,
// sourced from tracing.FromContext(ctx) — not the uuid.NewString() fallback.
// A refactor that strips the tracing-bearing context anywhere on the resolve
// path would silently break the correlation; this test guards against that.
func TestSanitizeConnectorError_UsesTraceFromContext(t *testing.T) {
	t.Parallel()

	const wantTraceID = "test-trace-123"

	ctx := tracing.ToContext(context.Background(), tracing.Trace{
		TraceID:      wantTraceID,
		ParentSpanID: "",
		SpanID:       "",
	})

	var buf bytes.Buffer

	logger := slog.New(slog.NewTextHandler(&buf, &slog.HandlerOptions{
		AddSource:   false,
		Level:       slog.LevelDebug,
		ReplaceAttr: nil,
	}))

	msg := sanitizeConnectorError(
		ctx,
		logger,
		false,
		errors.New( //nolint:err113 // test sentinel error used to verify error propagation
			"driver detail",
		),
	)

	if !strings.Contains(msg, wantTraceID) {
		t.Fatalf("client message %q did not carry the trace id from ctx", msg)
	}

	if !strings.Contains(buf.String(), wantTraceID) {
		t.Fatalf("server log %q did not carry the trace id from ctx", buf.String())
	}
}

// TestClassifyConnectorError_QueryValidationError pins that a query-validation
// failure passes through classifyConnectorError verbatim (via AsMap) instead of
// being sanitised into a generic trace-id message, so the wire envelope matches
// Hasura. It is wrapped with call-site context (as Connector.Execute and
// BuildQuery do) to prove the errors.AsType lookup still finds it through the
// wrap chain. devMode is false to prove the pass-through is independent of it.
func TestClassifyConnectorError_QueryValidationError(t *testing.T) {
	t.Parallel()

	c := &Controller{devMode: false}

	wrapped := fmt.Errorf(
		"failed to execute operations: %w",
		fmt.Errorf("failed to build query for field %q: %w", "departments",
			&arguments.QueryValidationError{
				Err:       arguments.ErrDistinctOnOrderByMismatch,
				RootField: "departments",
			},
		),
	)

	got := c.classifyConnectorError(context.Background(), slog.Default(), wrapped)

	want := []map[string]any{
		{
			"message": `"distinct_on" columns must match initial "order_by" columns`,
			"extensions": map[string]any{
				"code": "validation-failed",
				"path": "$.selectionSet.departments.args",
			},
		},
	}

	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("classifyConnectorError (-want +got):\n%s", diff)
	}
}
