package dockercompose

import (
	"fmt"
	"os"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/schema/appconfig"
)

func postgres( //nolint:funlen
	cfg *model.ConfigConfig,
	port uint,
	dataFolder string,
) (*Service, error) {
	if err := os.MkdirAll(fmt.Sprintf("%s/db/pgdata", dataFolder), 0o755); err != nil { //nolint:gomnd
		return nil, fmt.Errorf("failed to create postgres data folder: %w", err)
	}

	f, err := os.Create(fmt.Sprintf("%s/db/pg_hba_local.conf", dataFolder))
	if err != nil {
		return nil, fmt.Errorf("failed to create pg_hba_local.conf: %w", err)
	}
	defer f.Close()

	if _, err := f.WriteString(
		"local all all trust\nhost all all all trust\n", //nolint:dupword
	); err != nil {
		return nil, fmt.Errorf("failed to write to pg_hba_local.conf: %w", err)
	}

	envars, err := appconfig.PostgresEnv(
		"local",
		"postgres",
		"postgres",
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get postgres env vars: %w", err)
	}

	env := make(map[string]string, len(envars))
	for _, v := range envars {
		env[v.Name] = v.Value
	}

	return &Service{
		Image:      fmt.Sprintf("nhost/postgres:%s", *cfg.GetPostgres().GetVersion()),
		DependsOn:  nil,
		EntryPoint: nil,
		Command: []string{
			"postgres",
			"-c", "config_file=/etc/postgresql.conf",
			"-c", "hba_file=/etc/pg_hba_local.conf",
		},
		Environment: env,
		ExtraHosts:  extraHosts(),
		HealthCheck: &HealthCheck{
			Test: []string{
				"CMD-SHELL", "pg_isready -U postgres", "-d", "postgres", "-q",
			},
			Timeout:     "60s",
			Interval:    "5s",
			StartPeriod: "60s",
		},
		Labels: nil,
		Ports: []Port{
			{
				Mode:      "ingress",
				Target:    postgresPort,
				Published: fmt.Sprintf("%d", port),
				Protocol:  "tcp",
			},
		},
		Restart: "always",
		Volumes: []Volume{
			{
				Type:   "bind",
				Source: fmt.Sprintf("%s/db/pgdata", dataFolder),
				Target: "/var/lib/postgresql/data/pgdata",
			},
			{
				Type:   "bind",
				Source: fmt.Sprintf("%s/db/pg_hba_local.conf", dataFolder),
				Target: "/etc/pg_hba_local.conf",
			},
		},
		WorkingDir: nil,
	}, nil
}
