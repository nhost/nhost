package docs

import (
	"github.com/nhost/nhost/cli/pkg/docssearch"
)

// Re-export types and functions from the shared package for convenience.
type (
	Config    = docssearch.Config
	PageEntry = docssearch.PageEntry
)

var (
	LoadDocsIndex    = docssearch.LoadConfig
	ExtractPages     = docssearch.ExtractPages
	GetAllPagePaths  = docssearch.GetAllPagePaths
	isDeprecatedPath = docssearch.IsDeprecatedPath
)
