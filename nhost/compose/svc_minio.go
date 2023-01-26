package compose

import (
	"fmt"
	"github.com/compose-spec/compose-go/types"
	"github.com/nhost/cli/nhost"
)

const (
	envMinioRootUser     = "MINIO_ROOT_USER"
	envMinioRootPassword = "MINIO_ROOT_PASSWORD"
)

func (c Config) minioServiceEnvs() env {
	e := env{
		envMinioRootUser:     nhost.MINIO_USER,
		envMinioRootPassword: nhost.MINIO_PASSWORD,
	}
	e.merge(c.serviceConfigEnvs(SvcMinio))
	e.mergeWithSlice(c.dotenv)
	return e
}

func (c Config) RunMinioService() bool {
	if conf, ok := c.nhostConfig.Services[SvcMinio]; ok && conf != nil {
		if conf.NoContainer {
			return false
		}
	}

	return true
}

func (c Config) minioService() *types.ServiceConfig {
	if !c.RunMinioService() {
		return nil
	}

	return &types.ServiceConfig{
		Name:        SvcMinio,
		Environment: c.minioServiceEnvs().dockerServiceConfigEnv(),
		Restart:     types.RestartPolicyAlways,
		Image:       c.serviceDockerImage(SvcMinio, svcMinioDefaultImage),
		Command:     []string{"server", "/data", "--address", "0.0.0.0:9000", "--console-address", "0.0.0.0:8484"},
		Ports: []types.ServicePortConfig{
			{
				Mode:      "ingress",
				Target:    9000,
				Published: fmt.Sprint(c.ports.MinioS3()),
				Protocol:  "tcp",
			},
			{
				Mode:     "ingress",
				Target:   8484,
				Protocol: "tcp",
			},
		},
		Volumes: []types.ServiceVolumeConfig{
			{
				Type:   types.VolumeTypeBind,
				Source: MinioDataDirGitBranchScopedPath(c.gitBranch),
				Target: "/data",
			},
		},
	}
}
