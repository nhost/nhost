package queries_test

import "testing"

func TestBuildSelectionSQL_PostGIS(t *testing.T) { //nolint:paralleltest
	cases := []buildQueryTestCase{
		{
			name: "spatial selection wraps output",
			query: query{
				Query: `
					query {
						postgis_locations(order_by: {name: asc}) {
							name
							geom
							geog
							area
							nullable_geom
						}
					}`,
				Role: "admin",
			},
		},
		{
			name: "inline geojson and spatial neq filter",
			query: query{
				Query: `
					query {
						postgis_locations(
							where: {
								_and: [
									{geom: {_neq: {type: "Point", coordinates: [-73.940000, 40.800000]}}},
									{nullable_geom: {_is_null: false}}
								]
							}
							order_by: {name: asc}
						) {
							name
							geom
						}
					}`,
				Role: "admin",
			},
		},
		{
			name: "geography variable filter",
			query: query{
				Query: `
					query($point: geography!) {
						postgis_locations(where: {geog: {_eq: $point}}) {
							name
							geog
						}
					}`,
				Variables: map[string]any{
					"point": map[string]any{
						"type":        "Point",
						"coordinates": []any{-73.985130, 40.758896},
					},
				},
				Role: "admin",
			},
		},
		{
			name: "spatial gte comparison",
			query: query{
				Query: `
					query($point: geometry!) {
						postgis_locations(
							where: {geom: {_gte: $point}}
							order_by: {name: asc}
						) {
							name
						}
					}`,
				Variables: map[string]any{
					"point": map[string]any{
						"type":        "Point",
						"coordinates": []any{-73.985130, 40.758896},
					},
				},
				Role: "admin",
			},
		},
		{
			name: "spatial dwithin contains and equals predicates",
			query: query{
				Query: `
					query($point: geometry!, $geog: geography!, $degrees: Float!, $meters: Float!) {
						postgis_locations(
							where: {
								_and: [
									{geom: {_st_d_within: {from: $point, distance: $degrees}}}
									{geog: {_st_d_within: {from: $geog, distance: $meters, use_spheroid: false}}}
									{area: {_st_contains: $point}}
									{geom: {_st_intersects: $point}}
									{geom: {_st_equals: $point}}
								]
							}
							order_by: {name: asc}
						) {
							name
						}
					}`,
				Variables: map[string]any{
					"point": map[string]any{
						"type":        "Point",
						"coordinates": []any{-73.985130, 40.758896},
					},
					"geog": map[string]any{
						"type":        "Point",
						"coordinates": []any{-73.985130, 40.758896},
					},
					"degrees": 0.001,
					"meters":  20,
				},
				Role: "admin",
			},
		},
		{
			name: "spatial cast predicates",
			query: query{
				Query: `
					query($point: geometry!, $geog: geography!) {
						postgis_locations(
							where: {
								_and: [
									{geom: {_cast: {geography: {_st_d_within: {from: $geog, distance: 20, use_spheroid: false}}}}}
									{geog: {_cast: {geometry: {_st_equals: $point}}}}
								]
							}
							order_by: {name: asc}
						) {
							name
						}
					}`,
				Variables: map[string]any{
					"point": map[string]any{
						"type":        "Point",
						"coordinates": []any{-73.985130, 40.758896},
					},
					"geog": map[string]any{
						"type":        "Point",
						"coordinates": []any{-73.985130, 40.758896},
					},
				},
				Role: "admin",
			},
		},
		{
			name: "spatial geometry operator family",
			query: query{
				Query: `
					query($point: geometry!, $line: geometry!, $poly: geometry!) {
						postgis_locations(
							where: {
								_or: [
									{geom: {_st_3d_d_within: {from: $point, distance: 1}}}
									{geom: {_st_3d_intersects: $point}}
									{geom: {_st_crosses: $line}}
									{area: {_st_overlaps: $poly}}
									{area: {_st_touches: $poly}}
									{geom: {_st_within: $poly}}
								]
							}
							order_by: {name: asc}
						) {
							name
						}
					}`,
				Variables: map[string]any{
					"point": map[string]any{
						"type":        "Point",
						"coordinates": []any{-73.985130, 40.758896},
					},
					"line": map[string]any{
						"type": "LineString",
						"coordinates": []any{
							[]any{-74.100000, 40.758896},
							[]any{-73.900000, 40.758896},
						},
					},
					"poly": map[string]any{
						"type": "Polygon",
						"coordinates": []any{[]any{
							[]any{-74.000000, 40.750000},
							[]any{-73.970000, 40.750000},
							[]any{-73.970000, 40.780000},
							[]any{-74.000000, 40.780000},
							[]any{-74.000000, 40.750000},
						}},
					},
				},
				Role: "admin",
			},
		},
		{
			name: "spatial order by",
			query: query{
				Query: `
					query {
						postgis_locations(order_by: {geom: asc}) {
							name
							geom
						}
					}`,
				Role: "admin",
			},
		},
	}

	testBuildQuery(t, cases, false)
}

func TestBuildMutationSQL_PostGIS(t *testing.T) { //nolint:paralleltest
	cases := []buildQueryTestCase{
		{
			name: "insert spatial columns",
			query: query{
				Query: `
					mutation($geom: geometry!, $geog: geography!, $area: geometry!) {
						insert_postgis_locations_one(object: {
							name: "query-builder-insert"
							geom: $geom
							geog: $geog
							area: $area
							nullable_geom: null
						}) {
							name
							geom
							geog
							nullable_geom
						}
					}`,
				Variables: map[string]any{
					"geom": map[string]any{
						"type":        "Point",
						"coordinates": []any{-73.990000, 40.770000},
					},
					"geog": map[string]any{
						"type":        "Point",
						"coordinates": []any{-73.990000, 40.770000},
					},
					"area": map[string]any{
						"type": "Polygon",
						"coordinates": []any{[]any{
							[]any{-74.000000, 40.760000},
							[]any{-73.980000, 40.760000},
							[]any{-73.980000, 40.780000},
							[]any{-74.000000, 40.780000},
							[]any{-74.000000, 40.760000},
						}},
					},
				},
				Role: "user",
			},
		},
		{
			name: "update spatial columns",
			query: query{
				Query: `
					mutation($geom: geometry!, $nullable: geometry!) {
						update_postgis_locations(
							where: {name: {_eq: "inside-square"}}
							_set: {geom: $geom, nullable_geom: $nullable}
						) {
							affected_rows
							returning {
								name
								geom
								nullable_geom
							}
						}
					}`,
				Variables: map[string]any{
					"geom": map[string]any{
						"type":        "Point",
						"coordinates": []any{-73.981000, 40.761000},
					},
					"nullable": map[string]any{
						"type":        "Point",
						"coordinates": []any{-73.982000, 40.762000},
					},
				},
				Role: "user",
			},
		},
	}

	testBuildQuery(t, cases, false)
}
