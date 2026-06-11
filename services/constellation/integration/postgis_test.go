package integration_test

import "testing"

func TestPostGISQueries(t *testing.T) { //nolint:paralleltest
	cases := []TestCase{
		{
			name: "admin selects spatial columns",
			query: query{
				Query: `query {
					postgis_locations(order_by: {name: asc}) {
						id
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
			name: "public can select spatial columns",
			query: query{
				Query: `query {
					postgis_locations(order_by: {id: asc}) {
						name
						geom
						nullable_geom
					}
				}`,
				Role: "public",
			},
		},
		{
			name: "select by primary key returns spatial object",
			query: query{
				Query: `query {
					postgis_locations_by_pk(id: "11111111-1111-4111-8111-111111111111") {
						name
						geom
						geog
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "spatial equality with variable",
			query: query{
				Query: `query($point: geometry!) {
					postgis_locations(where: {geom: {_eq: $point}}) {
						name
						geom
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
			name: "inline spatial neq filter",
			query: query{
				Query: `query {
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
			name: "geography equality with variable",
			query: query{
				Query: `query($point: geography!) {
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
			name: "spatial greater than or equal filter",
			query: query{
				Query: `query($point: geometry!) {
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
			name: "spatial predicates match stable fixtures",
			query: query{
				Query: `query($point: geometry!, $geog: geography!) {
					postgis_locations(
						where: {
							_and: [
								{geom: {_st_d_within: {from: $point, distance: 0.001}}}
								{geog: {_st_intersects: $geog}}
								{area: {_st_contains: $point}}
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
				},
				Role: "admin",
			},
		},
		{
			name: "spatial contains within and cast predicates",
			query: query{
				Query: `query($point: geometry!, $geog: geography!, $poly: geometry!) {
					postgis_locations(
						where: {
							_and: [
								{geom: {_st_within: $poly}}
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
			name: "spatial in empty matches none",
			query: query{
				Query: `query {
					postgis_locations(where: {geom: {_in: []}}, order_by: {name: asc}) {
						name
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "spatial nin empty matches all",
			query: query{
				Query: `query {
					postgis_locations(where: {geom: {_nin: []}}, order_by: {name: asc}) {
						name
					}
				}`,
				Role: "admin",
			},
		},
		{
			name: "spatial order by",
			query: query{
				Query: `query {
					postgis_locations(order_by: {geom: asc}) {
						name
						geom
					}
				}`,
				Role: "admin",
			},
		},
	}

	RunGraphQLTests(t, cases, TestConfig{IsMutation: false})
}

func TestPostGISMutations(t *testing.T) { //nolint:paralleltest
	cases := []TestCase{
		{
			name: "user inserts spatial columns",
			query: query{
				Query: `mutation($geom: geometry!, $geog: geography!, $area: geometry!) {
					insert_postgis_locations_one(object: {
						name: "phase1-insert"
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
			name: "user updates spatial columns returning collection",
			query: query{
				Query: `mutation($geom: geometry!, $nullable: geometry!) {
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

	RunGraphQLTests(t, cases, TestConfig{IsMutation: true, ReinitBetweenQueries: true})
}
