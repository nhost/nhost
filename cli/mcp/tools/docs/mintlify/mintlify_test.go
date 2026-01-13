package mintlify_test

import (
	"context"
	"testing"

	"github.com/nhost/nhost/cli/mcp/tools/docs/mintlify"
)

func TestMintlify(t *testing.T) {
	t.Skip()

	t.Parallel()

	m, err := mintlify.New(context.Background())
	if err != nil {
		t.Fatalf("error creating Mintlify client: %v", err)
	}

	resp, err := m.Autocomplete(
		context.Background(),
		mintlify.AutocompleteRequest{
			Query:          "how can I enable identity tokens?",
			PageSize:       10,
			SearchType:     "full_text",
			ExtendResults:  true,
			ScoreThreshold: 1,
		},
	)
	if err != nil {
		t.Fatalf("error getting autocomplete: %v", err)
	}

	if len(resp.ScoreChunks) == 0 {
		t.Fatalf("expected non-empty response, got empty")
	}
}
