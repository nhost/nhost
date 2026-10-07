package integration_test

import (
	"context"
	json "encoding/json/v2"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
)

var (
	errReferenceURL = errors.New(
		"GraphQL URL must end in /v1/graphql",
	)
	errReferenceStatus = errors.New(
		"version endpoint returned non-200 HTTP status",
	)
	errReferenceEmptyVersion = errors.New(
		"version endpoint returned an empty version",
	)
)

// referenceVersion checks the running service, not a recorded GraphQL response.
func referenceVersion(ctx context.Context, graphqlURL string) (string, error) {
	u, err := url.Parse(graphqlURL)
	if err != nil {
		return "", fmt.Errorf("parsing GraphQL URL: %w", err)
	}

	if !strings.HasSuffix(u.Path, "/v1/graphql") {
		return "", errReferenceURL
	}

	u.Path = strings.TrimSuffix(u.Path, "/v1/graphql") + "/v1/version"

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return "", fmt.Errorf("creating version request: %w", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("requesting version: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf(
			"version endpoint returned HTTP %d: %w",
			resp.StatusCode,
			errReferenceStatus,
		)
	}

	var body struct {
		Version string `json:"version"`
	}
	if err := json.UnmarshalRead(resp.Body, &body); err != nil {
		return "", fmt.Errorf("decoding version: %w", err)
	}

	if body.Version == "" {
		return "", errReferenceEmptyVersion
	}

	return body.Version, nil
}

// TestComputedFieldReference is a required live Hasura comparison. Keep this
// test serial: later computed-field probes may temporarily change metadata/DDL
// and must not run beside the existing parallel read-only integration cases.
//
//nolint:paralleltest,cyclop,gocognit,gocyclo,maintidx // Serial live sanity checks both engines across representative slices.
func TestComputedFieldReference(t *testing.T) {
	version, err := referenceVersion(t.Context(), hasuraURL)
	if err != nil {
		t.Fatalf("Hasura connectivity/version: %v", err)
	}

	// The existing Nhost stack pins v2.50.3-ce in integration/nhost/nhost.toml.
	if version != "v2.50.3-ce" {
		t.Fatalf("unexpected Hasura version %q (expected v2.50.3-ce)", version)
	}

	if _, err := referenceVersion(t.Context(), constellationURL); err != nil {
		t.Fatalf("Constellation connectivity/version: %v", err)
	}

	// limit: 0 avoids dependence on mutable seed rows while exercising a
	// tracked, computed-field-free SQL root on both running services.
	control := query{Query: `query { departments(limit: 0) { id } }`, Role: "admin"}
	headers := http.Header{}
	headers.Set("x-hasura-admin-secret", adminSecret)

	hasura, err := makeHTTPQuery(t.Context(), hasuraURL, control, headers)
	if err != nil {
		t.Fatalf("Hasura control query: %v", err)
	}

	constellation, err := makeHTTPQuery(t.Context(), constellationURL, control, headers)
	if err != nil {
		t.Fatalf("Constellation control query: %v", err)
	}

	want := map[string]any{"data": map[string]any{"departments": []any{}}}
	if diff := cmp.Diff(want, hasura); diff != "" {
		t.Fatalf("Hasura control did not execute successfully (-want +got):\n%s", diff)
	}

	if diff := cmp.Diff(hasura, constellation); diff != "" {
		t.Errorf("live control responses differ (-hasura +constellation):\n%s", diff)
	}

	// The computed fixture has its own source and seeded data, so this
	// selection is independent of ordinary integration mutations.
	scalar := query{
		Query: `query { cf_select_items(where:{id:{_eq:1}}) { item_label item_second(args:{multiplier:2}) } }`,
		Role:  "cf_reader",
	}

	headers.Set("x-hasura-role", "cf_reader")

	hasura, err = makeHTTPQuery(t.Context(), hasuraURL, scalar, headers)
	if err != nil {
		t.Fatalf("Hasura scalar selection: %v", err)
	}

	constellation, err = makeHTTPQuery(t.Context(), constellationURL, scalar, headers)
	if err != nil {
		t.Fatalf("Constellation scalar selection: %v", err)
	}

	want = map[string]any{"data": map[string]any{"cf_select_items": []any{
		map[string]any{"item_label": "first", "item_second": float64(25)},
	}}}
	if diff := cmp.Diff(want, hasura); diff != "" {
		t.Fatalf("Hasura fixture response changed (-want +got):\n%s", diff)
	}

	if diff := cmp.Diff(hasura, constellation); diff != "" {
		t.Errorf("live scalar selection differs (-hasura +constellation):\n%s", diff)
	}

	// The startup fixture pins a real non-null same-source match for text
	// object/array keys, the text array's aggregate sibling, and a JSONB object key. Compare only the granted role;
	// the denied-key divergence is asserted separately below.
	joined := query{
		Query: `query { cf_select_items(where:{id:{_eq:1}}) {
			cf_label_object { id } cf_label_array(order_by:{id:asc}) { id }
			cf_label_array_aggregate { aggregate { count } nodes { id } }
			cf_payload_object { id }
		} }`,
		Role: "cf_reader",
	}

	hasura, err = makeHTTPQuery(t.Context(), hasuraURL, joined, headers)
	if err != nil {
		t.Fatalf("Hasura granted computed join: %v", err)
	}

	constellation, err = makeHTTPQuery(t.Context(), constellationURL, joined, headers)
	if err != nil {
		t.Fatalf("Constellation granted computed join: %v", err)
	}

	want = map[string]any{"data": map[string]any{"cf_select_items": []any{map[string]any{
		"cf_label_object": map[string]any{"id": float64(1)},
		"cf_label_array":  []any{map[string]any{"id": float64(1)}},
		"cf_label_array_aggregate": map[string]any{
			"aggregate": map[string]any{"count": float64(1)},
			"nodes":     []any{map[string]any{"id": float64(1)}},
		},
		"cf_payload_object": map[string]any{"id": float64(1)},
	}}}}
	if diff := cmp.Diff(want, hasura); diff != "" {
		t.Fatalf("Hasura computed join fixture did not match (-want +got):\n%s", diff)
	}

	if diff := cmp.Diff(hasura, constellation); diff != "" {
		t.Errorf("granted computed join differs (-hasura +constellation):\n%s", diff)
	}

	// Two distinct parent keys must each retain their own limit window. The
	// old single target LIMIT returned [] for the second parent even though
	// Hasura returns id 2; offset-only windows are compared on the same
	// immutable startup rows without adding metadata or seed data.
	for _, tc := range []struct {
		name, args string
		want       []any
	}{
		{"limit", "limit:1,order_by:{id:asc}", []any{
			map[string]any{"cf_label_array": []any{map[string]any{"id": float64(1)}}},
			map[string]any{"cf_label_array": []any{map[string]any{"id": float64(2)}}},
		}},
		{"offset", "offset:1,order_by:{id:asc}", []any{
			map[string]any{"cf_label_array": []any{}},
			map[string]any{"cf_label_array": []any{}},
		}},
	} {
		t.Run("per-parent array "+tc.name, func(t *testing.T) {
			q := query{Query: `query { cf_select_items(order_by:{id:asc}) {
				cf_label_array(` + tc.args + `) { id }
			} }`, Role: "cf_reader"}

			h, err := makeHTTPQuery(t.Context(), hasuraURL, q, headers)
			if err != nil {
				t.Fatalf("Hasura: %v", err)
			}

			c, err := makeHTTPQuery(t.Context(), constellationURL, q, headers)
			if err != nil {
				t.Fatalf("Constellation: %v", err)
			}

			want := map[string]any{"data": map[string]any{"cf_select_items": tc.want}}
			if diff := cmp.Diff(want, h); diff != "" {
				t.Fatalf("Hasura fixture changed (-want +got):\n%s", diff)
			}

			if diff := cmp.Diff(h, c); diff != "" {
				t.Errorf("per-parent pagination differs (-hasura +constellation):\n%s", diff)
			}
		})
	}

	// The unchanged userProfiles fixture has multiple departments for each
	// populated parent. Offset must return a positive second row per parent,
	// not the empty window exercised by the computed startup items above.
	for _, tc := range []struct{ name, args string }{
		{"positive offset", "order_by:{department_id:asc},offset:1,limit:1"},
		{"distinct on", "distinct_on:[role],order_by:[{role:asc},{department_id:asc}]"},
	} {
		t.Run("static remote array "+tc.name, func(t *testing.T) {
			q := query{Query: `query { userProfiles(order_by:{id:asc}) {
				id departments(` + tc.args + `) { department_id role }
			} }`, Role: "admin"}
			adminHeaders := http.Header{}
			adminHeaders.Set("x-hasura-admin-secret", adminSecret)

			h, queryErr := makeHTTPQuery(t.Context(), hasuraURL, q, adminHeaders)
			if queryErr != nil {
				t.Fatal(queryErr)
			}

			c, queryErr := makeHTTPQuery(t.Context(), constellationURL, q, adminHeaders)
			if queryErr != nil {
				t.Fatal(queryErr)
			}

			envelope, ok := h.(map[string]any)
			if !ok {
				t.Fatalf("Hasura response is not an object: %#v", h)
			}

			data, ok := envelope["data"].(map[string]any)
			if !ok {
				t.Fatalf("Hasura response missing data: %#v", h)
			}

			parents, ok := data["userProfiles"].([]any)
			if !ok || len(parents) < 2 {
				t.Fatalf("expected multiple static parents: %#v", h)
			}

			positive := 0
			for _, value := range parents {
				parent, ok := value.(map[string]any)
				if !ok {
					t.Fatalf("malformed parent: %#v", value)
				}

				if children, ok := parent["departments"].([]any); ok && len(children) > 0 {
					positive++
				}
			}

			if positive < 2 {
				t.Fatalf("expected positive per-parent windows for at least two parents: %#v", h)
			}

			if diff := cmp.Diff(h, c); diff != "" {
				t.Errorf("static remote array differs (-hasura +constellation):\n%s", diff)
			}
		})
	}

	// The same checked-in fixture also permits a nested remote-of-remote
	// positive comparison without mutating Hasura metadata or DDL.
	nestedJoin := query{
		Query: `query { cf_select_items(where:{id:{_eq:1}}) {
			cf_label_object { id cf_label_array(order_by:{id:asc}) { id } }
		} }`,
		Role: "cf_reader",
	}

	hasura, err = makeHTTPQuery(t.Context(), hasuraURL, nestedJoin, headers)
	if err != nil {
		t.Fatalf("Hasura nested computed join: %v", err)
	}

	constellation, err = makeHTTPQuery(t.Context(), constellationURL, nestedJoin, headers)
	if err != nil {
		t.Fatalf("Constellation nested computed join: %v", err)
	}

	want = map[string]any{"data": map[string]any{"cf_select_items": []any{map[string]any{
		"cf_label_object": map[string]any{
			"id":             float64(1),
			"cf_label_array": []any{map[string]any{"id": float64(1)}},
		},
	}}}}
	if diff := cmp.Diff(want, hasura); diff != "" {
		t.Fatalf("Hasura nested join fixture changed (-want +got):\n%s", diff)
	}

	if diff := cmp.Diff(hasura, constellation); diff != "" {
		t.Errorf("live nested join differs (-hasura +constellation):\n%s", diff)
	}

	headers.Set("x-hasura-role", "cf_no_grant")

	denied := query{
		Query: `query { cf_select_items(where:{id:{_eq:1}}) { cf_label_object { id } } }`,
		Role:  "cf_no_grant",
	}

	hasura, err = makeHTTPQuery(t.Context(), hasuraURL, denied, headers)
	if err != nil {
		t.Fatalf("Hasura denied-key contrast: %v", err)
	}

	constellation, err = makeHTTPQuery(t.Context(), constellationURL, denied, headers)
	if err != nil {
		t.Fatalf("Constellation denied-key contrast: %v", err)
	}

	if diff := cmp.Diff(map[string]any{"data": map[string]any{"cf_select_items": []any{
		map[string]any{"cf_label_object": map[string]any{"id": float64(1)}},
	}}}, hasura); diff != "" {
		t.Errorf("Hasura denied-key contrast changed (-want +got):\n%s", diff)
	}

	deniedResponse, ok := constellation.(map[string]any)
	if !ok || deniedResponse["errors"] == nil {
		t.Errorf("Constellation must reject denied computed join: %v", constellation)
	}

	headers.Set("x-hasura-role", "cf_reader")

	// A table computed field inherits access to the returned table without an
	// explicit computed-field grant on its parent.
	table := query{
		Query: `query { cf_select_items(where:{id:{_eq:1}}) { item_tags(order_by:{id:desc},limit:1) { id label } } }`,
		Role:  "cf_reader",
	}

	hasura, err = makeHTTPQuery(t.Context(), hasuraURL, table, headers)
	if err != nil {
		t.Fatalf("Hasura table selection: %v", err)
	}

	constellation, err = makeHTTPQuery(t.Context(), constellationURL, table, headers)
	if err != nil {
		t.Fatalf("Constellation table selection: %v", err)
	}

	want = map[string]any{"data": map[string]any{"cf_select_items": []any{
		map[string]any{"item_tags": []any{map[string]any{"id": float64(2), "label": "two"}}},
	}}}
	if diff := cmp.Diff(want, hasura); diff != "" {
		t.Fatalf("Hasura table fixture response changed (-want +got):\n%s", diff)
	}

	if diff := cmp.Diff(hasura, constellation); diff != "" {
		t.Errorf("live table selection differs (-hasura +constellation):\n%s", diff)
	}

	// A table predicate filters over the function result; aggregate ordering
	// uses those same returned rows. Lasting expectations live in connector tests.
	tableInput := query{
		Query: `query { cf_select_items(where:{item_tags:{id:{_eq:3}}},order_by:{item_tags_aggregate:{count:desc}}) { id } }`,
		Role:  "cf_reader",
	}

	hasura, err = makeHTTPQuery(t.Context(), hasuraURL, tableInput, headers)
	if err != nil {
		t.Fatalf("Hasura table inputs: %v", err)
	}

	constellation, err = makeHTTPQuery(t.Context(), constellationURL, tableInput, headers)
	if err != nil {
		t.Fatalf("Constellation table inputs: %v", err)
	}

	want = map[string]any{"data": map[string]any{
		"cf_select_items": []any{map[string]any{"id": float64(2)}},
	}}
	if diff := cmp.Diff(want, hasura); diff != "" {
		t.Fatalf("Hasura table input fixture changed (-want +got):\n%s", diff)
	}

	if diff := cmp.Diff(hasura, constellation); diff != "" {
		t.Errorf("live table input responses differ (-hasura +constellation):\n%s", diff)
	}

	// Static filtered roles pin the patched oracle's target-row protection
	// without replacing metadata while other integration cases may query it.
	for _, tc := range []struct {
		name, role, graphql string
		ids                 []any
	}{
		{"visible tag one", "cf_filtered_one", `query { cf_select_tags(order_by:{id:asc}) { id } }`, []any{map[string]any{"id": float64(1)}}},
		{"hidden tag cannot satisfy EXISTS", "cf_filtered_one", `query { cf_select_items(where:{item_tags:{label:{_eq:"two"}}}) { id } }`, []any{}},
		{"visible tag three", "cf_filtered_three", `query { cf_select_tags(order_by:{id:asc}) { id } }`, []any{map[string]any{"id": float64(3)}}},
		{"aggregate ordering excludes hidden tags", "cf_filtered_three", `query { cf_select_items(order_by:[{item_tags_aggregate:{count:desc}},{id:asc}]) { id } }`, []any{map[string]any{"id": float64(2)}, map[string]any{"id": float64(1)}}},
		{"unrestricted aggregate ordering control", "admin", `query { cf_select_items(order_by:[{item_tags_aggregate:{count:desc}},{id:asc}]) { id } }`, []any{map[string]any{"id": float64(1)}, map[string]any{"id": float64(2)}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			headers.Set("x-hasura-role", tc.role)
			q := query{Query: tc.graphql, Role: tc.role}

			h, err := makeHTTPQuery(t.Context(), hasuraURL, q, headers)
			if err != nil {
				t.Fatalf("Hasura filtered table input: %v", err)
			}

			c, err := makeHTTPQuery(t.Context(), constellationURL, q, headers)
			if err != nil {
				t.Fatalf("Constellation filtered table input: %v", err)
			}

			root := "cf_select_items"
			if strings.Contains(tc.graphql, "cf_select_tags(") {
				root = "cf_select_tags"
			}

			want := map[string]any{"data": map[string]any{root: tc.ids}}
			if diff := cmp.Diff(want, h); diff != "" {
				t.Fatalf("patched Hasura filtered table result (-want +got):\n%s", diff)
			}

			if diff := cmp.Diff(h, c); diff != "" {
				t.Errorf("filtered table input differs (-hasura +constellation):\n%s", diff)
			}
		})
	}

	headers.Set("x-hasura-role", "cf_reader")

	// Scalar inputs and aggregate outputs use the same seeded source, but
	// independent Constellation tests own the exhaustive expectations.
	input := query{
		Query: `query { cf_select_items(where:{item_label:{_eq:"first"}},order_by:{item_label:desc}) { id item_label } cf_select_items_aggregate { aggregate { sum { item_score(args:{multiplier:2}) } } } }`,
		Role:  "cf_reader",
	}

	hasura, err = makeHTTPQuery(t.Context(), hasuraURL, input, headers)
	if err != nil {
		t.Fatalf("Hasura scalar input query: %v", err)
	}

	constellation, err = makeHTTPQuery(t.Context(), constellationURL, input, headers)
	if err != nil {
		t.Fatalf("Constellation scalar input query: %v", err)
	}

	want = map[string]any{"data": map[string]any{
		"cf_select_items": []any{map[string]any{"id": float64(1), "item_label": "first"}},
		"cf_select_items_aggregate": map[string]any{"aggregate": map[string]any{
			"sum": map[string]any{"item_score": float64(31.5)},
		}},
	}}
	if diff := cmp.Diff(want, hasura); diff != "" {
		t.Fatalf("Hasura scalar input fixture changed (-want +got):\n%s", diff)
	}

	if diff := cmp.Diff(hasura, constellation); diff != "" {
		t.Errorf("live scalar input responses differ (-hasura +constellation):\n%s", diff)
	}

	// The predicate role has no computed selection grant; its filter still
	// evaluates the full physical row without exposing the computed field.
	guard := query{
		Query: `query { cf_predicates_rules(order_by:{id:asc}) { id label } }`,
		Role:  "cf_predicate_guard",
	}
	headers.Set("x-hasura-role", guard.Role)

	hasura, err = makeHTTPQuery(t.Context(), hasuraURL, guard, headers)
	if err != nil {
		t.Fatalf("Hasura permission query: %v", err)
	}

	constellation, err = makeHTTPQuery(t.Context(), constellationURL, guard, headers)
	if err != nil {
		t.Fatalf("Constellation permission query: %v", err)
	}

	want = map[string]any{"data": map[string]any{"cf_predicates_rules": []any{
		map[string]any{"id": float64(1), "label": "visible"},
	}}}
	if diff := cmp.Diff(want, hasura); diff != "" {
		t.Fatalf("Hasura permission fixture changed (-want +got):\n%s", diff)
	}

	if diff := cmp.Diff(hasura, constellation); diff != "" {
		t.Errorf("live computed permission responses differ (-hasura +constellation):\n%s", diff)
	}
}
