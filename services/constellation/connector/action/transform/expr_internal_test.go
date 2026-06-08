package transform

import (
	json "encoding/json/v2"
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestTemplateEvaluatorExpressionSurface(t *testing.T) {
	t.Parallel()

	values := map[string]any{
		"body": map[string]any{
			"count": 3,
			"empty": []any{},
			"items": []any{1, 2, 3},
			"name":  "Ada",
			"nulls": []any{nil, "x", nil, 0},
			"object": map[string]any{
				"b": 2,
				"a": 1,
			},
			"uri":  "a+b&c=d@x:$-._~",
			"word": "Ada",
		},
	}

	tests := []struct {
		name   string
		source string
		want   any
	}{
		{
			name: "comparisons",
			source: `{
				"ok": {{ $body.count == 3 && $body.count >= 3 && $body.count <= 4 && $body.count < 4 && $body.count > 2 && $body.name != 'Bob' && $body.name == 'Ada' && 'b' > 'a' }}
			}`,
			want: map[string]any{"ok": true},
		},
		{
			name: "empty and size",
			source: `{
				"emptyNull": {{empty(null)}},
				"emptyArray": {{empty($body.empty)}},
				"sizeString": {{size($body.word)}},
				"sizeObject": {{size($body.object)}},
				"sizeBool": {{size(true)}}
			}`,
			want: map[string]any{
				"emptyArray": true,
				"emptyNull":  true,
				"sizeBool":   float64(1),
				"sizeObject": float64(2),
				"sizeString": float64(3),
			},
		},
		{
			name: "inverse head and tail",
			source: `{
				"inverseArray": {{inverse($body.items)}},
				"inverseString": {{inverse($body.word)}},
				"inverseBool": {{inverse(false)}},
				"inverseNumber": {{inverse(4)}},
				"headArray": {{head($body.items)}},
				"tailArray": {{tail($body.items)}},
				"headString": {{head($body.word)}},
				"tailString": {{tail($body.word)}}
			}`,
			want: map[string]any{
				"headArray":     float64(1),
				"headString":    "A",
				"inverseArray":  []any{float64(3), float64(2), float64(1)},
				"inverseBool":   true,
				"inverseNumber": float64(0.25),
				"inverseString": "adA",
				"tailArray":     []any{float64(2), float64(3)},
				"tailString":    "da",
			},
		},
		{
			name: "pairs and remove nulls",
			source: `{
				"fromPairs": {{fromPairs([['b', 2], ['a', null]])}},
				"toPairs": {{toPairs($body.object)}},
				"removeNulls": {{removeNulls($body.nulls)}}
			}`,
			want: map[string]any{
				"fromPairs": map[string]any{
					"a": nil,
					"b": float64(2),
				},
				"removeNulls": []any{"x", float64(0)},
				"toPairs": []any{
					[]any{"a", float64(1)},
					[]any{"b", float64(2)},
				},
			},
		},
		{
			name:   "escapeUri reserved characters",
			source: `{"escaped": {{escapeUri($body.uri)}}}`,
			want: map[string]any{
				"escaped": "a%2Bb%26c%3Dd%40x%3A%24-._~",
			},
		},
		{
			name: "range array",
			source: `[
				{{ range index, item := $body.items }}{{ if index != 0 }},{{ end }}{"index": {{index}}, "value": {{item}}}{{ end }}
			]`,
			want: []any{
				map[string]any{"index": float64(0), "value": float64(1)},
				map[string]any{"index": float64(1), "value": float64(2)},
				map[string]any{"index": float64(2), "value": float64(3)},
			},
		},
		{
			name: "range object",
			source: `[
				{{ range key, value := $body.object }}{{ if key != 'a' }},{{ end }}{"key": {{key}}, "value": {{value}}}{{ end }}
			]`,
			want: []any{
				map[string]any{"key": "a", "value": float64(1)},
				map[string]any{"key": "b", "value": float64(2)},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			template, err := parseTemplate(tt.source)
			if err != nil {
				t.Fatalf("parseTemplate: %v", err)
			}

			rendered, err := template.renderJSON(values)
			if err != nil {
				t.Fatalf("renderJSON: %v", err)
			}

			var got any
			if err := json.Unmarshal(rendered, &got); err != nil {
				t.Fatalf("unmarshal rendered JSON: %v", err)
			}

			if diff := cmp.Diff(tt.want, got); diff != "" {
				t.Fatalf("rendered mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
