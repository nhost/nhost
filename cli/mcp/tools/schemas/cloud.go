package schemas

import (
	_ "embed"
	"errors"
)

//go:embed cloud_schema.graphql
var schemaGraphql string

//go:embed cloud_schema-with-mutations.graphql
var schemaGraphqlWithMutations string

func (t *Tool) handleResourceCloud() (string, error) {
	if t.cfg.Cloud == nil {
		return "", errors.New("nhost cloud is not configured") //nolint:err113
	}

	schema := schemaGraphql
	if t.cfg.Cloud.EnableMutations {
		schema = schemaGraphqlWithMutations
	}

	return schema, nil
}
