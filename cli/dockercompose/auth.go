package dockercompose

import (
	"fmt"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/schema/appconfig"
)

func traefikHostMatch(name string) string {
	return fmt.Sprintf(
		"(HostRegexp(`^.+\\.%s\\.local\\.nhost\\.run$`) || Host(`local.%s.nhost.run`))", name, name)
}

func authPatchPre022(svc Service, useTLS bool) *Service {
	svc.Labels = Ingresses{
		{
			Name:    "auth",
			TLS:     useTLS,
			Rule:    traefikHostMatch("auth"),
			Port:    authPort,
			Rewrite: nil,
		},
	}.Labels()

	return &svc
}

func auth( //nolint:funlen
	cfg *model.ConfigConfig,
	subdomain string,
	httpPort uint,
	useTLS bool,
	nhostFolder string,
	exposePort uint,
) (*Service, error) {
	if exposePort != 0 {
		httpPort = exposePort
	}

	envars, err := appconfig.HasuraAuthEnv(
		cfg,
		"http://graphql:8080/v1/graphql",
		URL(subdomain, "auth", httpPort, useTLS && exposePort == 0)+"/v1",
		"postgres://nhost_hasura@postgres:5432/local",
		"postgres://nhost_auth_admin@postgres:5432/local",
		&model.ConfigSmtp{
			User:     "user",
			Password: "password",
			Sender:   "auth@example.com",
			Host:     "mailhog",
			Port:     1025, //nolint:mnd
			Secure:   false,
			Method:   "LOGIN",
		},
		false,
		false,
		"00000000-0000-0000-0000-000000000000",
		"5181f67e2844e4b60d571fa346cac9c37fc00d1ff519212eae6cead138e639ba",
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get hasura env vars: %w", err)
	}

	env := make(map[string]string, len(envars))
	for _, v := range envars {
		env[v.Name] = v.Value
	}

	svc := &Service{
		Image: "nhost/auth:" + *cfg.Auth.Version,
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
		ExtraHosts:  extraHosts(subdomain),
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
				Rule: traefikHostMatch("auth") + " && PathPrefix(`/v1`)",
				Port: authPort,
				Rewrite: &Rewrite{
					Regex:       "/v1(/|$$)(.*)",
					Replacement: "/$$2",
				},
			},
		}.Labels(),
		Ports:   ports(exposePort, authPort),
		Restart: "always",
		Volumes: []Volume{
			{
				Type:     "bind",
				Source:   nhostFolder + "/emails",
				Target:   "/app/email-templates",
				ReadOnly: ptr(false),
			},
		},
		WorkingDir: nil,
	}

	if *cfg.Auth.Version != "0.0.0-dev" &&
		appconfig.CompareVersions(*cfg.Auth.Version, "0.22.0") >= 0 {
		svc = authPatchPre022(*svc, useTLS)
	}

	return svc, nil
}
