package dev //nolint:testpackage

import (
	"testing"

	"github.com/nhost/nhost/cli/dockercompose"
	"github.com/nhost/nhost/cli/tui"
)

func TestAttachAppConfigUsesLocalDevelopmentConfig(t *testing.T) {
	t.Parallel()

	dc := dockercompose.New("", "", "project")
	localConfig := dockercompose.LocalDevelopmentConfig{
		HTTPPort:     8080,
		UseTLS:       false,
		PostgresPort: 15432,
	}
	versions := map[string]tui.ServiceVersion{
		"graphql": {
			Current:     "v1",
			Recommended: "v1",
			OK:          true,
		},
	}
	mcp := tui.MCPStatus{
		Configured: true,
		Projects:   []string{"local"},
	}

	cfg := attachAppConfig(statusTestEnv(), dc, localConfig, versions, mcp)

	if cfg.HTTPPort != localConfig.HTTPPort {
		t.Errorf("expected HTTP port %d, got %d", localConfig.HTTPPort, cfg.HTTPPort)
	}

	if cfg.UseTLS != localConfig.UseTLS {
		t.Errorf("expected TLS mode %t, got %t", localConfig.UseTLS, cfg.UseTLS)
	}

	if cfg.PostgresPort != localConfig.PostgresPort {
		t.Errorf(
			"expected Postgres port %d, got %d",
			localConfig.PostgresPort,
			cfg.PostgresPort,
		)
	}
}
