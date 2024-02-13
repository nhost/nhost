package dockercompose

import "fmt"

func configserver( //nolint: funlen
	image,
	rootPath,
	nhostPath string,
	useTLS bool,
	runServices ...*RunService,
) *Service {
	bindings := make([]Volume, len(runServices))
	extraArgs := make([]string, len(runServices))
	for i, runService := range runServices {
		target := "/tmp/run-services/" + runService.Config.Name
		bindings[i] = Volume{
			Type:     "bind",
			Source:   runService.Path,
			Target:   target,
			ReadOnly: new(bool),
		}
		extraArgs[i] = fmt.Sprintf("--storage-local-run-services-path=%s", target)
	}

	return &Service{
		Image:      image,
		DependsOn:  map[string]DependsOn{},
		EntryPoint: []string{},
		Command: append([]string{
			"configserver",
			"--enable-playground",
			"--debug",
		}, extraArgs...),
		Environment: map[string]string{},
		ExtraHosts:  []string{},
		HealthCheck: nil,
		Labels: Ingresses{
			{
				Name:    "configserver",
				TLS:     useTLS,
				Rule:    "Host(`local.dashboard.nhost.run`) && PathPrefix(`/v1/configserver`)",
				Port:    configserverPort,
				Rewrite: nil,
			},
		}.Labels(),
		Ports:   []Port{},
		Restart: "always",
		Volumes: append(
			[]Volume{
				{
					Type:     "bind",
					Source:   fmt.Sprintf("%s/nhost.toml", nhostPath),
					Target:   "/tmp/config.toml",
					ReadOnly: ptr(false),
				},
				{
					Type:     "bind",
					Source:   fmt.Sprintf("%s/.secrets", rootPath),
					Target:   "/tmp/secrets.toml",
					ReadOnly: ptr(false),
				},
			},
			bindings...,
		),
		WorkingDir: nil,
	}
}
