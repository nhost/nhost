package ports

import (
	"fmt"
	"github.com/nhost/cli/util"
)

const (
	FlagPortProxy            = "port"
	FlagPortDB               = "db-port"
	FlagPortGraphQL          = "graphql-port"
	FlagPortHasuraConsole    = "console-port"
	FlagPortHasuraConsoleAPI = "console-api-port"
	FlagPortSMTP             = "smtp-port"
	FlagPortMinioS3          = "minio-s3-port"
	FlagPortMailhog          = "mailhog-port"
)

type Ports struct {
	p map[string]uint32
}

func NewPorts(proxyPort, dbPort, graphqlPort, consolePort, consoleAPIPort, smtpPort, minioS3Port, mailhogPort uint32) *Ports {
	return &Ports{
		p: map[string]uint32{
			FlagPortProxy:            proxyPort,
			FlagPortDB:               dbPort,
			FlagPortGraphQL:          graphqlPort,
			FlagPortHasuraConsole:    consolePort,
			FlagPortHasuraConsoleAPI: consoleAPIPort,
			FlagPortSMTP:             smtpPort,
			FlagPortMinioS3:          minioS3Port,
			FlagPortMailhog:          mailhogPort,
		},
	}
}

func (p Ports) EnsurePortsAvailable() error {
	for name, port := range p.p {
		if !util.PortAvailable(fmt.Sprint(port)) {
			return fmt.Errorf("port %d is not available, use --%s flag to provide another one", port, name)
		}
	}

	return nil
}

func (p Ports) Proxy() uint32 {
	return p.get(FlagPortProxy)
}

func (p Ports) DB() uint32 {
	return p.get(FlagPortDB)
}

func (p Ports) GraphQL() uint32 {
	return p.get(FlagPortGraphQL)
}

func (p Ports) HasuraConsole() uint32 {
	return p.get(FlagPortHasuraConsole)
}

func (p Ports) HasuraConsoleAPI() uint32 {
	return p.get(FlagPortHasuraConsoleAPI)
}

func (p Ports) SMTP() uint32 {
	return p.get(FlagPortSMTP)
}

func (p Ports) MinioS3() uint32 {
	return p.get(FlagPortMinioS3)
}

func (p Ports) Mailhog() uint32 {
	return p.get(FlagPortMailhog)
}

func (p Ports) get(name string) uint32 {
	return p.p[name]
}
