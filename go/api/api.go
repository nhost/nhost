package api

import (
	_ "embed"
)

//go:embed openapi.yaml
var OpenAPISchema []byte

const IdTokenProviderFake = IdTokenProvider("fake") //nolint:revive,stylecheck
