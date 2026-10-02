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
func TestComputedFieldReference(t *testing.T) { //nolint:paralleltest
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
}
