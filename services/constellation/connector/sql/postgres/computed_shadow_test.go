package postgres_test

import (
	"net/url"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

func TestComputedBareReferenceIgnoresSearchPathShadow(t *testing.T) {
	t.Parallel()
	pool := testdb.NewPostgres(t, `
		CREATE TABLE public.items (id integer PRIMARY KEY);
		CREATE FUNCTION public.item_label(item public.items) RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'public'::text $$;
		CREATE SCHEMA cf_shadow;
		CREATE TABLE cf_shadow.items (id integer PRIMARY KEY);
		CREATE FUNCTION cf_shadow.item_label(item cf_shadow.items) RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'shadow'::text $$;
	`, "")

	address, err := url.Parse(pool.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatalf("parse fixture connection: %v", err)
	}

	params := address.Query()
	params.Set("search_path", "cf_shadow,public")
	address.RawQuery = params.Encode()

	shadowed, err := postgres.Open(t.Context(), address.String())
	if err != nil {
		t.Fatalf("open shadowed connection: %v", err)
	}

	client := postgres.NewClient(shadowed)
	t.Cleanup(client.Close)

	md, err := metadata.FromHasuraJSON(
		[]byte(
			`{"version":3,"sources":[{"name":"cf","kind":"postgres","tables":[{"table":{"schema":"public","name":"items"},"computed_fields":[{"name":"label","definition":{"function":"item_label"}}]}]}]}`,
		),
	)
	if err != nil {
		t.Fatalf("decode fixture: %v", err)
	}

	objects, err := client.Introspect(t.Context(), &md.Databases[0])
	if err != nil {
		t.Fatalf("introspect shadowed function: %v", err)
	}

	lookup, found := objects.GetComputedFunction("public", "items", "label")
	if !found || lookup.Function == nil || lookup.Function.Schema != "public" ||
		lookup.Function.Arguments[lookup.Function.RowArgument].Type.Schema != "public" {
		t.Fatalf("search_path shadow changed function identity: %+v", lookup)
	}
}
