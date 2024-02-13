package urn

import scimschema "github.com/leodido/go-urn/scim/schema"

type SCIM struct {
	Type  scimschema.Type
	Name  string
	Other string
	pos   int
}
