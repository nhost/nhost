package dockercompose //nolint:testpackage

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/be/services/mimir/model"
)

func expectedPostgres(tmpdir string) *Service {
	return &Service{
		Image: "nhost/postgres:14.5-20220831-1",
		Command: []string{
			"postgres", "-c", "config_file=/etc/postgresql.conf", "-c",
			"hba_file=/etc/pg_hba_local.conf",
		},
		DependsOn:  nil,
		EntryPoint: nil,
		Environment: map[string]string{
			"PGDATA":                "/var/lib/postgresql/data/pgdata",
			"POSTGRES_DB":           "local",
			"POSTGRES_DEV_INSECURE": "true",
			"POSTGRES_PASSWORD":     "postgres",
			"POSTGRES_USER":         "postgres",
		},
		ExtraHosts: []string{
			"host.docker.internal:host-gateway",
			"dev.auth.local.nhost.run:host-gateway",
			"dev.db.local.nhost.run:host-gateway",
			"dev.functions.local.nhost.run:host-gateway",
			"dev.graphql.local.nhost.run:host-gateway",
			"dev.hasura.local.nhost.run:host-gateway",
			"dev.storage.local.nhost.run:host-gateway",
			"local.auth.nhost.run:host-gateway",
			"local.db.nhost.run:host-gateway",
			"local.functions.nhost.run:host-gateway",
			"local.graphql.nhost.run:host-gateway",
			"local.hasura.nhost.run:host-gateway",
			"local.storage.nhost.run:host-gateway",
		},
		HealthCheck: &HealthCheck{
			Test:        []string{"CMD-SHELL", "pg_isready -U postgres", "-d", "postgres", "-q"},
			Timeout:     "60s",
			Interval:    "5s",
			StartPeriod: "60s",
		},
		Labels:  nil,
		Ports:   []Port{{Mode: "ingress", Target: 5432, Published: "5432", Protocol: "tcp"}},
		Restart: "always",
		Volumes: []Volume{
			{
				Type:     "volume",
				Source:   "pgdate_test",
				Target:   "/var/lib/postgresql/data/pgdata",
				ReadOnly: ptr(false),
			},
			{
				Type:     "bind",
				Source:   filepath.Join(tmpdir, "db/pg_hba_local.conf"),
				Target:   "/etc/pg_hba_local.conf",
				ReadOnly: ptr(false),
			},
		},
		WorkingDir: nil,
	}
}

func TestPostgres(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		cfg      func() *model.ConfigConfig
		expected func(tmpdir string) *Service
	}{
		{
			name:     "success",
			cfg:      getConfig,
			expected: expectedPostgres,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			tmpdir := filepath.Join(os.TempDir(), "data")

			got, err := postgres(tc.cfg(), "dev", 5432, tmpdir, "pgdate_test")
			if err != nil {
				t.Errorf("got error: %v", err)
			}

			if diff := cmp.Diff(tc.expected(tmpdir), got); diff != "" {
				t.Error(diff)
			}
		})
	}
}
