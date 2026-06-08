package integration_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/nhost/nhost/services/constellation/metadata"
)

func TestActionTransforms(t *testing.T) { //nolint:paralleltest
	skipUnlessActionGraphQLEndpoints(t)
	waitForConstellationActionTransformSchema(t)

	tc := TestCase{
		name: "action transforms",
		query: query{
			Query: `query ActionTransforms {
				transformEcho(message: "hello transforms") {
					message
					role
					contentType
				}
			}`,
			Role: "user",
			SessionVariables: map[string]string{
				"user-id": "action-user-123",
			},
		},
	}

	compareActionResponses(t, tc, http.Header{})
}

func waitForConstellationActionTransformSchema(t *testing.T) {
	t.Helper()

	probe := query{
		Query: `query ActionTransformSchemaReady {
			queryRoot: __type(name: "query_root") { fields { name } }
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
		if err == nil && responseHasIntrospectionField(resp, "queryRoot", "transformEcho") {
			return
		}

		last = resp

		time.Sleep(200 * time.Millisecond)
	}

	t.Fatalf("constellation did not expose action transform schema: %#v", last)
}
