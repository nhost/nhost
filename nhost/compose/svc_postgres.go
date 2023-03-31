package compose

import (
	"fmt"
	"github.com/compose-spec/compose-go/types"
	"github.com/nhost/cli/internal/generichelper"
	"github.com/nhost/cli/nhost/envvars"
	"time"
)

const (
	envPostgresPassword = "POSTGRES_PASSWORD"
	envPostgresDb       = "POSTGRES_DB"
	envPostgresUser     = "POSTGRES_USER"
	envPostgresData     = "PGDATA"

	// default values
	envPostgresDbDefaultValue       = "postgres"
	envPostgresUserDefaultValue     = "postgres"
	envPostgresPasswordDefaultValue = "postgres"
	envPostgresDataDefaultValue     = "/var/lib/postgresql/data/pgdata"
)

func (c Config) postgresServiceEnvs() envvars.Env {
	return envvars.Env{
		envPostgresData:     envPostgresDataDefaultValue,
		envPostgresUser:     escapeDollarSignForDockerCompose(envPostgresUserDefaultValue),
		envPostgresPassword: escapeDollarSignForDockerCompose(envPostgresPasswordDefaultValue),
		envPostgresDb:       envPostgresDbDefaultValue,
	}.Merge(c.nhostSystemEnvs(), c.globalEnvs)
}

func (c Config) postgresServiceHealthcheck(interval, startPeriod time.Duration) *types.HealthCheckConfig {
	i := types.Duration(interval)
	s := types.Duration(startPeriod)

	e := c.postgresServiceEnvs()
	pgUser := e[envPostgresUser]
	pgDb := e[envPostgresDb]

	return &types.HealthCheckConfig{
		Test:        []string{"CMD-SHELL", fmt.Sprintf("pg_isready -U %s -d %s -q", pgUser, pgDb)},
		Interval:    &i,
		StartPeriod: &s,
	}
}

func (c Config) postgresService() *types.ServiceConfig {
	return &types.ServiceConfig{
		Name: SvcPostgres,
		// keep in mind that the provided postgres image should create schemas and triggers like in https://github.com/nhost/postgres/blob/ea53451b6df9f4b10ce515a2cefbd9ddfdfadb25/v12/db/0001-create-schema.sql
		Image:       "nhost/postgres:" + generichelper.DerefPtr(c.nhostConfig.GetPostgres().GetVersion()),
		Restart:     types.RestartPolicyAlways,
		Environment: c.postgresServiceEnvs().ToDockerServiceConfigEnv(),
		HealthCheck: c.postgresServiceHealthcheck(time.Second*3, time.Minute*2),
		Command: []string{
			"postgres",
			"-c", "config_file=/etc/postgresql.conf",
			"-c", "hba_file=/etc/pg_hba_local.conf",
		},
		Volumes: []types.ServiceVolumeConfig{
			{
				Type:   types.VolumeTypeBind,
				Source: DbDataDirGitBranchScopedPath(c.gitBranch, dataDirPgdata),
				Target: envPostgresDataDefaultValue,
			},
			{
				Type:   types.VolumeTypeBind,
				Source: DbDataDirGitBranchScopedPath(c.gitBranch, "pg_hba_local.conf"),
				Target: "/etc/pg_hba_local.conf",
			},
		},
		Ports: []types.ServicePortConfig{
			{
				Mode:      "ingress",
				Target:    dbPort,
				Published: fmt.Sprint(c.ports.DB()),
				Protocol:  "tcp",
			},
		},
	}
}
