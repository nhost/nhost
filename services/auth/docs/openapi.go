package docs

import (
	_ "embed"
)

//go:embed openapi.yaml
var OpenAPISchema []byte
