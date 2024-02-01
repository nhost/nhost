package dockercompose

import (
	"fmt"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/schema/appconfig"
)

func authPatch022(svc Service, useTLS bool) *Service {
	svc.Labels = Ingresses{
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
	}.Labels()

	return &svc
}

func auth( //nolint:funlen
	cfg *model.ConfigConfig,
	httpPort uint,
	useTLS bool,
	nhostFolder string,
	port uint,
) (*Service, error) {
	envars, err := appconfig.HasuraAuthEnv(
		cfg,
		"http://graphql:8080/v1/graphql",
		URL("auth", httpPort, useTLS)+"/v1", //nolint:goconst
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
	svc := &Service{
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
				Name:    "auth",
				TLS:     useTLS,
				Rule:    "Host(`local.auth.nhost.run`)",
				Port:    authPort,
				Rewrite: nil,
			},
		}.Labels(),
		Ports:   ports(port, authPort),
		Restart: "always",
		Volumes: []Volume{
			{
				Type:     "bind",
				Source:   fmt.Sprintf("%s/emails", nhostFolder),
				Target:   "/app/email-templates",
				ReadOnly: ptr(false),
			},
		},
		WorkingDir: nil,
	}

	if appconfig.CompareVersions(*cfg.Auth.Version, "0.21.999999999") <= 0 {
		svc = authPatch022(*svc, useTLS)
	}

	return svc, nil
}
