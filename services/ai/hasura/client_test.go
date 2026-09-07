package hasura_test

import (
	"strings"
	"testing"
	"unicode"

	"github.com/nhost/nhost/services/ai/hasura"
)

func TestGetAgentMessagesOrdersByMonotonicSequence(t *testing.T) {
	t.Parallel()

	doc := removeWhitespace(hasura.GetAgentMessagesDocument)
	want := "aiAgentMessages(where:$where,order_by:{createdAt:asc,seq:asc})"

	if !strings.Contains(doc, want) {
		t.Fatalf("GetAgentMessagesDocument order_by = %q, want %q", doc, want)
	}
}

func removeWhitespace(s string) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsSpace(r) {
			return -1
		}

		return r
	}, s)
}
