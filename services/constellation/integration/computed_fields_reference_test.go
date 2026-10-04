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
//nolint:paralleltest,cyclop // Serial live sanity deliberately checks connectivity and both representative slices.
func TestComputedFieldReference(t *testing.T) {
	version, err := referenceVersion(t.Context(), hasuraURL)
	if err != nil {
		t.Fatalf("Hasura connectivity/version: %v", err)
	}

	// The existing Nhost stack pins v2.48.10-ce in integration/nhost/nhost.toml.
	if !strings.HasPrefix(version, "v2.48.10") {
		t.Fatalf("unexpected Hasura version %q (expected v2.48.10)", version)
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
