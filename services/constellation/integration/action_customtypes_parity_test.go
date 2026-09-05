package integration_test

import "testing"

// Custom-types metadata parity. set_custom_types is a full replace of just the
// custom_types block (it neither touches remote schemas nor needs the heavy
// baseline strip/restore the execution harness uses), so each case simply
// applies the same set_custom_types to BOTH engines, compares the HTTP status
// CLASS (accept vs reject), and resets custom_types to empty afterwards.
//
// Ported from Hasura TestSetCustomTypes (reuse_pgscalars / reuse_unknown_pgscalar /
// create_action_pg_scalar). Relationship cases (list_type_relationship,
// drop_relationship) are covered with the action-relationship work in #14.

type customTypesParityCase struct {
	name string
	// args is the `args` object for set_custom_types, applied to both engines.
	args string
	// knownDivergence documents an accepted accept/reject difference; the case
	// passes while it persists and FAILS if it disappears (forcing removal of the
	// stale entry).
	knownDivergence string
}

func TestActionCustomTypesParity(t *testing.T) {
	if !parityEnvReady() {
		t.Skipf("DB-source Constellation not reachable at %s; run `make parity-env-up`", constellationMetadataURL)
	}

	if !hasuraReady() {
		t.Skipf("parity Hasura not reachable at %s", hasuraMetadataURL)
	}

	const emptyCustomTypes = `{"type":"set_custom_types","args":{}}`

	// Leave both engines with empty custom_types when done.
	t.Cleanup(func() {
		postMetadata(t, hasuraMetadataURL, emptyCustomTypes)
		postMetadata(t, constellationMetadataURL, emptyCustomTypes)
	})

	cases := []customTypesParityCase{
		{
			name: "pg_scalar_uuid",
			args: `{"scalars":[],"enums":[],"input_objects":[],"objects":[` +
				`{"name":"PgObj","fields":[{"name":"user_id","type":"uuid!"},{"name":"label","type":"String!"}]}]}`,
		},
		{
			name: "valid_enum_input_object_scalar",
			args: `{"scalars":[{"name":"MyScalar"}],` +
				`"enums":[{"name":"Color","values":[{"value":"RED"},{"value":"GREEN"}]}],` +
				`"input_objects":[{"name":"InGreeting","fields":[{"name":"text","type":"String!"}]}],` +
				`"objects":[{"name":"Greeting","fields":[{"name":"text","type":"String!"},{"name":"tone","type":"Color"}]}]}`,
		},
		{
			name: "unknown_type_reference",
			args: `{"scalars":[],"enums":[],"input_objects":[],"objects":[` +
				`{"name":"PgObj","fields":[{"name":"x","type":"unknown_type"}]}]}`,
			knownDivergence: "Hasura rejects custom types referencing an undefined type " +
				"(400 invalid-configuration); Constellation accepts them (no custom-types " +
				"type-reference validation). See task #17 / #9.",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			body := `{"type":"set_custom_types","args":` + tc.args + `}`

			hStatus, hResp := postMetadata(t, hasuraMetadataURL, body)
			cStatus, cResp := postMetadata(t, constellationMetadataURL, body)

			// Reset both regardless of outcome so cases stay independent.
			postMetadata(t, hasuraMetadataURL, emptyCustomTypes)
			postMetadata(t, constellationMetadataURL, emptyCustomTypes)

			hOK, cOK := hStatus/100 == 2, cStatus/100 == 2

			if tc.knownDivergence != "" {
				if hOK == cOK {
					t.Errorf("%s: known divergence appears RESOLVED (%q) — remove the allowlist entry",
						tc.name, tc.knownDivergence)
				} else {
					t.Logf("%s: accepted known divergence: %s\n  hasura: %d %s\n  constellation: %d %s",
						tc.name, tc.knownDivergence, hStatus, hResp, cStatus, cResp)
				}

				return
			}

			if hOK != cOK {
				t.Errorf("%s: accept/reject differs (hasura=%d ok=%v, constellation=%d ok=%v)\n  hasura: %s\n  constellation: %s",
					tc.name, hStatus, hOK, cStatus, cOK, hResp, cResp)
			}
		})
	}
}
