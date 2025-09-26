package main

import (
	"os"

	"github.com/nhost/nhost/services/storage/cmd"
)

//go:generate oapi-codegen -config api/server.cfg.yaml controller/openapi.yaml
//go:generate oapi-codegen -config api/types.cfg.yaml controller/openapi.yaml
//go:generate gqlgenc
func main() {
	if err := cmd.Execute(); err != nil {
		os.Exit(1)
	}
}
