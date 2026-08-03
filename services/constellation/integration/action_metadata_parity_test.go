package integration_test

import (
	"fmt"
	"testing"
)

// Action METADATA-API parity (ported from Hasura TestActionsMetadata):
// recreate_permission and create_with_headers. These are /v1/metadata ops, so
// the comparison is the HTTP status CLASS (accept vs reject) on each engine.
//
// create_action makes Hasura re-validate remote schemas (slow/hangs), so both
// engines are reset once to a remote-schema-stripped baseline and the full
// originals are restored at the end (via the shared helpers in
// action_parity_test.go).

// compareOpClass posts the same metadata op to both engines and asserts the
// same accept/reject class, honouring a knownDivergence.
func compareOpClass(t *testing.T, label, body, knownDivergence string) {
	t.Helper()

	hStatus, hResp := postMetadata(t, hasuraMetadataURL, body)
	cStatus, cResp := postMetadata(t, constellationMetadataURL, body)
	hOK, cOK := hStatus/100 == 2, cStatus/100 == 2

	if knownDivergence != "" {
		if hOK == cOK {
			t.Errorf("%s: known divergence appears RESOLVED (%q) — remove the allowlist entry",
				label, knownDivergence)
		} else {
			t.Logf("%s: accepted known divergence: %s\n  hasura: %d %s\n  constellation: %d %s",
				label, knownDivergence, hStatus, hResp, cStatus, cResp)
		}

		return
	}

	if hOK != cOK {
		t.Errorf(
			"%s: accept/reject differs (hasura=%d ok=%v, constellation=%d ok=%v)\n  hasura: %s\n  constellation: %s",
			label,
			hStatus,
			hOK,
			cStatus,
			cOK,
			hResp,
			cResp,
		)
	}
}

func TestActionMetadataParity(t *testing.T) {
	if !parityEnvReady() {
		t.Skipf(
			"DB-source Constellation not reachable at %s; run `make parity-env-up`",
			constellationMetadataURL,
		)
	}

	if !hasuraReady() {
		t.Skipf("parity Hasura not reachable at %s", hasuraMetadataURL)
	}

	engines := []string{hasuraMetadataURL, constellationMetadataURL}

	hOrig := exportMetadataObject(t, hasuraMetadataURL)
	cOrig := exportMetadataObject(t, constellationMetadataURL)

	t.Cleanup(func() {
		restoreFullMetadata(t, hasuraMetadataURL, hOrig)
		restoreFullMetadata(t, constellationMetadataURL, cOrig)
	})

	resetMetadata(t, hasuraMetadataURL, withoutRemoteSchemas(t, hOrig))
	resetMetadata(t, constellationMetadataURL, withoutRemoteSchemas(t, cOrig))

	const reflectOut = `{"scalars":[],"enums":[],"input_objects":[],"objects":[` +
		`{"name":"ReflectOut","fields":[{"name":"id","type":"String!"}]}]}`

	// recreate_permission: create -> drop -> recreate an action permission, each a
	// 2xx on both engines (Hasura issue #4377).
	t.Run("permission_create_drop_recreate", func(t *testing.T) {
		action := `{"name":"permAction","definition":{"kind":"synchronous","type":"mutation",` +
			`"handler":"` + actionWebhookURL + `","output_type":"ReflectOut",` +
			`"arguments":[{"name":"x","type":"String!"}],` + webhookSecretHeaderJSON + `}}`

		for _, url := range engines {
			mustOK(t, url, `{"type":"set_custom_types","args":`+reflectOut+`}`)
			mustOK(t, url, `{"type":"create_action","args":`+action+`}`)
		}

		t.Cleanup(func() {
			for _, url := range engines {
				postMetadata(t, url, `{"type":"drop_action","args":{"name":"permAction"}}`)
			}
		})

		create := `{"type":"create_action_permission","args":{"action":"permAction","role":"user"}}`
		drop := `{"type":"drop_action_permission","args":{"action":"permAction","role":"user"}}`

		compareOpClass(t, "create_permission", create, "")
		compareOpClass(t, "drop_permission", drop, "")
		compareOpClass(t, "recreate_permission", create, "")
	})

	// create_with_headers: a value_from_env referencing a HASURA_GRAPHQL_* var is
	// rejected by Hasura as a security guard (parse-failed).
	t.Run("hasura_graphql_env_header_guard", func(t *testing.T) {
		for _, url := range engines {
			mustOK(t, url, `{"type":"set_custom_types","args":`+reflectOut+`}`)
		}

		t.Cleanup(func() {
			for _, url := range engines {
				postMetadata(t, url, `{"type":"drop_action","args":{"name":"hdrAction"}}`)
			}
		})

		body := fmt.Sprintf(
			`{"type":"create_action","args":{"name":"hdrAction","definition":{`+
				`"kind":"synchronous","type":"mutation","handler":%q,"output_type":"ReflectOut",`+
				`"arguments":[{"name":"x","type":"String!"}],`+
				`"headers":[{"name":"x-client-id","value_from_env":"HASURA_GRAPHQL_CLIENT_NAME"}]}}}`,
			actionWebhookURL,
		)

		// Both engines now reject this (constellation gained the parse-failed guard
		// in #17), so this is plain parity.
		compareOpClass(t, "hasura_graphql_env_header", body, "")
	})
}
