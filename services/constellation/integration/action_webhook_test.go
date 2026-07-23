package integration_test

import "testing"

// TestActionWebhookEcho is the smoke test for the action webhook fixture
// (integration/functions/actions.ts, served at /actions). It proves the full
// execution path end-to-end against the DB-source instance: create an echo
// action whose handler is the fixture (with the injected webhook-secret header)
// -> execute the mutation -> the webhook echoes the input back as the output
// object. This is the foundation the ported Hasura action buckets build on.
func TestActionWebhookEcho(t *testing.T) {
	setupActionEnv(t)

	mustMetadataOK(t, `{"type":"set_custom_types","args":{"objects":[`+
		`{"name":"WebhookEchoOutput","fields":[{"name":"message","type":"String!"}]}]}}`)
	mustMetadataOK(t, `{"type":"create_action","args":{"name":"echoWebhook","definition":{`+
		`"kind":"synchronous","type":"mutation",`+
		`"handler":"`+actionWebhookURL+`","output_type":"WebhookEchoOutput",`+
		`"arguments":[{"name":"message","type":"String!"}],`+
		webhookSecretHeaderJSON+`}}}`)

	// Poll until the action is served and the webhook echoes the input (the
	// schema rebuild after a metadata write is asynchronous).
	q := query{Query: `mutation { echoWebhook(message: "hello-fixture") { message } }`}

	resp, ok := pollGraphQL(t, q, adminHeaders(), func(r any) bool {
		return echoedMessage(r, "echoWebhook") == "hello-fixture"
	})
	if !ok {
		t.Fatalf("echoWebhook did not return the echoed message; last response: %v", resp)
	}
}

// echoedMessage extracts data.<field>.message from a GraphQL response.
func echoedMessage(resp any, field string) string {
	m, ok := resp.(map[string]any)
	if !ok {
		return ""
	}

	data, ok := m["data"].(map[string]any)
	if !ok {
		return ""
	}

	out, ok := data[field].(map[string]any)
	if !ok {
		return ""
	}

	msg, _ := out["message"].(string)

	return msg
}
