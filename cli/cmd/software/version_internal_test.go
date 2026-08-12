package software

import (
	"encoding/json"
	"testing"
)

func TestBuildVersionJSONSortsServicesByName(t *testing.T) {
	t.Parallel()

	out := buildVersionJSON(
		cliStatus{
			Current:     "v1.0.0",
			Recommended: "",
			OK:          true,
		},
		map[string]ServiceVersion{
			"storage": {
				Service:     "storage",
				Current:     "1.0.0",
				Recommended: "1.1.0",
				OK:          false,
			},
			"auth": {
				Service:     "auth",
				Current:     "1.2.3",
				Recommended: "",
				OK:          true,
			},
			"graphql": {
				Service:     "graphql",
				Current:     "2.0.0",
				Recommended: "2.1.0",
				OK:          false,
			},
		},
	)

	want := []string{"auth", "graphql", "storage"}
	if len(out.Services) != len(want) {
		t.Fatalf("expected %d services, got %d", len(want), len(out.Services))
	}

	for i, wantService := range want {
		if out.Services[i].Name != wantService {
			t.Fatalf("service %d = %q, want %q", i, out.Services[i].Name, wantService)
		}
	}
}

func TestBuildVersionJSONEmptyServicesEncodeAsArray(t *testing.T) {
	t.Parallel()

	out := buildVersionJSON(
		cliStatus{
			Current:     "v1.0.0",
			Recommended: "",
			OK:          true,
		},
		map[string]ServiceVersion{},
	)

	if out.Services == nil {
		t.Fatal("expected empty services list to be non-nil")
	}

	encoded, err := json.Marshal(out)
	if err != nil {
		t.Fatalf("marshal version output: %v", err)
	}

	want := `{"cli":{"current":"v1.0.0","recommended":"","ok":true},"services":[]}`
	if got := string(encoded); got != want {
		t.Fatalf("expected JSON %s, got %s", want, got)
	}
}

func TestBuildVersionJSONStableShapeAndRecommendations(t *testing.T) {
	t.Parallel()

	out := buildVersionJSON(
		cliStatus{
			Current:     "v1.0.0",
			Recommended: "v1.1.0",
			OK:          false,
		},
		map[string]ServiceVersion{
			"storage": {
				Service:     "storage",
				Current:     "1.0.0",
				Recommended: "1.1.0",
				OK:          false,
			},
			"auth": {
				Service:     "auth",
				Current:     "1.2.3",
				Recommended: "",
				OK:          true,
			},
		},
	)

	encoded, err := json.Marshal(out)
	if err != nil {
		t.Fatalf("marshal version output: %v", err)
	}

	want := `{"cli":{"current":"v1.0.0","recommended":"v1.1.0","ok":false},"services":[{"service":"auth","current":"1.2.3","recommended":"","ok":true},{"service":"storage","current":"1.0.0","recommended":"1.1.0","ok":false}]}`
	if got := string(encoded); got != want {
		t.Fatalf("expected JSON %s, got %s", want, got)
	}
}
