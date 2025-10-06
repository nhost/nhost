package schemas

import (
	_ "embed"
)

//go:embed nhost_toml_schema.cue
var schemaNhostToml string

//go:generate cp ../../../../vendor/github.com/nhost/be/services/mimir/schema/schema.cue nhost_toml_schema.cue
func (t *Tool) handleSchemaNhostToml() string {
	return schemaNhostToml
}
