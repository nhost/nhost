//go:generate oapi-codegen -config server.cfg.yaml openapi.yaml
//go:generate oapi-codegen -config types.cfg.yaml openapi.yaml
package api

import (
	_ "embed"
)

//go:embed openapi.yaml
var OpenAPISchema []byte
