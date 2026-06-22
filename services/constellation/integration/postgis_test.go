package integration_test

import (
	json "encoding/json/v2"
	"testing"
	"time"

	"github.com/nhost/nhost/services/constellation/integration/subtest"
)

func geoJSONPoint(coordinates ...float64) map[string]any {
	coords := make([]any, len(coordinates))
	for i, coordinate := range coordinates {
		coords[i] = coordinate
	}

	return map[string]any{
		"type":        "Point",
		"coordinates": coords,
	}
}

func geoJSONLineString(points ...[]float64) map[string]any {
	return map[string]any{
		"type":        "LineString",
		"coordinates": geoJSONPositions(points),
	}
}

func geoJSONPolygon(ring ...[]float64) map[string]any {
	return map[string]any{
		"type":        "Polygon",
		"coordinates": []any{geoJSONPositions(ring)},
	}
}

func geoJSONPositions(points [][]float64) []any {
	positions := make([]any, len(points))
	for i, point := range points {
		position := make([]any, len(point))
		for j, coordinate := range point {
			position[j] = coordinate
		}

		positions[i] = position
	}

	return positions
}

func expectPostGISLocationRows(
	t *testing.T,
	msg subtest.Message,
	id string,
	field string,
	wantNames []string,
) {
	t.Helper()

	if msg.ID != id {
		t.Fatalf("expected message id %s, got %s", id, msg.ID)
	}

	if msg.Type != subtest.Next {
		t.Fatalf("expected next message, got type=%s payload=%s", msg.Type, string(msg.Payload))
	}

	var payload struct {
		Data map[string][]struct {
			Name string         `json:"name"`
			Geom map[string]any `json:"geom"`
		} `json:"data"`
	}
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		t.Fatalf("unmarshal subscription payload: %v", err)
	}

	rows, ok := payload.Data[field]
	if !ok {
		t.Fatalf("payload missing data.%s: %s", field, string(msg.Payload))
	}

	if len(rows) != len(wantNames) {
		t.Fatalf(
			"expected %d %s rows, got %d: %s",
			len(wantNames),
			field,
			len(rows),
			string(msg.Payload),
		)
	}

	for i, row := range rows {
		if row.Name != wantNames[i] {
			t.Fatalf("row %d: expected name %q, got %q", i, wantNames[i], row.Name)
		}

		expectGeoJSONPoint(t, row.Name, row.Geom)
	}
}

func expectGeoJSONPoint(t *testing.T, rowName string, geom map[string]any) {
	t.Helper()

	if geom == nil {
		t.Fatalf("row %q: geom is missing or null", rowName)
	}

	geomType, ok := geom["type"].(string)
	if !ok || geomType != "Point" {
		t.Fatalf("row %q: expected GeoJSON Point type, got %#v", rowName, geom["type"])
	}

	coordinates, ok := geom["coordinates"].([]any)
	if !ok || len(coordinates) == 0 {
		t.Fatalf(
			"row %q: expected non-empty GeoJSON coordinates array, got %#v",
			rowName,
			geom["coordinates"],
		)
	}
}

func TestPostGISSubscription(t *testing.T) { //nolint:paralleltest
	ReinitializeTestData(t)

	c, err := subtest.NewClient(t, wsURL)
	if err != nil {
		t.Fatal(err)
	}

	c.Send(subtest.Message{
		Type:    subtest.ConnectionInit,
		Payload: initWithAdmin(),
	}).Expect(func(msg subtest.Message) {
		if msg.Type != subtest.ConnectionAck {
			t.Fatalf("expected connection_ack, got %s", msg.Type)
		}
	}).Send(subtest.Message{
		ID:   "1",
		Type: subtest.Subscribe,
		Payload: subscribePayload(`subscription {
			postgis_locations(order_by: {name: asc}) {
				name
				geom
			}
		}`),
	}).Expect(func(msg subtest.Message) {
		expectPostGISLocationRows(
			t,
			msg,
			"1",
			"postgis_locations",
			[]string{"inside-square", "outside-square", "west-square"},
		)
	}).Close()
}

func TestPostGISSubscriptionStream(t *testing.T) { //nolint:paralleltest
	ReinitializeTestData(t)

	c, err := subtest.NewClient(t, wsURL, subtest.WithTimeout(15*time.Second))
	if err != nil {
		t.Fatal(err)
	}

	c.Send(subtest.Message{
		Type:    subtest.ConnectionInit,
		Payload: initWithAdmin(),
	}).Expect(func(msg subtest.Message) {
		if msg.Type != subtest.ConnectionAck {
			t.Fatalf("expected connection_ack, got %s", msg.Type)
		}
	}).Send(subtest.Message{
		ID:   "1",
		Type: subtest.Subscribe,
		Payload: subscribePayload(`subscription {
			postgis_locations_stream(
				cursor: { initial_value: { name: "a" }, ordering: ASC }
				batch_size: 2
			) {
				name
				geom
			}
		}`),
	}).Expect(func(msg subtest.Message) {
		expectPostGISLocationRows(
			t,
			msg,
			"1",
			"postgis_locations_stream",
			[]string{"inside-square", "outside-square"},
		)
	}).Expect(func(msg subtest.Message) {
		expectPostGISLocationRows(
			t,
			msg,
			"1",
			"postgis_locations_stream",
			[]string{"west-square"},
		)
	}).Close()
}

func TestPostGISQueries(t *testing.T) { //nolint:paralleltest,maintidx
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
			name: "spatial limited role selects permitted spatial column",
			query: query{
				Query: `query {
					postgis_locations(order_by: {name: asc}) {
						id
						name
						geog
					}
				}`,
				Role: "spatial_limited",
			},
		},
		{
			name: "user counts spatial table aggregate",
			query: query{
				Query: `query {
					postgis_locations_aggregate {
						aggregate {
							count
							geom_count: count(columns: [geom])
						}
					}
				}`,
				Role: "user",
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
					"point": geoJSONPoint(-73.985130, 40.758896),
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
					"point": geoJSONPoint(-73.985130, 40.758896),
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
					"point": geoJSONPoint(-73.985130, 40.758896),
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
					"point": geoJSONPoint(-73.985130, 40.758896),
					"geog":  geoJSONPoint(-73.985130, 40.758896),
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
					"point": geoJSONPoint(-73.985130, 40.758896),
					"geog":  geoJSONPoint(-73.985130, 40.758896),
					"poly": geoJSONPolygon(
						[]float64{-74.000000, 40.750000},
						[]float64{-73.970000, 40.750000},
						[]float64{-73.970000, 40.780000},
						[]float64{-74.000000, 40.780000},
						[]float64{-74.000000, 40.750000},
					),
				},
				Role: "admin",
			},
		},
		{
			name: "spatial overlaps predicate",
			query: query{
				Query: `query($poly: geometry!) {
					postgis_locations(
						where: {area: {_st_overlaps: $poly}}
						order_by: {name: asc}
					) {
						name
					}
				}`,
				Variables: map[string]any{
					"poly": geoJSONPolygon(
						[]float64{-73.985000, 40.760000},
						[]float64{-73.955000, 40.760000},
						[]float64{-73.955000, 40.790000},
						[]float64{-73.985000, 40.790000},
						[]float64{-73.985000, 40.760000},
					),
				},
				Role: "admin",
			},
		},
		{
			name: "spatial crosses predicate",
			query: query{
				Query: `query($line: geometry!) {
					postgis_locations(
						where: {geom: {_st_crosses: $line}}
						order_by: {name: asc}
					) {
						name
					}
				}`,
				Variables: map[string]any{
					"line": geoJSONLineString(
						[]float64{-74.100000, 40.758896},
						[]float64{-73.900000, 40.758896},
					),
				},
				Role: "admin",
			},
		},
		{
			name: "spatial touches predicate",
			query: query{
				Query: `query($poly: geometry!) {
					postgis_locations(
						where: {area: {_st_touches: $poly}}
						order_by: {name: asc}
					) {
						name
					}
				}`,
				Variables: map[string]any{
					"poly": geoJSONPolygon(
						[]float64{-73.970000, 40.750000},
						[]float64{-73.950000, 40.750000},
						[]float64{-73.950000, 40.780000},
						[]float64{-73.970000, 40.780000},
						[]float64{-73.970000, 40.750000},
					),
				},
				Role: "admin",
			},
		},
		{
			name: "spatial 3d intersects predicate",
			query: query{
				Query: `query($point: geometry!) {
					postgis_locations(
						where: {geom: {_st_3d_intersects: $point}}
						order_by: {name: asc}
					) {
						name
					}
				}`,
				Variables: map[string]any{
					"point": geoJSONPoint(-73.985130, 40.758896, 0.0),
				},
				Role: "admin",
			},
		},
		{
			name: "spatial 3d d within predicate",
			query: query{
				Query: `query($point: geometry!) {
					postgis_locations(
						where: {geom: {_st_3d_d_within: {from: $point, distance: 1.0}}}
						order_by: {name: asc}
					) {
						name
					}
				}`,
				Variables: map[string]any{
					"point": geoJSONPoint(-73.985130, 40.758896, 0.0),
				},
				Role: "admin",
			},
		},
		{
			name: "direct geography d within predicate",
			query: query{
				Query: `query($geog: geography!) {
					postgis_locations(
						where: {geog: {_st_d_within: {from: $geog, distance: 20.0, use_spheroid: false}}}
						order_by: {name: asc}
					) {
						name
					}
				}`,
				Variables: map[string]any{
					"geog": geoJSONPoint(-73.985130, 40.758896),
				},
				Role: "admin",
			},
		},
		{
			name: "geography d within uses spheroid",
			query: query{
				Query: `query($geog: geography!) {
					postgis_locations(
						where: {geog: {_st_d_within: {from: $geog, distance: 20.0, use_spheroid: true}}}
						order_by: {name: asc}
					) {
						name
					}
				}`,
				Variables: map[string]any{
					"geog": geoJSONPoint(-73.985130, 40.758896),
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
		{
			name: "user deletes spatial row returning collection",
			query: query{
				Query: `mutation {
					delete_postgis_locations(
						where: {name: {_eq: "inside-square"}}
					) {
						affected_rows
						returning {
							name
							geom
							geog
							nullable_geom
						}
					}
				}`,
				Role: "user",
			},
		},
	}

	RunGraphQLTests(t, cases, TestConfig{IsMutation: true, ReinitBetweenQueries: true})
}
