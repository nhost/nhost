package queries_test

import (
	"log/slog"
	"strings"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

const (
	clubA  = "00000000-0000-0000-0000-00000000000a"
	clubB  = "00000000-0000-0000-0000-00000000000b"
	waterA = "00000000-0000-0000-0000-0000000000aa"
)

// TestPostgresInsertCheckColumnComparisonThroughRelationship reproduces
// nhost/nhost#5113: an insert check that compares a related row's column with
// the inserted row's column through `_ceq: ["$", column]`. Before column
// comparison support the permission failed to parse and the whole source was
// dropped as inconsistent.
func TestPostgresInsertCheckColumnComparisonThroughRelationship(t *testing.T) {
	t.Parallel()

	seedPool := testdb.NewPostgres(
		t,
		`CREATE TABLE public.clubs (
			id uuid PRIMARY KEY,
			saas_lifecycle_status text NOT NULL
		);`,
		`CREATE TABLE public.waters (
			id uuid PRIMARY KEY,
			club_id uuid NOT NULL REFERENCES public.clubs(id)
		);`,
		`CREATE TABLE public.club_stocking_plans (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			club_id uuid NOT NULL REFERENCES public.clubs(id),
			water_id uuid NOT NULL REFERENCES public.waters(id)
		);`,
		`INSERT INTO public.clubs (id, saas_lifecycle_status)
		 VALUES ('`+clubA+`', 'active'), ('`+clubB+`', 'active');`,
		`INSERT INTO public.waters (id, club_id) VALUES ('`+waterA+`', '`+clubA+`');`,
	)

	pool, err := postgres.Open(t.Context(), seedPool.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatalf("postgres.Open: %v", err)
	}

	t.Cleanup(pool.Close)

	client := postgres.NewClient(pool)
	md := clubStockingPlansMetadata()

	objects, err := client.Introspect(t.Context(), md)
	if err != nil {
		t.Fatalf("Introspect: %v", err)
	}

	roots, _, err := queries.BuildRoots(objects, md, &dialect.PostgresDialect{})
	if err != nil {
		t.Fatalf("BuildRoots: %v", err)
	}

	tests := []struct {
		name    string
		clubID  string
		wantErr bool
	}{
		{name: "water belongs to the plan's club", clubID: clubA, wantErr: false},
		{name: "water belongs to another club", clubID: clubB, wantErr: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			doc, gqlErr := parser.ParseQuery(&ast.Source{Input: `
				mutation {
				  insert_club_stocking_plans(
				    objects: [{club_id: "` + tc.clubID + `", water_id: "` + waterA + `"}]
				  ) {
				    affected_rows
				  }
				}`})
			if gqlErr != nil {
				t.Fatalf("ParseQuery: %v", gqlErr)
			}

			operations, err := roots.BuildQuery(
				doc.Operations[0], doc.Fragments, nil, "user", map[string]any{},
			)
			if err != nil {
				t.Fatalf("BuildQuery: %v", err)
			}

			_, err = client.ExecuteOperations(
				t.Context(), operations, slog.New(slog.DiscardHandler),
			)
			if gotErr := err != nil; gotErr != tc.wantErr {
				t.Fatalf("ExecuteOperations error = %v, wantErr %v", err, tc.wantErr)
			}

			if tc.wantErr && !strings.Contains(err.Error(), "permission has failed") {
				t.Fatalf("expected an insert permission failure, got %v", err)
			}

			var count int
			if err := pool.QueryRow(
				t.Context(),
				`SELECT count(*) FROM public.club_stocking_plans WHERE club_id = $1`,
				tc.clubID,
			).Scan(&count); err != nil {
				t.Fatalf("counting rows: %v", err)
			}

			wantCount := 1
			if tc.wantErr {
				wantCount = 0
			}

			if count != wantCount {
				t.Errorf("stored rows for club %s = %d, want %d", tc.clubID, count, wantCount)
			}
		})
	}
}

// clubStockingPlansMetadata is the metadata from nhost/nhost#5113.
func clubStockingPlansMetadata() *metadata.DatabaseMetadata {
	return &metadata.DatabaseMetadata{
		Name: "default",
		Kind: "postgres",
		Tables: []metadata.TableMetadata{
			{Table: metadata.TableSource{Schema: "public", Name: "clubs"}},
			{Table: metadata.TableSource{Schema: "public", Name: "waters"}},
			{
				Table: metadata.TableSource{Schema: "public", Name: "club_stocking_plans"},
				ObjectRelationships: []metadata.ObjectRelationship{
					{
						Name:  "water",
						Using: metadata.RelationshipUsing{ForeignKeyColumns: []string{"water_id"}},
					},
					{
						Name:  "club",
						Using: metadata.RelationshipUsing{ForeignKeyColumns: []string{"club_id"}},
					},
				},
				InsertPermissions: []metadata.InsertPermission{
					{
						Role: "user",
						Permission: metadata.InsertPermissionConfig{
							Columns: []string{"club_id", "water_id"},
							Check: map[string]any{
								"_and": []any{
									map[string]any{
										"water": map[string]any{
											"club_id": map[string]any{
												"_ceq": []any{"$", "club_id"},
											},
										},
									},
									map[string]any{
										"club": map[string]any{
											"saas_lifecycle_status": map[string]any{
												"_in": []any{"test", "active"},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}
}
