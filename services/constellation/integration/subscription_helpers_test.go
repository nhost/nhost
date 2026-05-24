package integration_test

import (
	"bytes"
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"fmt"
	"maps"
	"net/http"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/integration/subtest"
)

const wsURL = "ws://localhost:8000/graphql"

// sendMutation returns a function that sends a GraphQL mutation via HTTP
// using admin credentials. Intended for use with subtest.Client.Do().
func sendMutation(query string) func() error {
	return func() error {
		body, err := json.Marshal(map[string]string{"query": query})
		if err != nil {
			return fmt.Errorf("marshal mutation: %w", err)
		}

		req, err := http.NewRequest( //nolint:noctx
			http.MethodPost,
			constellationURL,
			bytes.NewReader(body),
		)
		if err != nil {
			return fmt.Errorf("create request: %w", err)
		}

		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("x-hasura-admin-secret", adminSecret)

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return fmt.Errorf("send mutation: %w", err)
		}
		defer resp.Body.Close()

		return nil
	}
}

// initWithAdmin builds a connection_init payload with admin credentials.
func initWithAdmin() jsontext.Value {
	payload, _ := json.Marshal(map[string]any{
		"headers": map[string]string{
			"x-hasura-admin-secret": adminSecret,
		},
	})

	return payload
}

// initWithRole builds a connection_init payload for a specific role.
// Session variables are passed as a map (keys should include the x-hasura- prefix).
func initWithRole(role string, sessionVars map[string]string) jsontext.Value {
	headers := map[string]string{
		"x-hasura-admin-secret": adminSecret,
		"x-hasura-role":         role,
	}

	maps.Copy(headers, sessionVars)

	payload, _ := json.Marshal(map[string]any{
		"headers": headers,
	})

	return payload
}

// subscribePayload builds a subscribe message payload from a query string.
func subscribePayload(query string) jsontext.Value {
	payload, _ := json.Marshal(map[string]string{"query": query})

	return payload
}

// subscribePayloadWithVars builds a subscribe message payload with query and variables.
func subscribePayloadWithVars(query string, variables map[string]any) jsontext.Value {
	payload, _ := json.Marshal(map[string]any{
		"query":     query,
		"variables": variables,
	})

	return payload
}

// expectError asserts that msg is an error message for the given subscription ID
// and that the error text contains wantSubstr (if non-empty).
func expectError(t *testing.T, msg subtest.Message, id string, wantSubstr string) { //nolint:unparam
	t.Helper()

	if msg.Type != subtest.Error {
		t.Fatalf("expected error message, got type=%s payload=%s", msg.Type, string(msg.Payload))
	}

	if msg.ID != id {
		t.Fatalf("expected error for id=%s, got id=%s", id, msg.ID)
	}

	if wantSubstr != "" {
		var errs []map[string]any
		if err := json.Unmarshal(msg.Payload, &errs); err != nil {
			t.Fatalf("could not unmarshal error payload: %v", err)
		}

		if len(errs) == 0 {
			t.Fatal("empty error payload")
		}

		errMsg, _ := errs[0]["message"].(string)
		if !strings.Contains(errMsg, wantSubstr) {
			t.Fatalf("error message %q does not contain %q", errMsg, wantSubstr)
		}
	}
}
