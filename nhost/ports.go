package nhost

import (
	"fmt"
	"github.com/nhost/cli/util"
)

const (
	PortProxy            = "port"
	PortDB               = "db-port"
	PortGraphQL          = "graphql-port"
	PortHasuraConsole    = "console-port"
	PortHasuraConsoleAPI = "console-api-port"
	PortSMTP             = "smtp-port"
)

type Ports map[string]uint32

func NewPorts(proxyPort, dbPort, graphqlPort, consolePort, consoleAPIPort, smtpPort uint32) Ports {
	return Ports{
		PortProxy:            proxyPort,
		PortDB:               dbPort,
		PortGraphQL:          graphqlPort,
		PortHasuraConsole:    consolePort,
		PortHasuraConsoleAPI: consoleAPIPort,
		PortSMTP:             smtpPort,
	}
}

func (p Ports) EnsurePortsAvailable() error {
	for name, port := range p {
		if !util.PortAvailable(fmt.Sprint(port)) {
			return fmt.Errorf("port %d is not available, use --%s flag to provide another one", port, name)
		}
	}

	return nil
}

func (p Ports) Proxy() uint32 {
	return p[PortProxy]
}

func (p Ports) DB() uint32 {
	return p.get(PortDB)
}

func (p Ports) GraphQL() uint32 {
	return p.get(PortGraphQL)
}

func (p Ports) HasuraConsole() uint32 {
	return p.get(PortHasuraConsole)
}

func (p Ports) HasuraConsoleAPI() uint32 {
	return p.get(PortHasuraConsoleAPI)
}

func (p Ports) SMTP() uint32 {
	return p.get(PortSMTP)
}

func (p Ports) get(name string) uint32 {
	return p[name]
}
