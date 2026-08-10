package where

import (
	"errors"
	"reflect"
	"strings"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
)

const spatialPointParam = `{"coordinates":[-73.98513,40.758896],"type":"Point"}`

type spatialParseTable struct {
	d       dialect.Dialect
	columns map[string]*core.Column
}

func (s *spatialParseTable) Dialect() dialect.Dialect { return s.d }
func (s *spatialParseTable) SchemaName() string       { return "" }
func (s *spatialParseTable) TableFromClause() string  { return "" }
func (s *spatialParseTable) ColumnFromGraphqlName(name string) *core.Column {
	return s.columns[name]
}

func (s *spatialParseTable) RelationshipFromGraphqlName(string) Relationship {
	return nil
}
func (s *spatialParseTable) TableBySchemaName(_, _ string) Table { return nil }
func (s *spatialParseTable) HasRowLevelPermissions(string) bool  { return false }

func (s *spatialParseTable) ParseFieldComparison(
	column *core.Column, value *ast.Value, variables map[string]any,
) (Statement, error) {
	return ParseFieldComparison(s, column, value, variables)
}

func (s *spatialParseTable) WriteRowLevelPermissions(
	_ *strings.Builder,
	params []any,
	paramIndex int,
	_ string,
	_ map[string]any,
	_ string,
) ([]any, int, error) {
	return params, paramIndex, nil
}

func TestSpatialOperatorParsersCoverHasuraPostGISSurface(t *testing.T) {
	t.Parallel()

	d := dialect.NewPostgresDialect()
	tests := []struct {
		name       string
		column     *core.Column
		operator   string
		value      *ast.Value
		wantSQL    string
		wantParams []any
	}{
		{
			name:       "geography _st_d_within",
			column:     newColumn("geog", "geography"),
			operator:   "_st_d_within",
			value:      dWithinValue(pointValue(), floatValue("100.5"), nil),
			wantSQL:    `ST_DWithin("t"."geog", ST_GeomFromGeoJSON($1)::geography, $2, $3)`,
			wantParams: []any{spatialPointParam, 100.5, true},
		},
		{
			name:       "geography _st_intersects",
			column:     newColumn("geog", "geography"),
			operator:   "_st_intersects",
			value:      pointValue(),
			wantSQL:    `ST_Intersects("t"."geog", ST_GeomFromGeoJSON($1)::geography)`,
			wantParams: []any{spatialPointParam},
		},
		{
			name:       "geometry _st_3d_d_within",
			column:     newColumn("geom", "geometry"),
			operator:   "_st_3d_d_within",
			value:      dWithinValue(pointValue(), floatValue("100.5"), nil),
			wantSQL:    `ST_3DDWithin("t"."geom", ST_GeomFromGeoJSON($1), $2)`,
			wantParams: []any{spatialPointParam, 100.5},
		},
		{
			name:       "geometry _st_3d_intersects",
			column:     newColumn("geom", "geometry"),
			operator:   "_st_3d_intersects",
			value:      pointValue(),
			wantSQL:    `ST_3DIntersects("t"."geom", ST_GeomFromGeoJSON($1))`,
			wantParams: []any{spatialPointParam},
		},
		{
			name:       "geometry _st_contains",
			column:     newColumn("geom", "geometry"),
			operator:   "_st_contains",
			value:      pointValue(),
			wantSQL:    `ST_Contains("t"."geom", ST_GeomFromGeoJSON($1))`,
			wantParams: []any{spatialPointParam},
		},
		{
			name:       "geometry _st_crosses",
			column:     newColumn("geom", "geometry"),
			operator:   "_st_crosses",
			value:      pointValue(),
			wantSQL:    `ST_Crosses("t"."geom", ST_GeomFromGeoJSON($1))`,
			wantParams: []any{spatialPointParam},
		},
		{
			name:       "geometry _st_d_within",
			column:     newColumn("geom", "geometry"),
			operator:   "_st_d_within",
			value:      dWithinValue(pointValue(), floatValue("100.5"), nil),
			wantSQL:    `ST_DWithin("t"."geom", ST_GeomFromGeoJSON($1), $2)`,
			wantParams: []any{spatialPointParam, 100.5},
		},
		{
			name:       "geometry _st_equals",
			column:     newColumn("geom", "geometry"),
			operator:   "_st_equals",
			value:      pointValue(),
			wantSQL:    `ST_Equals("t"."geom", ST_GeomFromGeoJSON($1))`,
			wantParams: []any{spatialPointParam},
		},
		{
			name:       "geometry _st_intersects",
			column:     newColumn("geom", "geometry"),
			operator:   "_st_intersects",
			value:      pointValue(),
			wantSQL:    `ST_Intersects("t"."geom", ST_GeomFromGeoJSON($1))`,
			wantParams: []any{spatialPointParam},
		},
		{
			name:       "geometry _st_overlaps",
			column:     newColumn("geom", "geometry"),
			operator:   "_st_overlaps",
			value:      pointValue(),
			wantSQL:    `ST_Overlaps("t"."geom", ST_GeomFromGeoJSON($1))`,
			wantParams: []any{spatialPointParam},
		},
		{
			name:       "geometry _st_touches",
			column:     newColumn("geom", "geometry"),
			operator:   "_st_touches",
			value:      pointValue(),
			wantSQL:    `ST_Touches("t"."geom", ST_GeomFromGeoJSON($1))`,
			wantParams: []any{spatialPointParam},
		},
		{
			name:       "geometry _st_within",
			column:     newColumn("geom", "geometry"),
			operator:   "_st_within",
			value:      pointValue(),
			wantSQL:    `ST_Within("t"."geom", ST_GeomFromGeoJSON($1))`,
			wantParams: []any{spatialPointParam},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			sql, params, next := parseAndWriteSpatialComparison(
				t,
				d,
				tt.column,
				fieldComparisonValue(tt.operator, tt.value),
				nil,
			)

			if sql != tt.wantSQL {
				t.Fatalf("SQL = %q, want %q", sql, tt.wantSQL)
			}

			if !reflect.DeepEqual(params, tt.wantParams) {
				t.Fatalf("params = %#v, want %#v", params, tt.wantParams)
			}

			if next != len(tt.wantParams)+1 {
				t.Fatalf("next param index = %d, want %d", next, len(tt.wantParams)+1)
			}
		})
	}
}

func TestSpatialNotEqualsUsesEqualsNegationForPostGISCompatibility(t *testing.T) {
	t.Parallel()

	d := dialect.NewPostgresDialect()
	sql, params, next := parseAndWriteSpatialComparison(
		t,
		d,
		newColumn("geom", "geometry"),
		fieldComparisonValue("_neq", pointValue()),
		nil,
	)

	wantSQL := `NOT ("t"."geom" = ST_GeomFromGeoJSON($1))`
	if sql != wantSQL {
		t.Fatalf("SQL = %q, want %q", sql, wantSQL)
	}

	wantParams := []any{spatialPointParam}
	if !reflect.DeepEqual(params, wantParams) {
		t.Fatalf("params = %#v, want %#v", params, wantParams)
	}

	if next != 2 {
		t.Fatalf("next param index = %d, want 2", next)
	}
}

func TestSpatialCastParsesExpressionAwareComparisons(t *testing.T) {
	t.Parallel()

	d := dialect.NewPostgresDialect()
	useSpheroid := false
	value := fieldComparisonValue(
		"_cast",
		objectValue(
			child("geography", fieldComparisonValue(
				"_st_d_within",
				dWithinValue(variableValue("point"), intValue("1000"), &useSpheroid),
			)),
		),
	)

	sql, params, _ := parseAndWriteSpatialComparison(
		t,
		d,
		newColumn("geom", "geometry"),
		value,
		map[string]any{
			"point": map[string]any{
				"type":        "Point",
				"coordinates": []any{-73.98513, 40.758896},
			},
		},
	)

	wantSQL := `ST_DWithin(("t"."geom")::geography, ST_GeomFromGeoJSON($1)::geography, $2, $3)`
	if sql != wantSQL {
		t.Fatalf("SQL = %q, want %q", sql, wantSQL)
	}

	wantParams := []any{spatialPointParam, int64(1000), false}
	if !reflect.DeepEqual(params, wantParams) {
		t.Fatalf("params = %#v, want %#v", params, wantParams)
	}
}

func TestSpatialCastArrayComparisonUsesCastExpression(t *testing.T) {
	t.Parallel()

	d := dialect.NewPostgresDialect()
	value := fieldComparisonValue(
		"_cast",
		objectValue(
			child("geometry", fieldComparisonValue(
				"_in",
				listValue(pointValue()),
			)),
		),
	)

	sql, params, _ := parseAndWriteSpatialComparison(
		t,
		d,
		newColumn("geog", "geography"),
		value,
		nil,
	)

	wantSQL := `("t"."geog")::geometry = ANY(ARRAY[ST_GeomFromGeoJSON($1)]::geometry[])`
	if sql != wantSQL {
		t.Fatalf("SQL = %q, want %q", sql, wantSQL)
	}

	if !reflect.DeepEqual(params, []any{spatialPointParam}) {
		t.Fatalf("params = %#v, want %#v", params, []any{spatialPointParam})
	}
}

func TestSpatialCastEmptyObjectYieldsNoCondition(t *testing.T) {
	t.Parallel()

	d := dialect.NewPostgresDialect()
	column := newColumn("geom", "geometry")
	comparison := fieldComparisonValue(
		"_cast",
		objectValue(child("geography", objectValue())),
	)

	stmt, err := ParseFieldComparison(&spatialParseTable{d: d}, column, comparison, nil)
	if err != nil {
		t.Fatalf("ParseFieldComparison: %v", err)
	}

	if stmt != nil {
		t.Fatalf("empty spatial _cast statement = %#v, want nil", stmt)
	}

	clause, err := Parse(
		&spatialParseTable{d: d, columns: map[string]*core.Column{"geom": column}},
		objectValue(child("geom", comparison)),
		nil,
		"",
		nil,
		0,
		QueryAliases,
	)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}

	sql, params := writeSpatialClause(t, clause)
	if sql != "" {
		t.Fatalf("SQL = %q, want empty", sql)
	}

	if params != nil {
		t.Fatalf("params = %#v, want nil", params)
	}
}

func TestSpatialCastEmptyObjectWithSiblingSkipsNilCondition(t *testing.T) {
	t.Parallel()

	d := dialect.NewPostgresDialect()
	column := newColumn("geom", "geometry")
	comparison := objectValue(
		child("_cast", objectValue(child("geography", objectValue()))),
		child("_is_null", boolValue(false)),
	)

	clause, err := Parse(
		&spatialParseTable{d: d, columns: map[string]*core.Column{"geom": column}},
		objectValue(child("geom", comparison)),
		nil,
		"",
		nil,
		0,
		QueryAliases,
	)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}

	sql, params := writeSpatialClause(t, clause)
	if sql != `"t"."geom" IS NOT NULL` {
		t.Fatalf("SQL = %q, want geom IS NOT NULL", sql)
	}

	if len(params) != 0 {
		t.Fatalf("params = %#v, want none", params)
	}
}

func TestSpatialParsersRejectUnsupportedSurfaces(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		d       dialect.Dialect
		column  *core.Column
		value   *ast.Value
		wantErr error
	}{
		{
			name:    "spatial operator on sqlite",
			d:       dialect.NewSQLiteDialect(),
			column:  newColumn("geom", "geometry"),
			value:   fieldComparisonValue("_st_intersects", pointValue()),
			wantErr: errSpatialUnsupportedByDialect,
		},
		{
			name:    "geometry-only operator on geography",
			d:       dialect.NewPostgresDialect(),
			column:  newColumn("geog", "geography"),
			value:   fieldComparisonValue("_st_contains", pointValue()),
			wantErr: errSpatialOperatorOnWrongType,
		},
		{
			name:    "spatial operator on non-spatial column",
			d:       dialect.NewPostgresDialect(),
			column:  newColumn("data", "jsonb"),
			value:   fieldComparisonValue("_st_intersects", pointValue()),
			wantErr: errSpatialOperatorOnNonSpatialColumn,
		},
		{
			name:    "d within input must be object",
			d:       dialect.NewPostgresDialect(),
			column:  newColumn("geom", "geometry"),
			value:   fieldComparisonValue("_st_d_within", stringValue("point")),
			wantErr: errSpatialDWithinMustBeObject,
		},
		{
			name:   "d within from required",
			d:      dialect.NewPostgresDialect(),
			column: newColumn("geom", "geometry"),
			value: fieldComparisonValue(
				"_st_d_within",
				objectValue(child("distance", floatValue("100"))),
			),
			wantErr: errSpatialDWithinFromRequired,
		},
		{
			name:   "d within distance required",
			d:      dialect.NewPostgresDialect(),
			column: newColumn("geom", "geometry"),
			value: fieldComparisonValue(
				"_st_d_within",
				objectValue(child("from", pointValue())),
			),
			wantErr: errSpatialDWithinDistanceRequired,
		},
		{
			name:   "d within use spheroid must be boolean",
			d:      dialect.NewPostgresDialect(),
			column: newColumn("geog", "geography"),
			value: fieldComparisonValue(
				"_st_d_within",
				objectValue(
					child("from", pointValue()),
					child("distance", floatValue("100")),
					child("use_spheroid", stringValue("yes")),
				),
			),
			wantErr: errSpatialDWithinUseSpheroidMustBeBoolean,
		},
		{
			name:    "spatial cast input must be object",
			d:       dialect.NewPostgresDialect(),
			column:  newColumn("geom", "geometry"),
			value:   fieldComparisonValue("_cast", stringValue("geometry")),
			wantErr: errSpatialCastMustBeObject,
		},
		{
			name:   "spatial cast target rejects unknown scalar",
			d:      dialect.NewPostgresDialect(),
			column: newColumn("geom", "geometry"),
			value: fieldComparisonValue(
				"_cast",
				objectValue(child("String", fieldComparisonValue("_eq", pointValue()))),
			),
			wantErr: errSpatialCastTargetInvalid,
		},
		{
			name:   "spatial cast target rejects same scalar",
			d:      dialect.NewPostgresDialect(),
			column: newColumn("geom", "geometry"),
			value: fieldComparisonValue(
				"_cast",
				objectValue(child("geometry", fieldComparisonValue("_eq", pointValue()))),
			),
			wantErr: errSpatialCastTargetInvalid,
		},
		{
			name:   "spatial cast on non-spatial column preserves unknown cast behavior",
			d:      dialect.NewPostgresDialect(),
			column: newColumn("data", "jsonb"),
			value: fieldComparisonValue(
				"_cast",
				objectValue(child("String", fieldComparisonValue("_eq", stringValue("x")))),
			),
			wantErr: errUnknownWhereOperator,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			_, err := ParseFieldComparison(
				&spatialParseTable{d: tt.d},
				tt.column,
				tt.value,
				nil,
			)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("error = %v, want %v", err, tt.wantErr)
			}
		})
	}
}

func TestSpatialFiltersCollectSourceColumns(t *testing.T) {
	t.Parallel()

	d := dialect.NewPostgresDialect()
	value := fieldComparisonValue(
		"_cast",
		objectValue(
			child("geography", fieldComparisonValue("_st_intersects", pointValue())),
		),
	)

	stmt, err := ParseFieldComparison(
		&spatialParseTable{d: d},
		newColumn("geom", "geometry"),
		value,
		nil,
	)
	if err != nil {
		t.Fatalf("ParseFieldComparison: %v", err)
	}

	if got, want := CollectSourceColumns(stmt), []string{"geom"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("source columns = %v, want %v", got, want)
	}
}

func parseAndWriteSpatialComparison(
	t *testing.T,
	d dialect.Dialect,
	column *core.Column,
	value *ast.Value,
	variables map[string]any,
) (string, []any, int) {
	t.Helper()

	stmt, err := ParseFieldComparison(&spatialParseTable{d: d}, column, value, variables)
	if err != nil {
		t.Fatalf("ParseFieldComparison: %v", err)
	}

	var b strings.Builder

	params, next, err := stmt.WriteCondition(&b, `"t"`, nil, 1)
	if err != nil {
		t.Fatalf("WriteCondition: %v", err)
	}

	return b.String(), params, next
}

func writeSpatialClause(t *testing.T, clause Clause) (string, []any) {
	t.Helper()

	var b strings.Builder

	params, _, err := clause.WriteCondition(&b, `"t"`, nil, 1)
	if err != nil {
		t.Fatalf("Clause.WriteCondition: %v", err)
	}

	return b.String(), params
}

func fieldComparisonValue(operator string, value *ast.Value) *ast.Value {
	return objectValue(child(operator, value))
}

func dWithinValue(from, distance *ast.Value, useSpheroid *bool) *ast.Value {
	children := []*ast.ChildValue{
		child("from", from),
		child("distance", distance),
	}
	if useSpheroid != nil {
		children = append(children, child("use_spheroid", boolValue(*useSpheroid)))
	}

	return objectValue(children...)
}

func pointValue() *ast.Value {
	return objectValue(
		child("type", stringValue("Point")),
		child("coordinates", listValue(floatValue("-73.985130"), floatValue("40.758896"))),
	)
}

func objectValue(children ...*ast.ChildValue) *ast.Value {
	return &ast.Value{Kind: ast.ObjectValue, Children: children}
}

func listValue(values ...*ast.Value) *ast.Value {
	children := make([]*ast.ChildValue, 0, len(values))
	for _, value := range values {
		children = append(children, &ast.ChildValue{Value: value})
	}

	return &ast.Value{Kind: ast.ListValue, Children: children}
}

func child(name string, value *ast.Value) *ast.ChildValue {
	return &ast.ChildValue{Name: name, Value: value}
}

func stringValue(value string) *ast.Value {
	return &ast.Value{Kind: ast.StringValue, Raw: value}
}

func intValue(value string) *ast.Value {
	return &ast.Value{Kind: ast.IntValue, Raw: value}
}

func floatValue(value string) *ast.Value {
	return &ast.Value{Kind: ast.FloatValue, Raw: value}
}

func boolValue(value bool) *ast.Value {
	if value {
		return &ast.Value{Kind: ast.BooleanValue, Raw: "true"}
	}

	return &ast.Value{Kind: ast.BooleanValue, Raw: "false"}
}

func variableValue(name string) *ast.Value {
	return &ast.Value{Kind: ast.Variable, Raw: name}
}
