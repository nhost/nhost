package configserver //nolint:testpackage

import (
	"context"
	"errors"
	"testing"

	"github.com/99designs/gqlgen/graphql"
	"github.com/vektah/gqlparser/v2/ast"
)

func TestDashboardOriginRegex(t *testing.T) {
	t.Parallel()

	cases := []struct {
		origin string
		want   bool
	}{
		{"https://local.dashboard.local.nhost.run", true},
		{"http://local.dashboard.local.nhost.run", true},
		{"https://local.dashboard.local.nhost.run:1337", true},
		{"https://dev.dashboard.local.nhost.run", true},
		{"https://dev.dashboard.local.nhost.run:8443", true},
		{"https://local.dashboard.nhost.run", true},
		{"http://local.dashboard.nhost.run:443", true},

		// Foreign origins must be rejected.
		{"https://evil.com", false},
		{"https://attacker.local.nhost.run", false},
		{"https://dashboard.local.nhost.run", false},
		{"https://dashboard.local.nhost.run.evil.com", false},
		{"https://local.dashboard.local.nhost.run.evil.com", false},
		{"https://local.dashboard.local.nhost.run/foo", false},
		{"http://localhost:3000", false},
		{"", false},
	}

	for _, tc := range cases {
		t.Run(tc.origin, func(t *testing.T) {
			t.Parallel()

			got := dashboardOriginRe.MatchString(tc.origin)
			if got != tc.want {
				t.Errorf("origin %q: got %v, want %v", tc.origin, got, tc.want)
			}
		})
	}
}

var errResolverBoom = errors.New("resolver boom")

// fieldCtx builds a *graphql.FieldContext for the given object/field name. The
// production code only reads fc.Object, fc.Field.Name, and (when walking
// parents) parent.Field.Field != nil, so a minimal ast.Field is enough.
func fieldCtx(object, name string) *graphql.FieldContext {
	return &graphql.FieldContext{ //nolint:exhaustruct
		Object: object,
		Field: graphql.CollectedField{ //nolint:exhaustruct
			Field: &ast.Field{Name: name}, //nolint:exhaustruct
		},
	}
}

// ctxWithChain builds a context whose innermost FieldContext represents
// ConfigEnvironmentVariable.value, wrapped in parents for each name in
// parentNames (innermost parent first).
func ctxWithChain(t *testing.T, parentNames ...string) context.Context {
	t.Helper()

	ctx := context.Background()
	for i := len(parentNames) - 1; i >= 0; i-- {
		ctx = graphql.WithFieldContext(ctx, fieldCtx("", parentNames[i])) //nolint:fatcontext
	}

	return graphql.WithFieldContext(ctx, fieldCtx("ConfigEnvironmentVariable", "value"))
}

func resolverReturning(v any) graphql.Resolver {
	return func(_ context.Context) (any, error) { return v, nil }
}

func TestRedactSecretValueMiddleware_RedactsStringForEverySecretParent(t *testing.T) {
	t.Parallel()

	secretParents := []string{
		"appSecrets", "appsSecrets", "secrets",
		"insertSecret", "updateSecret", "deleteSecret",
	}

	for _, parent := range secretParents {
		t.Run(parent, func(t *testing.T) {
			t.Parallel()

			ctx := ctxWithChain(t, parent)

			got, err := redactSecretValueMiddleware(ctx, resolverReturning("supersecret"))
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			s, ok := got.(string)
			if !ok {
				t.Fatalf("expected string, got %T", got)
			}

			if s != redactedSecretValue {
				t.Errorf("got %q, want %q", s, redactedSecretValue)
			}
		})
	}
}

func TestRedactSecretValueMiddleware_RedactsStringPointer(t *testing.T) {
	t.Parallel()

	ctx := ctxWithChain(t, "updateSecret")
	v := "supersecret"

	got, err := redactSecretValueMiddleware(ctx, resolverReturning(&v))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	p, ok := got.(*string)
	if !ok {
		t.Fatalf("expected *string, got %T", got)
	}

	if p == nil {
		t.Fatal("expected non-nil *string")
	}

	if *p != redactedSecretValue {
		t.Errorf("got %q, want %q", *p, redactedSecretValue)
	}
}

func TestRedactSecretValueMiddleware_PreservesNilStringPointer(t *testing.T) {
	t.Parallel()

	ctx := ctxWithChain(t, "appSecrets")

	var nilPtr *string

	got, err := redactSecretValueMiddleware(ctx, resolverReturning(nilPtr))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	p, ok := got.(*string)
	if !ok {
		t.Fatalf("expected *string, got %T", got)
	}

	if p != nil {
		t.Errorf("expected nil *string, got pointer to %q", *p)
	}
}

func TestRedactSecretValueMiddleware_PassesThroughUnrelatedTypes(t *testing.T) {
	t.Parallel()

	ctx := ctxWithChain(t, "updateSecret")

	got, err := redactSecretValueMiddleware(ctx, resolverReturning(42))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if got != 42 {
		t.Errorf("got %v, want 42", got)
	}
}

func TestRedactSecretValueMiddleware_PropagatesResolverError(t *testing.T) {
	t.Parallel()

	next := func(_ context.Context) (any, error) { return "supersecret", errResolverBoom }

	got, err := redactSecretValueMiddleware(context.Background(), next)
	if !errors.Is(err, errResolverBoom) {
		t.Fatalf("expected sentinel error, got %v", err)
	}

	if got != "supersecret" {
		t.Errorf("expected resolver value passed through, got %v", got)
	}
}

func TestRedactSecretValueMiddleware_LeavesNonSecretObjectUntouched(t *testing.T) {
	t.Parallel()

	ctx := graphql.WithFieldContext(
		graphql.WithFieldContext(context.Background(), fieldCtx("", "updateSecret")),
		fieldCtx("OtherType", "value"),
	)

	got, err := redactSecretValueMiddleware(ctx, resolverReturning("supersecret"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if got != "supersecret" {
		t.Errorf("got %q, want %q", got, "supersecret")
	}
}

func TestRedactSecretValueMiddleware_LeavesNonValueFieldUntouched(t *testing.T) {
	t.Parallel()

	ctx := graphql.WithFieldContext(
		graphql.WithFieldContext(context.Background(), fieldCtx("", "updateSecret")),
		fieldCtx("ConfigEnvironmentVariable", "name"),
	)

	got, err := redactSecretValueMiddleware(ctx, resolverReturning("MY_SECRET"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if got != "MY_SECRET" {
		t.Errorf("got %q, want %q", got, "MY_SECRET")
	}
}

func TestRedactSecretValueMiddleware_LeavesRunServiceEnvironmentUntouched(t *testing.T) {
	t.Parallel()

	// `environment` is the run-service path, which must NOT be redacted.
	ctx := ctxWithChain(t, "environment", "config", "runServices")

	got, err := redactSecretValueMiddleware(ctx, resolverReturning("PUBLIC_VAR_VALUE"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if got != "PUBLIC_VAR_VALUE" {
		t.Errorf("got %q, want %q", got, "PUBLIC_VAR_VALUE")
	}
}

func TestRedactSecretValueMiddleware_RedactsWhenSecretParentSeveralLevelsUp(t *testing.T) {
	t.Parallel()

	// Secret parent ("secrets") sits two levels above ConfigEnvironmentVariable.value.
	ctx := ctxWithChain(t, "wrapper", "secrets", "insertConfig")

	got, err := redactSecretValueMiddleware(ctx, resolverReturning("deeply-nested-secret"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if got != redactedSecretValue {
		t.Errorf("got %q, want %q", got, redactedSecretValue)
	}
}

func TestRedactSecretValueMiddleware_MissingFieldContextFallsThrough(t *testing.T) {
	t.Parallel()

	got, err := redactSecretValueMiddleware(context.Background(), resolverReturning("supersecret"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if got != "supersecret" {
		t.Errorf("got %q, want %q", got, "supersecret")
	}
}

func TestIsSecretFieldContext(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name        string
		parentNames []string
		want        bool
	}{
		{"appSecrets", []string{"appSecrets"}, true},
		{"appsSecrets", []string{"appsSecrets"}, true},
		{"secrets", []string{"secrets"}, true},
		{"insertSecret", []string{"insertSecret"}, true},
		{"updateSecret", []string{"updateSecret"}, true},
		{"deleteSecret", []string{"deleteSecret"}, true},

		{"nested secret parent (two up)", []string{"wrapper", "secrets"}, true},
		{"nested secret parent (three up)", []string{"a", "b", "updateSecret"}, true},

		{"run-service environment", []string{"environment", "config", "runServices"}, false},
		{"no parents", nil, false},
		{"unrelated parent", []string{"app"}, false},
		{"plural-ish but not in list", []string{"appSecret"}, false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctx := ctxWithChain(t, tc.parentNames...)

			got := isSecretFieldContext(graphql.GetFieldContext(ctx))
			if got != tc.want {
				t.Errorf("parents %v: got %v, want %v", tc.parentNames, got, tc.want)
			}
		})
	}
}
