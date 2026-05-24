package postgres_test

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// TestIntrospect_ViewFlags verifies the IsView / IsInsertable / IsUpdatable
// flags populated on introspection.Table for the three relation kinds in
// testdata/pg_schema.sql:
//
//   - public.news            — base table     (IsView=false, both true)
//   - public.published_news  — simple view    (IsView=true,  both true)
//   - public.content_feed    — UNION ALL view (IsView=true,  both false)
//
// The content_feed case is the regression we care about: Postgres reports
// is_insertable_into = NO and is_updatable = NO for it, and the schema
// generator must refuse to emit mutation fields for admin against such a
// relation.
func TestIntrospect_ViewFlags(t *testing.T) {
	t.Parallel()

	ddl := `
CREATE TABLE public.news (
    id uuid PRIMARY KEY,
    title text NOT NULL,
    content text NOT NULL,
    is_public boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.kb_entries (
    id uuid PRIMARY KEY,
    title text NOT NULL,
    content text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE VIEW public.published_news AS
    SELECT id, title, content, created_at FROM public.news WHERE is_public = true;

CREATE VIEW public.content_feed AS
    SELECT id, 'news'::text AS source, title, content, created_at FROM public.news
    UNION ALL
    SELECT id, 'kb_entry'::text AS source, title, content, created_at FROM public.kb_entries;
`

	pool := testdb.NewPostgres(t, ddl)

	pgPool, err := postgres.Open(t.Context(), pool.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatalf("open pool: %v", err)
	}

	pg := postgres.NewClient(pgPool)
	t.Cleanup(func() { pg.Close() })

	objs, err := pg.Introspect(t.Context(), &metadata.DatabaseMetadata{Name: "default"})
	if err != nil {
		t.Fatalf("introspect: %v", err)
	}

	cases := []struct {
		name             string
		wantIsView       bool
		wantIsInsertable bool
		wantIsUpdatable  bool
	}{
		{name: "news", wantIsView: false, wantIsInsertable: true, wantIsUpdatable: true},
		{name: "published_news", wantIsView: true, wantIsInsertable: true, wantIsUpdatable: true},
		{name: "content_feed", wantIsView: true, wantIsInsertable: false, wantIsUpdatable: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			tbl, ok := objs.GetTable("public", tc.name)
			if !ok {
				t.Fatalf("introspection did not return %q", tc.name)
			}

			if tbl.IsView != tc.wantIsView {
				t.Errorf("IsView = %v, want %v", tbl.IsView, tc.wantIsView)
			}

			if tbl.IsInsertable != tc.wantIsInsertable {
				t.Errorf("IsInsertable = %v, want %v", tbl.IsInsertable, tc.wantIsInsertable)
			}

			if tbl.IsUpdatable != tc.wantIsUpdatable {
				t.Errorf("IsUpdatable = %v, want %v", tbl.IsUpdatable, tc.wantIsUpdatable)
			}
		})
	}
}
