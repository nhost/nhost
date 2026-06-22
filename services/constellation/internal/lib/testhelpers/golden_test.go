package testhelpers_test

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/nhost/nhost/services/constellation/internal/lib/testhelpers"
)

type sample struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
	Tags  []string
}

// recordingT embeds testing.TB to satisfy the interface (which has unexported
// methods and so cannot be implemented from scratch) while intercepting the
// failure-reporting calls the golden helpers make on mismatch. Errorf and
// Fatalf record their formatted message instead of failing the outer test, so
// the mismatch branches of GoldenJSON and GoldenGraphQLSchema can be asserted
// directly.
type recordingT struct {
	testing.TB

	errs []string
}

func (r *recordingT) Errorf(format string, args ...any) {
	r.errs = append(r.errs, fmt.Sprintf(format, args...))
}

func (r *recordingT) Fatalf(format string, args ...any) {
	r.errs = append(r.errs, fmt.Sprintf(format, args...))
}

func TestGoldenJSON(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		// got is written via the overwrite path, then recompareWith is
		// compared against the seeded golden file via the read path.
		got           sample
		recompareWith sample
	}{
		{
			name:          "overwrite writes file then compares against itself",
			got:           sample{Name: "alice", Count: 3, Tags: []string{"a", "b"}},
			recompareWith: sample{Name: "alice", Count: 3, Tags: []string{"a", "b"}},
		},
		{
			name:          "compare path reads existing file",
			got:           sample{Name: "bob", Count: 7, Tags: nil},
			recompareWith: sample{Name: "bob", Count: 7, Tags: nil},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			path := filepath.Join(t.TempDir(), "sample.json")

			testhelpers.GoldenJSON(t, path, tt.got, true)

			if _, err := os.Stat(path); err != nil {
				t.Fatalf("expected golden file to be written: %v", err)
			}

			testhelpers.GoldenJSON(t, path, tt.recompareWith, false)
		})
	}
}

func TestGoldenGraphQLSchema(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		// originalSDL is written via the overwrite path, then recompareSDL is
		// compared against the seeded golden file via the read path.
		originalSDL  string
		recompareSDL string
	}{
		{
			name: "overwrite writes file then compares against itself",
			originalSDL: `
type Query {
  hello: String!
  world: Int
}
`,
			recompareSDL: `
type Query {
  hello: String!
  world: Int
}
`,
		},
		{
			name: "semantic equivalence ignores field ordering",
			originalSDL: `
type Query {
  hello: String!
  world: Int
}
`,
			recompareSDL: `
type Query {
  world: Int
  hello: String!
}
`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			path := filepath.Join(t.TempDir(), "schema.graphql")

			testhelpers.GoldenGraphQLSchema(t, path, tt.originalSDL, true)

			if _, err := os.Stat(path); err != nil {
				t.Fatalf("expected golden file to be written: %v", err)
			}

			testhelpers.GoldenGraphQLSchema(t, path, tt.recompareSDL, false)
		})
	}
}

func TestGoldenJSONMismatch(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		// golden is seeded via the overwrite path, then got is compared
		// against it via the read path. The two differ so the mismatch
		// branch must fire.
		golden sample
		got    sample
	}{
		{
			name:   "differing scalar field",
			golden: sample{Name: "alice", Count: 3, Tags: []string{"a"}},
			got:    sample{Name: "alice", Count: 4, Tags: []string{"a"}},
		},
		{
			name:   "differing slice contents",
			golden: sample{Name: "bob", Count: 1, Tags: []string{"a", "b"}},
			got:    sample{Name: "bob", Count: 1, Tags: []string{"a", "c"}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			path := filepath.Join(t.TempDir(), "sample.json")

			testhelpers.GoldenJSON(t, path, tt.golden, true)

			rec := &recordingT{TB: t, errs: nil}
			testhelpers.GoldenJSON(rec, path, tt.got, false)

			if len(rec.errs) == 0 {
				t.Fatal("expected a recorded mismatch error, got none")
			}
		})
	}
}

func TestGoldenGraphQLSchemaMismatch(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		// goldenSDL is seeded via the overwrite path, then gotSDL is
		// compared against it via the read path. The two are semantically
		// distinct so the mismatch branch must fire.
		goldenSDL string
		gotSDL    string
	}{
		{
			name: "differing field type",
			goldenSDL: `
type Query {
  hello: String!
}
`,
			gotSDL: `
type Query {
  hello: Int!
}
`,
		},
		{
			name: "extra field",
			goldenSDL: `
type Query {
  hello: String!
}
`,
			gotSDL: `
type Query {
  hello: String!
  world: Int
}
`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			path := filepath.Join(t.TempDir(), "schema.graphql")

			testhelpers.GoldenGraphQLSchema(t, path, tt.goldenSDL, true)

			rec := &recordingT{TB: t, errs: nil}
			testhelpers.GoldenGraphQLSchema(rec, path, tt.gotSDL, false)

			if len(rec.errs) == 0 {
				t.Fatal("expected a recorded mismatch error, got none")
			}
		})
	}
}
