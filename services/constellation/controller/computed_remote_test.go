package controller_test

import (
	"context"
	"log/slog"
	"net/http"
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
		Query: `{ remote_items { item { item_label item_second(args:{multiplier:2}) item_tags(order_by:{id:asc}) { id label } } } }`,
	})
	if err != nil || resp.Errors != nil {
		t.Fatalf("remote-to-database computed selection: response=%+v error=%v", resp, err)
	}

	want := map[string]any{"remote_items": []any{map[string]any{
		"item": map[string]any{
			"item_label": "first", "item_second": float64(25),
			"item_tags": []any{
				map[string]any{"id": float64(1), "label": "one"},
				map[string]any{"id": float64(2), "label": "two"},
			},
		},
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

//nolint:tparallel // Subtests share one pool and run sequentially to respect the testdb connection budget.
func TestComputedSelectionViaCrossSource(
	t *testing.T,
) {
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
		{
			Name: "items",
			Definition: metadata.RemoteRelationshipDef{ToSource: &metadata.ToSourceRelationship{
				FieldMapping:     map[string]string{"owner_id": "id"},
				RelationshipType: metadata.RelationshipTypeArray,
				Source:           "cf_select",
				Table:            metadata.TableSource{Schema: "cf_select", Name: "items"},
			}},
		},
	}
	md.Databases[0].Tables[1].RemoteRelationships = []metadata.RemoteRelationship{{
		Name: "rule",
		Definition: metadata.RemoteRelationshipDef{ToSource: &metadata.ToSourceRelationship{
			FieldMapping:     map[string]string{"item_id": "owner_id"},
			RelationshipType: metadata.RelationshipTypeObject,
			Source:           "cf_predicates",
			Table:            metadata.TableSource{Schema: "cf_predicates", Name: "rules"},
		}},
	}}
	// A restricted target row must stay hidden after a cross-source join.
	for i := range md.Databases[0].Tables[1].SelectPermissions {
		permission := &md.Databases[0].Tables[1].SelectPermissions[i]
		if permission.Role == "cf_reader" {
			permission.Permission.Filter = map[string]any{"id": map[string]any{"_gte": 2}}
		}
	}

	logger := slog.New(slog.DiscardHandler)

	ctrl, err := controller.New(t.Context(), time.Second, testAdminSecret, false,
		middleware.NewNoOpJWTAuthenticator(), computedStaticSource{meta: md}, logger, "", nil)
	if err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name, query, role string
		want              map[string]any
	}{
		{
			name: "object with ordered computed rows",
			query: `{ cf_predicates_rules(order_by:{id:asc}) { item {
				item_second(args:{multiplier:2}) item_tags(order_by:{id:desc},limit:1) { id label }
			} } }`,
			want: map[string]any{"cf_predicates_rules": []any{
				map[string]any{"item": map[string]any{
					"item_second": float64(25),
					"item_tags":   []any{map[string]any{"id": float64(2), "label": "two"}},
				}},
				map[string]any{"item": map[string]any{
					"item_second": float64(6.5),
					"item_tags":   []any{map[string]any{"id": float64(3), "label": "three"}},
				}},
			}},
		},
		{
			name: "array with computed target predicate and ordering",
			query: `{ cf_predicates_rules(order_by:{id:asc}) {
				items(where:{item_tags:{id:{_eq:3}}},order_by:{item_tags_aggregate:{count:desc}}) { id }
			} }`,
			want: map[string]any{"cf_predicates_rules": []any{
				map[string]any{"items": []any{}},
				map[string]any{"items": []any{map[string]any{"id": float64(2)}}},
			}},
		},
		{
			name: "array with target filter",
			query: `{ cf_predicates_rules(order_by:{id:asc}) {
				items(where:{id:{_gt:1}}) { item_tags { id label } }
			} }`,
			want: map[string]any{"cf_predicates_rules": []any{
				map[string]any{"items": []any{}},
				map[string]any{"items": []any{map[string]any{"item_tags": []any{
					map[string]any{"id": float64(3), "label": "three"},
				}}}},
			}},
		},
		{
			name: "grouped aggregate nodes",
			query: `{ cf_predicates_rules(order_by:{id:asc}) {
				items_aggregate { aggregate { count } nodes { id item_tags { id label } } }
			} }`,
			want: map[string]any{"cf_predicates_rules": []any{
				map[string]any{"items_aggregate": map[string]any{
					"aggregate": map[string]any{"count": float64(1)},
					"nodes": []any{map[string]any{"id": float64(1), "item_tags": []any{
						map[string]any{"id": float64(1), "label": "one"},
						map[string]any{"id": float64(2), "label": "two"},
					}}},
				}},
				map[string]any{"items_aggregate": map[string]any{
					"aggregate": map[string]any{"count": float64(1)},
					"nodes": []any{map[string]any{"id": float64(2), "item_tags": []any{
						map[string]any{"id": float64(3), "label": "three"},
					}}},
				}},
			}},
		},
		{
			name: "grouped aggregate with computed filter",
			query: `{ cf_predicates_rules(order_by:{id:asc}) {
				items_aggregate(where:{item_tags:{id:{_eq:3}}}) { aggregate { count } nodes { id } }
			} }`,
			want: map[string]any{"cf_predicates_rules": []any{
				map[string]any{"items_aggregate": map[string]any{
					"aggregate": map[string]any{"count": float64(0)}, "nodes": []any{},
				}},
				map[string]any{"items_aggregate": map[string]any{
					"aggregate": map[string]any{"count": float64(1)},
					"nodes":     []any{map[string]any{"id": float64(2)}},
				}},
			}},
		},
		{
			name: "nested remote relationship with phantom join column",
			query: `{ cf_select_items(order_by:{id:asc}) { item_tags(order_by:{id:asc}) {
				label rule { id }
			} } }`,
			want: map[string]any{"cf_select_items": []any{
				map[string]any{"item_tags": []any{
					map[string]any{"label": "one", "rule": map[string]any{"id": float64(1)}},
					map[string]any{"label": "two", "rule": map[string]any{"id": float64(1)}},
				}},
				map[string]any{"item_tags": []any{
					map[string]any{"label": "three", "rule": map[string]any{"id": float64(2)}},
				}},
			}},
		},
		{
			name: "target row permission after stitching",
			role: "cf_reader",
			query: `{ cf_predicates_rules(order_by:{id:asc}) {
				item { item_tags(order_by:{id:asc}) { id label } }
			} }`,
			want: map[string]any{"cf_predicates_rules": []any{
				map[string]any{"item": map[string]any{"item_tags": []any{
					map[string]any{"id": float64(2), "label": "two"},
				}}},
				map[string]any{"item": map[string]any{"item_tags": []any{
					map[string]any{"id": float64(3), "label": "three"},
				}}},
			}},
		},
		{
			name:  "scalar predicate before join",
			query: `{ cf_predicates_rules(where:{rule_visible:{_eq:true}}) { item { item_label } } }`,
			want: map[string]any{"cf_predicates_rules": []any{map[string]any{
				"item": map[string]any{"item_label": "first"},
			}}},
		},
	}
	for _, tt := range tests { //nolint:paralleltest // Sequential queries avoid exceeding the shared testdb connection budget.
		t.Run(tt.name, func(t *testing.T) {
			ctx := adminSessionContext(t)
			if tt.role != "" {
				// With no JWT, the role override requires the admin credential; otherwise middleware uses public.
				ctx = runSessionMiddleware(t, http.Header{
					"X-Hasura-Admin-Secret": {testAdminSecret},
					"X-Hasura-Role":         {tt.role},
				})
			}

			resp, err := ctrl.Resolve(ctx, controller.GraphQLRequest{Query: tt.query})
			if err != nil || resp.Errors != nil {
				t.Fatalf("cross-source selection: response=%+v error=%v", resp, err)
			}

			if !reflect.DeepEqual(resp.Data, tt.want) {
				t.Fatalf("cross-source result = %#v, want %#v", resp.Data, tt.want)
			}
		})
	}
}
