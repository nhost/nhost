package connector

import (
	"errors"
	"log/slog"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/customization"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/vektah/gqlparser/v2/ast"
)

// errCustomizedExecBoom is a test sentinel error used to verify error
// propagation from the inner connector's Execute call.
var errCustomizedExecBoom = errors.New("boom")

// namespacedQueryOp returns the customized (client-facing) operation
// query { league { teams { __typename } } }. Under the primed customizer the
// decorator must reverse it to native query { teams { __typename } } before
// calling the inner connector, then re-wrap the result under league and remap
// __typename Team -> LeagueTeam.
func namespacedQueryOp() *ast.OperationDefinition {
	return &ast.OperationDefinition{
		Operation: ast.Query,
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

// nativeTeamsResult is what an inner connector returns for the reversed native
// operation: the lifted root field `teams` with a Team __typename.
func nativeTeamsResult() map[string]any {
	return map[string]any{
		"teams": []any{
			map[string]any{"__typename": "Team"},
		},
	}
}

// assertReshaped asserts the native teams result was re-wrapped under league
// and its __typename remapped Team -> LeagueTeam, proving ForwardResult ran.
func assertReshaped(t *testing.T, got map[string]any) {
	t.Helper()

	league, ok := got["league"].(map[string]any)
	if !ok {
		t.Fatalf("result not re-wrapped under league: %#v", got)
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
		t.Errorf("__typename = %v, want LeagueTeam (remapped from Team)", first["__typename"])
	}
}

// assertReversedToNative asserts the decorator reversed the customized op to
// the native operation before calling inner: league unwrapped so the root
// field is `teams`.
func assertReversedToNative(t *testing.T, op *ast.OperationDefinition) {
	t.Helper()

	if op == nil || len(op.SelectionSet) != 1 {
		t.Fatalf("inner did not receive a reversed operation: %#v", op)
	}

	root, ok := op.SelectionSet[0].(*ast.Field)
	if !ok || root.Name != "teams" {
		t.Fatalf("inner root selection = %#v, want field teams", op.SelectionSet[0])
	}
}

// assertWrappedError asserts the error wraps innerErr and is annotated with the
// connector name.
func assertWrappedError(t *testing.T, err, innerErr error) {
	t.Helper()

	if !errors.Is(err, innerErr) {
		t.Errorf("error chain does not wrap inner error: %v", err)
	}

	if !strings.Contains(err.Error(), "customized connector default") {
		t.Errorf("error not annotated with connector name: %v", err)
	}
}

func TestCustomizedConnectorExecute(t *testing.T) {
	t.Parallel()

	innerErr := errCustomizedExecBoom

	tests := []struct {
		name       string
		execData   map[string]any
		execErr    error
		wantErr    bool
		wantData   bool // whether reshaped data is expected (re-wrapped under league)
		assertData func(*testing.T, map[string]any)
	}{
		{
			name:       "success reshapes data",
			execData:   nativeTeamsResult(),
			execErr:    nil,
			wantErr:    false,
			wantData:   true,
			assertData: assertReshaped,
		},
		{
			// The subtle branch the finding cares about: the inner connector
			// returns partial data alongside an error. The decorator must STILL
			// reshape and return that partial data, while wrapping the error.
			name:       "inner error keeps reshaped partial data",
			execData:   nativeTeamsResult(),
			execErr:    innerErr,
			wantErr:    true,
			wantData:   true,
			assertData: assertReshaped,
		},
		{
			name:       "inner error with no data returns nil data and wrapped error",
			execData:   nil,
			execErr:    innerErr,
			wantErr:    true,
			wantData:   false,
			assertData: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			inner := &fakeConnector{
				schema:   teamSchema(),
				execData: tt.execData,
				execErr:  tt.execErr,
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

			got, err := conn.Execute(
				t.Context(),
				namespacedQueryOp(),
				nil,
				nil,
				metadata.RoleAdmin,
				nil,
				slog.Default(),
			)

			assertReversedToNative(t, inner.gotOp)

			switch {
			case tt.wantErr && err == nil:
				t.Fatalf("expected error, got nil")
			case !tt.wantErr && err != nil:
				t.Fatalf("unexpected error: %v", err)
			}

			if tt.wantErr {
				assertWrappedError(t, err, tt.execErr)
			}

			switch {
			case tt.wantData && got == nil:
				t.Fatalf("expected reshaped data, got nil (partial data dropped on error)")
			case tt.wantData:
				tt.assertData(t, got)
			case got != nil:
				t.Errorf("expected nil data, got %#v", got)
			}
		})
	}
}

func TestCustomizedConnectorGetSchema(t *testing.T) {
	t.Parallel()

	inner := &fakeConnector{schema: teamSchema()}

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

	schemas, err := conn.GetSchema()
	if err != nil {
		t.Fatalf("GetSchema: %v", err)
	}

	schema, ok := schemas[metadata.RoleAdmin]
	if !ok {
		t.Fatalf("admin schema missing: %#v", schemas)
	}

	// The returned schema must be the customized one, not the inner native
	// schema: the Team type is prefixed to LeagueTeam.
	var hasLeagueTeam bool

	for _, ty := range schema.Types {
		if ty.Name == "LeagueTeam" {
			hasLeagueTeam = true
		}

		if ty.Name == "Team" {
			t.Errorf("native type Team leaked into customized schema")
		}
	}

	if !hasLeagueTeam {
		t.Errorf("customized schema missing prefixed type LeagueTeam: %#v", schema.Types)
	}
}

func TestCustomizedConnectorGetTypeName(t *testing.T) {
	t.Parallel()

	inner := &fakeConnector{schema: teamSchema(), typeName: "native_type"}

	conn, err := newCustomizedConnector(
		"default",
		inner,
		metadata.Customization{RootFieldsNamespace: "league"},
		customization.FlavorDatabase,
	)
	if err != nil {
		t.Fatalf("newCustomizedConnector: %v", err)
	}

	if got := conn.GetTypeName("anything"); got != "native_type" {
		t.Errorf("GetTypeName = %q, want native_type (delegated to inner)", got)
	}
}

func TestCustomizedConnectorClose(t *testing.T) {
	t.Parallel()

	inner := &fakeConnector{schema: teamSchema()}

	conn, err := newCustomizedConnector(
		"default",
		inner,
		metadata.Customization{RootFieldsNamespace: "league"},
		customization.FlavorDatabase,
	)
	if err != nil {
		t.Fatalf("newCustomizedConnector: %v", err)
	}

	conn.Close()

	if !inner.closed {
		t.Errorf("Close not delegated to inner connector")
	}
}

// TestCustomizedConnectorRelationshipNamingDivergence pins the documented
// (and currently unguarded) limitation called out on the customizedConnector
// type: the decorator renames types in the schema it advertises (via
// Apply/GetSchema) but GetTypeName still returns the inner connector's NATIVE
// name. The composer keys remote-relationship field injection off GetTypeName
// (connector/composer/composer.go:231 calls dbConn.GetTypeName(...) and injects
// the relationship field onto that type), so for a customized source it would
// target the native type name (Team) -- a type the customized schema no longer
// contains, having renamed it to LeagueTeam. That divergence is exactly why the
// type comment says "no metadata in use combines the two": pairing a namespaced
// source with a remote relationship is silently wrong.
//
// A construction-time guard mirroring the field_names check is NOT feasible:
// newCustomizedConnector only receives (name, inner, cfg metadata.Customization,
// flavor). cfg carries namespace/prefix/suffix/type-mapping/field_names only --
// field_names CAN be rejected because it lives in cfg, but remote relationships
// live in dbMeta.Tables[].RemoteRelationships / rsMeta.RemoteRelationships,
// which are never passed to the constructor. The constructor also cannot see the
// targeted side (another source pointing AT this one); only the composer, which
// holds the full metadata.Metadata, can. This test therefore pins the behaviour
// so the relationship-injection contract (GetTypeName == native, schema ==
// renamed) is captured and any future change that silently alters it is caught.
func TestCustomizedConnectorRelationshipNamingDivergence(t *testing.T) {
	t.Parallel()

	// The composer reads the source type the relationship is injected onto via
	// GetTypeName; the inner connector returns its native type name verbatim.
	inner := &fakeConnector{schema: teamSchema(), typeName: "Team"}

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

	// GetTypeName returns the NATIVE name (Team) -- this is what the composer
	// would inject the remote-relationship field onto.
	gotTypeName := conn.GetTypeName("public.team")
	if gotTypeName != "Team" {
		t.Fatalf("GetTypeName = %q, want native Team (the relationship target)", gotTypeName)
	}

	schemas, err := conn.GetSchema()
	if err != nil {
		t.Fatalf("GetSchema: %v", err)
	}

	schema := schemas[metadata.RoleAdmin]
	if schema == nil {
		t.Fatalf("admin schema missing: %#v", schemas)
	}

	// The advertised schema renamed Team -> LeagueTeam, so the type the composer
	// injects the relationship field onto (gotTypeName == Team) does NOT exist in
	// the customized schema. This divergence is the documented silent-wrong path.
	var hasNative, hasRenamed bool

	for _, ty := range schema.Types {
		switch ty.Name {
		case gotTypeName: // "Team"
			hasNative = true
		case "LeagueTeam":
			hasRenamed = true
		}
	}

	if hasNative {
		t.Errorf(
			"customized schema unexpectedly contains native type %q; relationship-injection divergence no longer holds",
			gotTypeName,
		)
	}

	if !hasRenamed {
		t.Errorf("customized schema missing renamed type LeagueTeam: %#v", schema.Types)
	}
}

func TestNewCustomizedConnectorRejectsFieldNames(t *testing.T) {
	t.Parallel()

	_, err := newCustomizedConnector(
		"rs",
		&fakeConnector{schema: teamSchema()},
		metadata.Customization{
			FieldNames: []metadata.FieldNameCustomization{
				{
					ParentType: "Team",
					Mapping:    map[string]string{"name": "displayName"},
				},
			},
		},
		customization.FlavorRemoteSchema,
	)
	if err == nil {
		t.Fatal("expected error for field_names customization, got nil")
	}

	if !strings.Contains(err.Error(), "field_names") {
		t.Errorf("error should mention field_names, got: %v", err)
	}
}
