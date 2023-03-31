package compose

import (
	"fmt"
	"github.com/compose-spec/compose-go/types"
	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/nhost/envvars"
)

const (
	envMinioRootUser     = "MINIO_ROOT_USER"
	envMinioRootPassword = "MINIO_ROOT_PASSWORD"
)

func (c Config) minioServiceEnvs() envvars.Env {
	return envvars.Env{
		envMinioRootUser:     escapeDollarSignForDockerCompose(nhost.MINIO_USER),
		envMinioRootPassword: escapeDollarSignForDockerCompose(nhost.MINIO_PASSWORD),
	}.Merge(c.nhostSystemEnvs(), c.globalEnvs)
}

func (c Config) minioService() *types.ServiceConfig {
	return &types.ServiceConfig{
		Name:        SvcMinio,
		Environment: c.minioServiceEnvs().ToDockerServiceConfigEnv(),
		Restart:     types.RestartPolicyAlways,
		Image:       "minio/minio:RELEASE.2022-07-08T00-05-23Z",
		Command:     []string{"server", "/data", "--address", "0.0.0.0:9000", "--console-address", "0.0.0.0:8484"},
		Ports: []types.ServicePortConfig{
			{
				Mode:      "ingress",
				Target:    minioS3Port,
				Published: fmt.Sprint(c.ports.MinioS3()),
				Protocol:  "tcp",
			},
			{
				Mode:     "ingress",
				Target:   minioUIPort,
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
