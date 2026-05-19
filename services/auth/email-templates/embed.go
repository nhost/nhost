// Package emailtemplates exposes the default Nhost Auth email templates as an
// embedded filesystem so consumers (e.g. the CLI) can bundle them at build
// time instead of fetching them from a remote source at runtime.
package emailtemplates

import "embed"

//go:embed all:bg all:cs all:en all:es all:fr
var FS embed.FS
