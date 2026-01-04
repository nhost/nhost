package dockercompose

import (
	"fmt"
	"os"
	"strconv"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/schema/appconfig"
)

func postgres( //nolint:funlen
	cfg *model.ConfigConfig,
	subdomain string,
	port uint,
	dataFolder string,
	volumeName string,
) (*Service, error) {
	if err := os.MkdirAll(dataFolder+"/db", 0o755); err != nil { //nolint:mnd
		return nil, fmt.Errorf("failed to create postgres data folder: %w", err)
	}

	f, err := os.Create(dataFolder + "/db/pg_hba_local.conf")
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
		cfg,
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

	env["POSTGRES_DEV_INSECURE"] = "true"

	return &Service{
		Image:      "nhost/postgres:" + *cfg.GetPostgres().GetVersion(),
		DependsOn:  nil,
		EntryPoint: nil,
		Command: []string{
			"postgres",
			"-c", "config_file=/etc/postgresql.conf",
			"-c", "hba_file=/etc/pg_hba_local.conf",
		},
		Environment: env,
		ExtraHosts:  extraHosts(subdomain),
		HealthCheck: &HealthCheck{
			Test: []string{
				"CMD-SHELL", "pg_isready -U postgres -d postgres -q",
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
				Published: strconv.FormatUint(uint64(port), 10),
				Protocol:  "tcp",
			},
		},
		Restart: "always",
		Volumes: []Volume{
			{
				Type:     "volume",
				Source:   volumeName,
				Target:   "/var/lib/postgresql/data/pgdata",
				ReadOnly: ptr(false),
			},
			{
				Type:     "bind",
				Source:   dataFolder + "/db/pg_hba_local.conf",
				Target:   "/etc/pg_hba_local.conf",
				ReadOnly: ptr(false),
			},
		},
		WorkingDir: nil,
	}, nil
}
