package compose

import (
	"fmt"
	"github.com/compose-spec/compose-go/types"
)

func (c Config) traefikService() *types.ServiceConfig {
	return &types.ServiceConfig{
		Name:    SvcTraefik,
		Image:   "traefik:v2.8",
		Restart: types.RestartPolicyAlways,
		Ports: []types.ServicePortConfig{
			{
				Mode:      "ingress",
				Target:    proxyPort,
				Published: fmt.Sprint(c.ports.Proxy()),
				Protocol:  "tcp",
			},
			{
				Mode:      "ingress",
				Target:    proxySSLPort,
				Published: fmt.Sprint(c.ports.SSLProxy()),
				Protocol:  "tcp",
			},
			{
				Mode:     "ingress",
				Target:   traefikUIPort,
				Protocol: "tcp",
			},
		},
		Volumes: []types.ServiceVolumeConfig{
			{
				Type:     types.VolumeTypeBind,
				Source:   "/var/run/docker.sock",
				Target:   "/var/run/docker.sock",
				ReadOnly: true,
			},
			{
				Type:   types.VolumeTypeBind,
				Source: "traefik",
				Target: "/opt/traefik",
			},
		},
		Command: []string{
			"--api.insecure=true",
			"--providers.docker=true",
			"--providers.file.directory=/opt/traefik",
			"--providers.file.watch=true",
			"--providers.docker.exposedbydefault=false",
			fmt.Sprintf("--providers.docker.constraints=Label(`com.docker.compose.project`,`%s`)", c.composeProjectName),
			fmt.Sprintf("--entrypoints.web-secure.address=:%d", proxySSLPort), // entrypoint for https services
			fmt.Sprintf("--entrypoints.web.address=:%d", proxyPort),           // deprecated entrypoint for http services
		},
	}
}
