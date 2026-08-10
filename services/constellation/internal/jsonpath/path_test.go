package jsonpath_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/internal/jsonpath"
)

func TestParse(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		input    string
		expected jsonpath.Path
	}{
		{"empty string", "", jsonpath.Path{}},
		{"single element", "games", jsonpath.Path{"games"}},
		{"two elements", "games.homeTeam", jsonpath.Path{"games", "homeTeam"}},
		{
			"three elements",
			"games.homeTeam.department",
			jsonpath.Path{"games", "homeTeam", "department"},
		},
		{"leading dot", ".games", jsonpath.Path{"games"}},
		{"trailing dot", "games.", jsonpath.Path{"games"}},
		{"multiple dots", "games..homeTeam", jsonpath.Path{"games", "homeTeam"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			result := jsonpath.Parse(tt.input)
			if diff := cmp.Diff(tt.expected, result); diff != "" {
				t.Errorf("Parse(%q) mismatch (-want +got):\n%s", tt.input, diff)
			}
		})
	}
}

func TestPathString(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		path     jsonpath.Path
		expected string
	}{
		{"empty", jsonpath.Path{}, ""},
		{"single", jsonpath.Path{"games"}, "games"},
		{"multiple", jsonpath.Path{"games", "homeTeam", "department"}, "games.homeTeam.department"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := tt.path.String(); got != tt.expected {
				t.Errorf("String() = %q, want %q", got, tt.expected)
			}
		})
	}
}

func TestPathDelete(t *testing.T) {
	t.Parallel()

	t.Run("delete from nested array", func(t *testing.T) {
		t.Parallel()

		data := map[string]any{
			"games": []any{
				map[string]any{
					"homeTeam": map[string]any{
						"name":         "Team A",
						"departmentId": "dept1",
					},
				},
				map[string]any{
					"homeTeam": map[string]any{
						"name":         "Team B",
						"departmentId": "dept2",
					},
				},
			},
		}

		path := jsonpath.Parse("games.homeTeam")
		path.Delete(data, "departmentId")

		expected := map[string]any{
			"games": []any{
				map[string]any{"homeTeam": map[string]any{"name": "Team A"}},
				map[string]any{"homeTeam": map[string]any{"name": "Team B"}},
			},
		}
		if diff := cmp.Diff(expected, data); diff != "" {
			t.Errorf("Delete() mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("delete from single object", func(t *testing.T) {
		t.Parallel()

		data := map[string]any{
			"team": map[string]any{
				"name":         "Team A",
				"departmentId": "dept1",
				"score":        42,
			},
		}

		path := jsonpath.Parse("team")
		path.Delete(data, "departmentId", "score")

		expected := map[string]any{
			"team": map[string]any{"name": "Team A"},
		}
		if diff := cmp.Diff(expected, data); diff != "" {
			t.Errorf("Delete() mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("delete from non-existent path does nothing", func(t *testing.T) {
		t.Parallel()

		data := map[string]any{"foo": "bar"}
		original := map[string]any{"foo": "bar"}

		path := jsonpath.Parse("nonexistent.path")
		path.Delete(data, "anything")

		if diff := cmp.Diff(original, data); diff != "" {
			t.Errorf("data was modified: %s", diff)
		}
	})
}

func TestPathToRows(t *testing.T) {
	t.Parallel()

	data := map[string]any{
		"games": []any{
			map[string]any{
				"homeTeam": map[string]any{"name": "Team A"},
				"awayTeam": map[string]any{"name": "Team B"},
			},
			map[string]any{
				"homeTeam": map[string]any{"name": "Team C"},
				"awayTeam": map[string]any{"name": "Team D"},
			},
		},
	}

	t.Run("collects all maps at path", func(t *testing.T) {
		t.Parallel()

		path := jsonpath.Parse("games.homeTeam")
		rows := path.ToRows(data)

		expected := []map[string]any{
			{"name": "Team A"},
			{"name": "Team C"},
		}
		if diff := cmp.Diff(expected, rows); diff != "" {
			t.Errorf("ToRows() mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("returns nil for non-existent path", func(t *testing.T) {
		t.Parallel()

		path := jsonpath.Parse("nonexistent")
		rows := path.ToRows(data)

		if rows != nil {
			t.Errorf("expected nil, got %v", rows)
		}
	})
}

func TestPathIsEmpty(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		path     jsonpath.Path
		expected bool
	}{
		{"empty", jsonpath.Path{}, true},
		{"single element", jsonpath.Path{"a"}, false},
		{"multiple elements", jsonpath.Path{"games", "homeTeam"}, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := tt.path.IsEmpty(); got != tt.expected {
				t.Errorf("IsEmpty() = %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestPathForEach(t *testing.T) {
	t.Parallel()

	t.Run("single map at path", func(t *testing.T) {
		t.Parallel()

		data := map[string]any{
			"team": map[string]any{"name": "Team A", "score": 42},
		}

		var collected []map[string]any
		jsonpath.Parse("team").ForEach(data, func(item map[string]any) {
			collected = append(collected, item)
		})

		expected := []map[string]any{
			{"name": "Team A", "score": 42},
		}
		if diff := cmp.Diff(expected, collected); diff != "" {
			t.Errorf("ForEach() mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("flattened array of maps", func(t *testing.T) {
		t.Parallel()

		data := map[string]any{
			"games": []any{
				map[string]any{"homeTeam": map[string]any{"name": "Team A"}},
				map[string]any{"homeTeam": map[string]any{"name": "Team B"}},
				map[string]any{"homeTeam": map[string]any{"name": "Team C"}},
			},
		}

		var collected []map[string]any
		jsonpath.Parse("games.homeTeam").ForEach(data, func(item map[string]any) {
			collected = append(collected, item)
		})

		expected := []map[string]any{
			{"name": "Team A"},
			{"name": "Team B"},
			{"name": "Team C"},
		}
		if diff := cmp.Diff(expected, collected); diff != "" {
			t.Errorf("ForEach() mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("missing path does not invoke fn", func(t *testing.T) {
		t.Parallel()

		data := map[string]any{"foo": "bar"}

		callCount := 0
		jsonpath.Parse("nonexistent.path").ForEach(data, func(_ map[string]any) {
			callCount++
		})

		if callCount != 0 {
			t.Errorf("expected fn to not be called, but it was called %d times", callCount)
		}
	})

	t.Run("scalar at path does not invoke fn", func(t *testing.T) {
		t.Parallel()

		data := map[string]any{"name": "just a string"}

		callCount := 0
		jsonpath.Parse("name").ForEach(data, func(_ map[string]any) {
			callCount++
		})

		if callCount != 0 {
			t.Errorf(
				"expected fn to not be called for scalar, but it was called %d times",
				callCount,
			)
		}
	})
}

func TestPathChild(t *testing.T) {
	t.Parallel()

	path := jsonpath.Parse("games.homeTeam")
	child := path.Child("department")

	expected := jsonpath.Path{"games", "homeTeam", "department"}
	if diff := cmp.Diff(expected, child); diff != "" {
		t.Errorf("Child() mismatch: %s", diff)
	}

	// Original should be unchanged
	if len(path) != 2 {
		t.Errorf("original path was modified")
	}
}
