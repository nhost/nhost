package api_test

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/api"
)

func TestEmbeddedSpecIncludesManuallyMountedGraphQLContract(t *testing.T) {
	t.Parallel()

	spec, err := api.GetSpec()
	if err != nil {
		t.Fatalf("loading embedded OpenAPI spec: %v", err)
	}

	graphqlPath, ok := spec.Paths.Map()["/v1/graphql"]
	if !ok {
		t.Fatal("embedded OpenAPI spec is missing /v1/graphql")
	}

	if graphqlPath.Get == nil {
		t.Error("embedded OpenAPI spec is missing GET /v1/graphql")
	}

	if graphqlPath.Post == nil {
		t.Error("embedded OpenAPI spec is missing POST /v1/graphql")
	}

	for _, schemaName := range []string{"GraphQLRequest", "GraphQLResponse"} {
		if _, ok := spec.Components.Schemas[schemaName]; !ok {
			t.Errorf("embedded OpenAPI spec is missing %s schema", schemaName)
		}
	}
}
