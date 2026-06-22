package jsonpath

import (
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestNavigatePart(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		current  any
		part     string
		expected any
	}{
		{
			name:     "map lookup returns value",
			current:  map[string]any{"homeTeam": map[string]any{"name": "Team A"}},
			part:     "homeTeam",
			expected: map[string]any{"name": "Team A"},
		},
		{
			name:     "map lookup missing key returns nil",
			current:  map[string]any{"homeTeam": "x"},
			part:     "awayTeam",
			expected: nil,
		},
		{
			name: "array collects field from each object",
			current: []any{
				map[string]any{"homeTeam": map[string]any{"name": "Team A"}},
				map[string]any{"homeTeam": map[string]any{"name": "Team B"}},
			},
			part: "homeTeam",
			expected: []any{
				map[string]any{"name": "Team A"},
				map[string]any{"name": "Team B"},
			},
		},
		{
			name: "array flattens nested array values",
			current: []any{
				map[string]any{"players": []any{
					map[string]any{"name": "A"},
					map[string]any{"name": "B"},
				}},
				map[string]any{"players": []any{
					map[string]any{"name": "C"},
				}},
			},
			part: "players",
			expected: []any{
				map[string]any{"name": "A"},
				map[string]any{"name": "B"},
				map[string]any{"name": "C"},
			},
		},
		{
			name: "array with no matching items returns nil",
			current: []any{
				map[string]any{"homeTeam": map[string]any{"name": "Team A"}},
				map[string]any{"homeTeam": map[string]any{"name": "Team B"}},
			},
			part:     "awayTeam",
			expected: nil,
		},
		{
			name: "array containing non-map items returns nil when no matches",
			current: []any{
				"scalar",
				42,
			},
			part:     "anything",
			expected: nil,
		},
		{
			name:     "scalar string returns nil",
			current:  "scalar",
			part:     "anything",
			expected: nil,
		},
		{
			name:     "scalar int returns nil",
			current:  42,
			part:     "anything",
			expected: nil,
		},
		{
			name:     "nil returns nil",
			current:  nil,
			part:     "anything",
			expected: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := navigatePart(tt.current, tt.part)
			if diff := cmp.Diff(tt.expected, got); diff != "" {
				t.Errorf("navigatePart() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestFlattenToRows(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		data     any
		expected []map[string]any
	}{
		{
			name:     "single map yields one row",
			data:     map[string]any{"name": "Team A"},
			expected: []map[string]any{{"name": "Team A"}},
		},
		{
			name: "flat array of maps",
			data: []any{
				map[string]any{"name": "Team A"},
				map[string]any{"name": "Team B"},
			},
			expected: []map[string]any{
				{"name": "Team A"},
				{"name": "Team B"},
			},
		},
		{
			name: "nested array flattens recursively",
			data: []any{
				[]any{
					map[string]any{"name": "Team A"},
					map[string]any{"name": "Team B"},
				},
				[]any{
					[]any{
						map[string]any{"name": "Team C"},
					},
				},
				map[string]any{"name": "Team D"},
			},
			expected: []map[string]any{
				{"name": "Team A"},
				{"name": "Team B"},
				{"name": "Team C"},
				{"name": "Team D"},
			},
		},
		{
			name:     "scalar string returns nil",
			data:     "scalar",
			expected: nil,
		},
		{
			name:     "scalar int returns nil",
			data:     42,
			expected: nil,
		},
		{
			name:     "nil returns nil",
			data:     nil,
			expected: nil,
		},
		{
			name: "array of scalars returns nil",
			data: []any{
				"a",
				1,
			},
			expected: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := flattenToRows(tt.data)
			if diff := cmp.Diff(tt.expected, got); diff != "" {
				t.Errorf("flattenToRows() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestNavigate(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		path     Path
		data     any
		expected any
	}{
		{
			name:     "empty path returns data unchanged",
			path:     Path{},
			data:     map[string]any{"foo": "bar"},
			expected: map[string]any{"foo": "bar"},
		},
		{
			name: "multi part traversal through maps",
			path: Path{"games", "homeTeam", "name"},
			data: map[string]any{
				"games": map[string]any{
					"homeTeam": map[string]any{
						"name": "Team A",
					},
				},
			},
			expected: "Team A",
		},
		{
			name: "short-circuits when intermediate part missing",
			path: Path{"games", "missing", "name"},
			data: map[string]any{
				"games": map[string]any{
					"homeTeam": map[string]any{"name": "Team A"},
				},
			},
			expected: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := tt.path.navigate(tt.data)
			if diff := cmp.Diff(tt.expected, got); diff != "" {
				t.Errorf("navigate() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
