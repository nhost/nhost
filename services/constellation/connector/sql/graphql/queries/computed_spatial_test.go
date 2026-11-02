package queries_test

import (
	"reflect"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/schema"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/metadata"
)

//nolint:cyclop // Both spatial types share one isolated PostGIS catalog and role fixture.
func TestComputedSpatialArgumentAndReturn(t *testing.T) {
	t.Parallel()
	//nolint:dogsled // The fixture supplies the isolated database and metadata for re-introspection.
	_, pool, _, md, _ := computedTestFixture(t)

	_, err := pool.Exec(t.Context(), `CREATE EXTENSION IF NOT EXISTS postgis;
CREATE FUNCTION cf_select.item_spatial(item cf_select.items, location geometry) RETURNS geometry
LANGUAGE sql STABLE AS $$ SELECT location $$;
CREATE FUNCTION cf_select.item_geography(item cf_select.items, location geography) RETURNS geography
LANGUAGE sql STABLE AS $$ SELECT location $$;`)
	if err != nil {
		t.Fatal(err)
	}

	for _, name := range []string{"item_spatial", "item_geography"} {
		md.Tables[0].ComputedFields = append(md.Tables[0].ComputedFields, metadata.ComputedField{
			Name: name, Definition: metadata.ComputedFieldDefinition{
				Function: metadata.FunctionSource{Schema: "cf_select", Name: name},
			},
		})
	}

	for i := range md.Tables[0].SelectPermissions {
		if md.Tables[0].SelectPermissions[i].Role == "cf_reader" {
			md.Tables[0].SelectPermissions[i].Permission.ComputedFields = append(
				md.Tables[0].SelectPermissions[i].Permission.ComputedFields,
				"item_spatial",
				"item_geography",
			)
		}
	}

	pgPool, err := postgres.Open(t.Context(), pool.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatal(err)
	}

	client := postgres.NewClient(pgPool)
	t.Cleanup(client.Close)

	objects, err := client.Introspect(t.Context(), md)
	if err != nil {
		t.Fatal(err)
	}

	caps := schema.NewCapabilities(schema.KindPostgres, dialect.NewPostgresDialect())
	caps.SupportsComputedScalarSelection = true

	roots, _, err := queries.BuildRoots(objects, md, dialect.NewPostgresDialect(), caps)
	if err != nil {
		t.Fatal(err)
	}

	generated, err := schema.GenerateForRole(objects, "cf_reader", md, caps)
	if err != nil {
		t.Fatal(err)
	}

	for _, tc := range []struct{ name, spatialType, cast string }{
		{"item_spatial", "geometry", "ST_GeomFromGeoJSON($"},
		{"item_geography", "geography", "ST_GeomFromGeoJSON($"},
	} {
		t.Run(tc.spatialType, func(t *testing.T) {
			t.Parallel()

			field := generated.ToAST().Definitions.ForName(
				"cf_select_items",
			).Fields.ForName(
				tc.name,
			)
			if field == nil || field.Type.String() != tc.spatialType ||
				field.Arguments.ForName("args") == nil {
				t.Fatalf("spatial computed field SDL: %+v", field)
			}

			op := computedOperation(
				t,
				roots,
				`query { cf_select_items(where:{id:{_eq:1}}) { `+tc.name+`(args:{location:{type:"Point",coordinates:[1,2]}}) } }`,
				nil,
			)
			if !strings.Contains(op.SQL, tc.cast) || !strings.Contains(op.SQL, "ST_AsGeoJSON(") ||
				(tc.spatialType == "geography" && !strings.Contains(op.SQL, "::geography")) ||
				strings.Contains(op.SQL, `"location" := $`) {
				t.Fatalf("missing spatial input/output coercion: %s", op.SQL)
			}

			want := []any{map[string]any{tc.name: map[string]any{
				"type": "Point", "coordinates": []any{float64(1), float64(2)},
				"crs": map[string]any{"type": "name", "properties": map[string]any{
					"name": "urn:ogc:def:crs:EPSG::4326",
				}},
			}}}
			if got := computedResult(t, pool, op); !reflect.DeepEqual(got, want) {
				t.Fatalf("spatial computed result = %#v, want %#v", got, want)
			}
		})
	}
}
