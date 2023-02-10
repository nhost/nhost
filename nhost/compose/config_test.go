package compose

import (
	"github.com/compose-spec/compose-go/types"
	"github.com/nhost/cli/internal/ports"
	"github.com/nhost/cli/nhost"
	"github.com/stretchr/testify/assert"
	"testing"
)

func TestConfig_dashboardService(t *testing.T) {
	assert := assert.New(t)

	c := &Config{
		nhostConfig: &nhost.Configuration{Services: make(map[string]*nhost.Service)},
		dotenv:      []string{"FOO=BAR", "BAR=BAZ"},
		ports: ports.NewPorts(
			1, 2, 3, 4, 5, 6, 7, 8, 9,
		),
	}

	svc := c.dashboardService()
	assert.Equal("dashboard", svc.Name)
	assert.Equal("nhost/dashboard:0.11.6", svc.Image)
	assert.Equal([]types.ServicePortConfig{
		{
			Mode:      "ingress",
			Target:    3000,
			Published: "9",
			Protocol:  "tcp",
		},
	}, svc.Ports)
	assert.Equal(types.NewMappingWithEquals([]string{
		"FOO=BAR",
		"BAR=BAZ",
		"NEXT_PUBLIC_NHOST_LOCAL_BACKEND_PORT=1",
		"NEXT_PUBLIC_NHOST_HASURA_PORT=4",
		"NEXT_PUBLIC_NHOST_MIGRATIONS_PORT=5",
		"NEXT_PUBLIC_NHOST_PLATFORM=false",
		"NEXT_PUBLIC_ENV=dev",
		"NEXT_TELEMETRY_DISABLED=1",
	}), svc.Environment)
}

func TestConfig_addLocaldevExtraHost(t *testing.T) {
	t.Parallel()
	assert := assert.New(t)
	c := &Config{}
	svc := &types.ServiceConfig{}
	c.addLocaldevExtraHost(svc)

	assert.Equal(svc.ExtraHosts["host.docker.internal"], "host-gateway")
}
