package schemas

import (
	"github.com/nhost/nhost/cli/mcp/nhost/graphql"
)

func (t *Tool) handleGraphqlManagementSchema() string {
	return graphql.Schema
}
