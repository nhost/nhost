package api

import (
	_ "embed"
)

//go:embed openapi.yaml
var OpenAPISchema []byte

const FakeProvider = Provider("fake")
