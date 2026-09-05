package connector

import (
	"context"
	"errors"
	"log/slog"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/action"
	"github.com/nhost/nhost/services/constellation/connector/action/store"
	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/vektah/gqlparser/v2/ast"
)

// fakeActionConn is a configurable Connector used by the action-build unit
// tests. Only GetSchema and GetTypeName are exercised by the functions under
// test; the remaining methods are inert.
type fakeActionConn struct {
	schemas   map[string]*graph.Schema
	schemaErr error
	typeNames map[string]string
}

func (c *fakeActionConn) GetSchema() (map[string]*graph.Schema, error) {
	return c.schemas, c.schemaErr
}

func (c *fakeActionConn) Execute(
	context.Context,
	*ast.OperationDefinition,
	ast.FragmentDefinitionList,
	map[string]any,
	string,
	map[string]any,
	*slog.Logger,
) (map[string]any, error) {
	return nil, nil //nolint:nilnil
}

func (c *fakeActionConn) ValidateOperation(
	*ast.OperationDefinition,
	ast.FragmentDefinitionList,
	map[string]any,
	string,
	map[string]any,
) error {
	return nil
}

func (c *fakeActionConn) GetTypeName(identifier string) string {
	return c.typeNames[identifier]
}

func (c *fakeActionConn) Close() {}

func TestActionConnectorNameCollides(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		meta       *metadata.Metadata
		connectors map[string]Connector
		want       bool
	}{
		{
			name:       "no collision",
			meta:       &metadata.Metadata{},
			connectors: map[string]Connector{"db1": &fakeActionConn{}},
			want:       false,
		},
		{
			name:       "existing connector",
			meta:       &metadata.Metadata{},
			connectors: map[string]Connector{actionConnectorName: &fakeActionConn{}},
			want:       true,
		},
		{
			name: "database name",
			meta: &metadata.Metadata{
				Databases: []metadata.DatabaseMetadata{{Name: actionConnectorName}},
			},
			connectors: map[string]Connector{},
			want:       true,
		},
		{
			name: "remote schema name",
			meta: &metadata.Metadata{
				RemoteSchemas: []metadata.RemoteSchemaMetadata{{Name: actionConnectorName}},
			},
			connectors: map[string]Connector{},
			want:       true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := actionConnectorNameCollides(tt.meta, tt.connectors); got != tt.want {
				t.Errorf("actionConnectorNameCollides = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestRecordActionConnectorCollision(t *testing.T) {
	t.Parallel()

	meta := &metadata.Metadata{
		Actions: []metadata.ActionMetadata{{Name: "a1"}, {Name: "a2"}},
		CustomTypes: metadata.CustomTypes{
			Objects: []metadata.CustomObjectType{{Name: "T1"}},
			Scalars: []metadata.CustomScalarType{{Name: "S1"}},
		},
	}

	cfg := &buildConfig{inconsistencies: metadata.NewInconsistencies()}
	cfg.recordActionConnectorCollision(context.Background(), meta, slog.Default())

	snap := cfg.inconsistencies.Snapshot()

	byKind := map[string][]string{}
	for _, inc := range snap {
		byKind[inc.Kind] = append(byKind[inc.Kind], inc.Name)
		if inc.Reason == "" {
			t.Errorf("inconsistency %q has empty reason", inc.Name)
		}
	}

	if got := byKind[metadata.InconsistencyKindAction]; len(got) != 2 {
		t.Errorf("action inconsistencies = %v, want one per action", got)
	}

	if got := byKind[metadata.InconsistencyKindCustomType]; len(got) != 2 {
		t.Errorf("custom-type inconsistencies = %v, want one per custom type", got)
	}
}

func TestResolveActionLogDatabaseURL(t *testing.T) {
	t.Parallel()

	postgresDB := metadata.DatabaseMetadata{
		Name: "default",
		Kind: "postgres",
		Configuration: metadata.DatabaseConfiguration{
			ConnectionInfo: metadata.DatabaseConnectionInfo{
				DatabaseURL: "postgres://first/db",
			},
		},
	}

	tests := []struct {
		name    string
		cfg     ActionLogConfig
		meta    *metadata.Metadata
		want    string
		wantErr error
	}{
		{
			name: "explicit database url wins",
			cfg: ActionLogConfig{
				DatabaseURL:         "postgres://explicit/db",
				MetadataDatabaseURL: "postgres://meta/db",
			},
			meta: &metadata.Metadata{Databases: []metadata.DatabaseMetadata{postgresDB}},
			want: "postgres://explicit/db",
		},
		{
			name: "metadata database url fallback",
			cfg:  ActionLogConfig{MetadataDatabaseURL: "postgres://meta/db"},
			meta: &metadata.Metadata{Databases: []metadata.DatabaseMetadata{postgresDB}},
			want: "postgres://meta/db",
		},
		{
			name: "first postgres source",
			cfg:  ActionLogConfig{},
			meta: &metadata.Metadata{Databases: []metadata.DatabaseMetadata{
				{Name: "lite", Kind: "sqlite"},
				postgresDB,
			}},
			want: "postgres://first/db",
		},
		{
			name: "no source configured",
			cfg:  ActionLogConfig{},
			meta: &metadata.Metadata{
				Databases: []metadata.DatabaseMetadata{{Name: "lite", Kind: "sqlite"}},
			},
			wantErr: ErrActionLogStoreNotConfigured,
		},
		{
			name:    "no databases",
			cfg:     ActionLogConfig{},
			meta:    &metadata.Metadata{},
			wantErr: ErrActionLogStoreNotConfigured,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			cfg := &buildConfig{actionLogConfig: tt.cfg}

			got, err := cfg.resolveActionLogDatabaseURL(tt.meta)
			if tt.wantErr != nil {
				if !errors.Is(err, tt.wantErr) {
					t.Fatalf("err = %v, want %v", err, tt.wantErr)
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected err: %v", err)
			}

			if got != tt.want {
				t.Errorf("url = %q, want %q", got, tt.want)
			}
		})
	}
}

func asyncActionMeta() *metadata.Metadata {
	return &metadata.Metadata{
		Actions: []metadata.ActionMetadata{{
			Name:       "asyncAction",
			Definition: metadata.ActionDefinition{Kind: metadata.ActionKindAsynchronous},
		}},
	}
}

func TestResolveActionAsyncConfig(t *testing.T) {
	t.Parallel()

	mem := store.NewMemory()
	t.Cleanup(mem.Close)

	tests := []struct {
		name              string
		cfg               ActionLogConfig
		meta              *metadata.Metadata
		wantStore         bool
		wantCloseStore    bool
		wantWorker        bool
		wantUnavailableIs string // substring of UnavailableReason ("" means must be empty)
	}{
		{
			name: "no async metadata",
			cfg:  ActionLogConfig{Store: mem, WorkerEnabled: true},
			meta: &metadata.Metadata{Actions: []metadata.ActionMetadata{{
				Name:       "syncAction",
				Definition: metadata.ActionDefinition{Kind: metadata.ActionKindSynchronous},
			}}},
		},
		{
			name: "worker requires exclusive owner",
			cfg: ActionLogConfig{
				Store:          mem,
				WorkerEnabled:  true,
				ExclusiveOwner: false,
			},
			meta:              asyncActionMeta(),
			wantUnavailableIs: "exclusive action-log ownership",
		},
		{
			name:           "store provided",
			cfg:            ActionLogConfig{Store: mem, WorkerEnabled: true, ExclusiveOwner: true},
			meta:           asyncActionMeta(),
			wantStore:      true,
			wantCloseStore: false,
			wantWorker:     true,
		},
		{
			name:              "store not configured",
			cfg:               ActionLogConfig{},
			meta:              asyncActionMeta(),
			wantUnavailableIs: ErrActionLogStoreNotConfigured.Error(),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			cfg := &buildConfig{actionLogConfig: tt.cfg}

			got := cfg.resolveActionAsyncConfig(context.Background(), tt.meta, slog.Default())

			if (got.Store != nil) != tt.wantStore {
				t.Errorf("Store != nil = %v, want %v", got.Store != nil, tt.wantStore)
			}

			if got.CloseStore != tt.wantCloseStore {
				t.Errorf("CloseStore = %v, want %v", got.CloseStore, tt.wantCloseStore)
			}

			if got.WorkerEnabled != tt.wantWorker {
				t.Errorf("WorkerEnabled = %v, want %v", got.WorkerEnabled, tt.wantWorker)
			}

			switch {
			case tt.wantUnavailableIs == "" && got.UnavailableReason != "":
				t.Errorf("UnavailableReason = %q, want empty", got.UnavailableReason)
			case tt.wantUnavailableIs != "" && got.UnavailableReason == "":
				t.Errorf("UnavailableReason empty, want substring %q", tt.wantUnavailableIs)
			}
		})
	}
}

func TestActionRelationshipTargets(t *testing.T) {
	t.Parallel()

	// usersType with id+name for admin, id only for user, gating relationship
	// field exposure per role.
	adminSchema := &graph.Schema{Types: []*graph.ObjectType{{
		Name:   "users",
		Fields: []*graph.Field{{Name: "id"}, {Name: "name"}},
	}}}
	userSchema := &graph.Schema{Types: []*graph.ObjectType{{
		Name:   "users",
		Fields: []*graph.Field{{Name: "id"}},
	}}}

	db := &fakeActionConn{
		schemas:   map[string]*graph.Schema{"admin": adminSchema, "user": userSchema},
		typeNames: map[string]string{"public.users": "users"},
	}

	meta := &metadata.Metadata{
		CustomTypes: metadata.CustomTypes{Objects: []metadata.CustomObjectType{{
			Name: "Obj1",
			Relationships: []metadata.CustomObjectRelationship{{
				Name:        "user",
				Source:      "db1",
				RemoteTable: metadata.TableSource{Schema: "public", Name: "users"},
			}},
		}, {
			// Duplicate relationship key (same source/schema/table) must dedup.
			Name: "Obj2",
			Relationships: []metadata.CustomObjectRelationship{{
				Name:        "user",
				Source:      "db1",
				RemoteTable: metadata.TableSource{Schema: "public", Name: "users"},
			}, {
				// Source connector absent -> dropped.
				Name:        "ghost",
				Source:      "missing",
				RemoteTable: metadata.TableSource{Schema: "public", Name: "ghosts"},
			}},
		}}},
	}

	connectors := map[string]Connector{"db1": db}

	targets := actionRelationshipTargets(meta, connectors)

	if len(targets) != 1 {
		t.Fatalf("targets = %d, want 1 (deduped, missing source dropped)", len(targets))
	}

	key := action.RelationshipTargetKey{Source: "db1", Schema: "public", Table: "users"}
	target, ok := targets[key]
	if !ok {
		t.Fatalf("target for %+v missing; got %+v", key, targets)
	}

	admin, ok := target.Roles["admin"]
	if !ok {
		t.Fatalf("admin role missing from target")
	}

	if _, ok := admin.Fields["name"]; !ok {
		t.Errorf("admin fields missing 'name'; got %v", admin.Fields)
	}

	user, ok := target.Roles["user"]
	if !ok {
		t.Fatalf("user role missing from target")
	}

	if _, ok := user.Fields["name"]; ok {
		t.Errorf("user role must not see 'name'; got %v", user.Fields)
	}
}

func TestOccupiedActionNames(t *testing.T) {
	t.Parallel()

	queryRoot := "query_root"
	schema := &graph.Schema{
		QueryType: &queryRoot,
		Types: []*graph.ObjectType{
			{Name: "query_root", Fields: []*graph.Field{{Name: "fetchUsers"}}},
			{Name: "Users", Fields: []*graph.Field{{Name: "id"}}},
		},
		Scalars: []*graph.ScalarType{{Name: "jsonb"}},
	}

	connectors := map[string]Connector{"db1": &fakeActionConn{
		schemas: map[string]*graph.Schema{"admin": schema},
	}}

	rootFields, typeNames := occupiedActionNames(connectors)

	wantRootKey := schemamerge.FieldKey(ast.Query, "fetchUsers")
	if _, ok := rootFields["admin"][wantRootKey]; !ok {
		t.Errorf("root fields for admin missing %q; got %v", wantRootKey, rootFields["admin"])
	}

	for _, want := range []string{"query_root", "Users", "jsonb"} {
		if _, ok := typeNames["admin"][want]; !ok {
			t.Errorf("type names for admin missing %q; got %v", want, typeNames["admin"])
		}
	}
}
