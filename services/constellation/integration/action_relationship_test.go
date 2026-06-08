package integration_test

import (
	"net/http"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/nhost/nhost/services/constellation/metadata"
)

func TestActionRelationships(t *testing.T) { //nolint:paralleltest
	skipUnlessActionGraphQLEndpoints(t)
	withHasuraSyncActionMetadata(t)
	waitForConstellationActionRelationshipSchema(t)

	tc := TestCase{
		name: "sync action relationships",
		query: query{
			Query: `query ActionRelationships {
				actionProfiles {
					label
					user {
						id
						displayName
					}
					departments {
						department_id
						role
						department {
							name
						}
					}
					departments_aggregate {
						aggregate {
							count
						}
					}
				}
			}`,
			Role: metadata.RoleAdmin,
		},
		responseNormalizer: normalizeActionRelationshipResponse,
	}

	compareActionResponses(t, tc, http.Header{})
}

func waitForConstellationActionRelationshipSchema(t *testing.T) {
	t.Helper()

	probe := query{
		Query: `query ActionRelationshipSchemaReady {
			actionProfile: __type(name: "ActionProfile") { fields { name } }
		}`,
		Role: metadata.RoleAdmin,
	}

	deadline := time.Now().Add(10 * time.Second)

	var last any
	for time.Now().Before(deadline) {
		resp, err := makeHTTPQuery(
			t.Context(),
			constellationURL,
			probe,
			http.Header{"x-hasura-admin-secret": []string{adminSecret}},
		)
		if err == nil && responseHasIntrospectionField(resp, "actionProfile", "user") &&
			responseHasIntrospectionField(resp, "actionProfile", "departments") &&
			responseHasIntrospectionField(resp, "actionProfile", "departments_aggregate") {
			return
		}

		last = resp

		time.Sleep(200 * time.Millisecond)
	}

	t.Fatalf("constellation did not expose action relationship schema: %#v", last)
}

func normalizeActionRelationshipResponse(value any) any {
	out := redactResponseValue(value, nil, func([]string, any) (any, bool) {
		return nil, false
	})

	response, ok := out.(map[string]any)
	if !ok {
		return out
	}

	data, ok := response["data"].(map[string]any)
	if !ok {
		return out
	}

	profiles, ok := data["actionProfiles"].([]any)
	if !ok {
		return out
	}

	slices.SortFunc(profiles, compareJSONObjectsByStringField("label"))

	for _, rawProfile := range profiles {
		profile, ok := rawProfile.(map[string]any)
		if !ok {
			continue
		}

		departments, ok := profile["departments"].([]any)
		if ok {
			slices.SortFunc(departments, compareJSONObjectsByStringField("department_id"))
		}
	}

	return out
}

func compareJSONObjectsByStringField(field string) func(any, any) int {
	return func(a, b any) int {
		return strings.Compare(jsonObjectStringField(a, field), jsonObjectStringField(b, field))
	}
}

func jsonObjectStringField(value any, field string) string {
	m, ok := value.(map[string]any)
	if !ok {
		return ""
	}

	v, _ := m[field].(string)

	return v
}
