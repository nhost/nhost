package dockercompose

import (
	"fmt"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/schema/appconfig"
)

func auth( //nolint:funlen
	cfg *model.ConfigConfig,
	httpPort uint,
	useTLS bool,
	nhostFolder string,
) (*Service, error) {
	envars, err := appconfig.HasuraAuthEnv(
		cfg,
		"http://graphql:8080/v1/graphql",
		URL("auth", httpPort, useTLS)+"/v1",
		"postgres://nhost_auth_admin@postgres:5432/local",
		&model.ConfigSmtp{
			User:     "user",
			Password: "password",
			Sender:   "hasura-auth@example.com",
			Host:     "mailhog",
			Port:     1025, //nolint:gomnd
			Secure:   false,
			Method:   "LOGIN",
		},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get hasura env vars: %w", err)
	}

	env := make(map[string]string, len(envars))
	for _, v := range envars {
		env[v.Name] = v.Value
	}
	return &Service{
		Image: fmt.Sprintf("nhost/hasura-auth:%s", *cfg.Auth.Version),
		DependsOn: map[string]DependsOn{
			"graphql": {
				Condition: "service_healthy",
			},
			"postgres": {
				Condition: "service_healthy",
			},
		},
		EntryPoint:  nil,
		Command:     nil,
		Environment: env,
		ExtraHosts:  extraHosts(),
		HealthCheck: &HealthCheck{
			Test:        []string{"CMD", "wget", "--spider", "-S", "http://localhost:4000/healthz"},
			Timeout:     "60s",
			Interval:    "5s",
			StartPeriod: "60s",
		},
		Labels: Ingresses{
			{
				Name: "auth",
				TLS:  useTLS,
				Rule: "Host(`local.auth.nhost.run`) && PathPrefix(`/v1`)",
				Port: authPort,
				Rewrite: &Rewrite{
					Regex:       "/v1(/|$$)(.*)",
					Replacement: "/$$2",
				},
			},
		}.Labels(),
		Ports:   []Port{},
		Restart: "always",
		Volumes: []Volume{
			{
				Type:   "bind",
				Source: fmt.Sprintf("%s/emails", nhostFolder),
				Target: "/app/email-templates",
			},
		},
		WorkingDir: nil,
	}, nil
}
