package hasura_test

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
	"unicode"

	"github.com/nhost/nhost/services/ai/hasura"
)

func TestAgentProviderGeneratedStringTypes(t *testing.T) {
	t.Parallel()

	const providerName = "gateway.primary-test"

	var agent hasura.GetAgent_AiAgent
	if err := json.Unmarshal([]byte(`{"provider":"`+providerName+`"}`), &agent); err != nil {
		t.Fatalf("unmarshal agent provider: %v", err)
	}

	if got := agent.GetProvider(); got != providerName {
		t.Errorf("GetProvider() = %q, want %q", got, providerName)
	}

	var insert hasura.AiAgentsInsertInput
	if err := json.Unmarshal([]byte(`{"provider":"`+providerName+`"}`), &insert); err != nil {
		t.Fatalf("unmarshal agent insert provider: %v", err)
	}

	var set hasura.AiAgentsSetInput
	if err := json.Unmarshal([]byte(`{"provider":"`+providerName+`"}`), &set); err != nil {
		t.Fatalf("unmarshal agent set provider: %v", err)
	}

	var filter hasura.AiAgentsBoolExp
	if err := json.Unmarshal(
		[]byte(`{"provider":{"_eq":"`+providerName+`"}}`),
		&filter,
	); err != nil {
		t.Fatalf("unmarshal agent provider filter: %v", err)
	}

	if filter.Provider == nil {
		t.Fatal("filter provider is nil")
	}

	for name, got := range map[string]*string{
		"insert": insert.Provider,
		"set":    set.Provider,
		"filter": filter.Provider.Eq,
	} {
		if got == nil || *got != providerName {
			t.Errorf("%s provider = %v, want %q", name, got, providerName)
		}
	}
}

func TestGeneratedClientHasNoAgentProviderEnumArtifacts(t *testing.T) {
	t.Parallel()

	for _, filename := range []string{"client_gen.go", "models_gen.go"} {
		source := readGeneratedSource(t, filename)

		for _, forbidden := range []string{
			"AiAgentProviders",
			"aiAgentProviders",
			"agent_providers",
		} {
			if strings.Contains(source, forbidden) {
				t.Errorf("%s contains obsolete provider enum artifact %q", filename, forbidden)
			}
		}
	}
}

func readGeneratedSource(t *testing.T, filename string) string {
	t.Helper()

	source, err := os.ReadFile(filename)
	if err != nil {
		t.Fatalf("read generated source %s: %v", filename, err)
	}

	return string(source)
}

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
