package dockercompose

import (
	"path/filepath"
	"slices"
)

func configserver( //nolint: funlen
	image,
	rootPath,
	nhostPath string,
	useTLS bool,
	runServices ...*RunService,
) *Service {
	bindings := make([]Volume, 0, len(runServices))
	extraArgs := make([]string, len(runServices))

	mountedVolumes := make([]string, 0, len(runServices))
	for i, runService := range runServices {
		source := filepath.Dir(runService.Path)
		target := filepath.Join("/tmp", source)
		targetFile := filepath.Join(target, filepath.Base(runService.Path))

		extraArgs[i] = "--storage-local-run-services-path=" + targetFile

		if slices.Contains(mountedVolumes, source) {
			continue
		}

		mountedVolumes = append(mountedVolumes, source)

		bindings = append(bindings, Volume{
			Type:     "bind",
			Source:   source,
			Target:   target,
			ReadOnly: new(bool),
		})
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
				Rule:    traefikHostMatch("dashboard") + "&& PathPrefix(`/v1/configserver`)",
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
					Source:   nhostPath,
					Target:   "/tmp/root/nhost",
					ReadOnly: ptr(false),
				},
				{
					Type:     "bind",
					Source:   rootPath,
					Target:   "/tmp/root",
					ReadOnly: ptr(false),
				},
			},
			bindings...,
		),
		WorkingDir: nil,
	}
}
