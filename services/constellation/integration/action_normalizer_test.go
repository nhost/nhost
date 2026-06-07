package integration_test

import (
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestActionResponseRedactorPreservesSiblingPaths(t *testing.T) {
	t.Parallel()

	initialPath := make([]string, 1, 4)
	initialPath[0] = "root"
	input := map[string]any{
		"left":  "left-value",
		"right": "right-value",
	}

	var observedPaths [][]string
	redactResponseValue(input, initialPath, func(path []string, value any) (any, bool) {
		if _, ok := value.(string); ok {
			observedPaths = append(observedPaths, path)
		}

		return nil, false
	})

	actual := make(map[string]struct{}, len(observedPaths))
	for _, path := range observedPaths {
		actual[strings.Join(path, ".")] = struct{}{}
	}

	expected := map[string]struct{}{
		"root.left":  {},
		"root.right": {},
	}
	if diff := cmp.Diff(expected, actual); diff != "" {
		t.Errorf("redactor paths differ (-want +got):\n%s", diff)
	}
}

func TestActionResponseNormalizerRedactsVolatiles(t *testing.T) {
	t.Parallel()

	input := map[string]any{
		"data": map[string]any{
			"echoHeaders": map[string]any{
				"message":    "stable",
				"Date":       "Sun, 07 Jun 2026 12:34:56 GMT",
				"request-id": "request-123",
				"id":         "550e8400-e29b-41d4-a716-446655440000",
				"createdAt":  "2026-06-07T12:34:56.789Z",
				"nestedItems": []any{
					map[string]any{"x-request-id": "nested-request", "stable": "nested"},
				},
			},
		},
	}

	actual := normalizeResponse(input, redactActionVolatiles)
	expected := map[string]any{
		"data": map[string]any{
			"echoHeaders": map[string]any{
				"message":    "stable",
				"Date":       "<redacted>",
				"request-id": "<redacted>",
				"id":         "<uuid>",
				"createdAt":  "<timestamp>",
				"nestedItems": []any{
					map[string]any{"x-request-id": "<redacted>", "stable": "nested"},
				},
			},
		},
	}

	if diff := cmp.Diff(expected, actual); diff != "" {
		t.Errorf("normalized response differs (-want +got):\n%s", diff)
	}
}
