//go:generate oapi-codegen -generate types,client -response-type-suffix R -package graphql -o graphql.gen.go openapi.yaml
package graphql

import (
	_ "embed"
)

//go:embed openapi.yaml
var Schema string
