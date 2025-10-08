package resources

import (
	"github.com/mark3labs/mcp-go/server"
	"github.com/nhost/nhost/cli/mcp/config"
)

func Register(cfg *config.Config, server *server.MCPServer) error {
	nt := NewNhostToml()
	nt.Register(server)

	if cfg.Cloud != nil {
		ct := NewCloud(cfg)
		ct.Register(server)
	}

	enableGraphlManagement := false
	for _, project := range cfg.Projects {
		if project.ManageMetadata {
			enableGraphlManagement = true
			break
		}
	}

	if enableGraphlManagement {
		gmt := NewGraphqlManagement()
		gmt.Register(server)
	}

	return nil
}
