package controller_test

import (
	"context"
	"log/slog"
	"os"
	"reflect"
	"testing"
	"time"

	"github.com/nhost/nhost/services/constellation/connector"
	"github.com/nhost/nhost/services/constellation/connector/memconnector"
	csql "github.com/nhost/nhost/services/constellation/connector/sql"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/controller"
	"github.com/nhost/nhost/services/constellation/controller/middleware"
	plannerpkg "github.com/nhost/nhost/services/constellation/controller/planner"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

func TestComputedSelectionViaRemoteDatabaseResult(t *testing.T) {
	t.Parallel()

	ddl, err := os.ReadFile(
		"../integration/nhost/migrations/default/1790001000000_computed_fields/up.sql",
	)
	if err != nil {
		t.Fatal(err)
	}

	seed, err := os.ReadFile("../integration/nhost/seeds/default/40-computed-fields.sql")
	if err != nil {
		t.Fatal(err)
	}

	raw, err := os.ReadFile("../integration/computedfields/testdata/metadata.json")
	if err != nil {
		t.Fatal(err)
	}

	md, err := metadata.FromHasuraJSON(raw)
	if err != nil {
		t.Fatal(err)
	}

	pool := testdb.NewPostgres(t, string(ddl), string(seed))

	pgPool, err := postgres.Open(t.Context(), pool.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatal(err)
	}

	logger := slog.New(slog.DiscardHandler)

	sqlConn, err := csql.NewConnector(
		t.Context(),
		postgres.NewClient(pgPool),
		&md.Databases[0],
		nil,
		logger,
	)
	if err != nil {
		pgPool.Close()
		t.Fatal(err)
	}

	t.Cleanup(sqlConn.Close)

	remote, err := memconnector.New(
		[]*graph.ObjectType{memconnector.Object("RemoteItem", memconnector.ID("itemId"),
			memconnector.Field("item", graph.NewNamedType("cf_select_items")))},
		[]memconnector.QueryDef{
			memconnector.Query("remote_items", graph.NewListType(graph.NewNamedType("RemoteItem")),
				[]any{map[string]any{"itemId": "1"}}),
		},
	)
	if err != nil {
		t.Fatal(err)
	}

	relationships := map[string][]*plannerpkg.RelationshipMetadata{
		"remote": {{
			Name: "item", SourceType: "RemoteItem", TargetConnector: "sql",
			TargetTable: "items", TargetTableSchema: "cf_select",
			JoinMapping: map[string]string{"itemId": "id"},
			IsRemote:    true,
		}},
	}

	ctrl, err := controller.NewFromConnectors(testAdminSecret,
		map[string]connector.Connector{"remote": remote, "sql": sqlConn}, relationships, logger)
	if err != nil {
		t.Fatal(err)
	}

	resp, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{
		Query: `{ remote_items { item { item_label item_second(args:{multiplier:2}) } } }`,
	})
	if err != nil || resp.Errors != nil {
		t.Fatalf("remote-to-database computed selection: response=%+v error=%v", resp, err)
	}

	want := map[string]any{"remote_items": []any{map[string]any{
		"item": map[string]any{"item_label": "first", "item_second": float64(25)},
	}}}
	if !reflect.DeepEqual(resp.Data, want) {
		t.Fatalf("remote-to-database result = %#v, want %#v", resp.Data, want)
	}
}

type computedStaticSource struct{ meta *metadata.Metadata }

func (s computedStaticSource) InitialLoad(context.Context) (*metadata.Metadata, error) {
	return s.meta, nil
}
func (s computedStaticSource) Watch(context.Context) <-chan metadata.Update { return nil }
func (s computedStaticSource) HasuraSnapshotJSON() ([]byte, int64)          { return nil, 0 }
func (s computedStaticSource) Close()                                       {}

func TestComputedSelectionViaCrossSource(t *testing.T) {
	t.Parallel()

	ddl, err := os.ReadFile(
		"../integration/nhost/migrations/default/1790001000000_computed_fields/up.sql",
	)
	if err != nil {
		t.Fatal(err)
	}

	seed, err := os.ReadFile("../integration/nhost/seeds/default/40-computed-fields.sql")
	if err != nil {
		t.Fatal(err)
	}

	raw, err := os.ReadFile("../integration/computedfields/testdata/metadata.json")
	if err != nil {
		t.Fatal(err)
	}

	md, err := metadata.FromHasuraJSON(raw)
	if err != nil {
		t.Fatal(err)
	}

	pool := testdb.NewPostgres(t, string(ddl), string(seed))
	for i := range md.Databases {
		md.Databases[i].Configuration.ConnectionInfo.DatabaseURL = metadata.EnvString(
			pool.Config().ConnConfig.ConnString(),
		)
	}

	md.Databases[1].Tables[0].RemoteRelationships = []metadata.RemoteRelationship{
		{
			Name: "item",
			Definition: metadata.RemoteRelationshipDef{ToSource: &metadata.ToSourceRelationship{
				FieldMapping:     map[string]string{"owner_id": "id"},
				RelationshipType: metadata.RelationshipTypeObject,
				Source:           "cf_select",
				Table:            metadata.TableSource{Schema: "cf_select", Name: "items"},
			}},
		},
	}
	logger := slog.New(slog.DiscardHandler)

	ctrl, err := controller.New(t.Context(), time.Second, testAdminSecret, false,
		middleware.NewNoOpJWTAuthenticator(), computedStaticSource{meta: md}, logger, "", nil)
	if err != nil {
		t.Fatal(err)
	}

	resp, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{
		Query: `{ cf_predicates_rules(where:{id:{_eq:1}}) { item { item_second(args:{multiplier:2}) } } }`,
	})
	if err != nil || resp.Errors != nil {
		t.Fatalf("cross-source computed selection: response=%+v error=%v", resp, err)
	}

	want := map[string]any{"cf_predicates_rules": []any{map[string]any{
		"item": map[string]any{"item_second": float64(25)},
	}}}
	if !reflect.DeepEqual(resp.Data, want) {
		t.Fatalf("cross-source result = %#v, want %#v", resp.Data, want)
	}
}
