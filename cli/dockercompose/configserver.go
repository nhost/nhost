package dockercompose

import (
	"fmt"
	"path/filepath"
	"slices"
)

func configserver( //nolint: funlen
	image,
	rootPath,
	nhostPath,
	projectName string,
	useTLS bool,
	runServices ...*RunService,
) (*Service, error) {
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

	dockerURL, err := getDockerHost()
	if err != nil {
		return nil, fmt.Errorf("failed to get docker host: %w", err)
	}

	volumes := append(
		[]Volume{
			{
				Type:     "bind",
				Source:   nhostPath,
				Target:   "/tmp/root/nhost",
				ReadOnly: new(false),
			},
			{
				Type:     "bind",
				Source:   rootPath,
				Target:   "/tmp/root",
				ReadOnly: new(false),
			},
		},
		bindings...,
	)

	dockerEndpoint := dockerURL.String()
	if dockerURL.Scheme == "unix" {
		volumes = append(volumes, Volume{
			Type:     "bind",
			Source:   dockerURL.Path,
			Target:   "/var/run/docker.sock",
			ReadOnly: new(true),
		})
		dockerEndpoint = "unix:///var/run/docker.sock"
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
		Environment: map[string]string{
			"DOCKER_HOST":            dockerEndpoint,
			"DOCKER_COMPOSE_PROJECT": projectName,
		},
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
			{
				Name:    "logs",
				TLS:     useTLS,
				Rule:    traefikHostMatch("dashboard") + "&& PathPrefix(`/v1/logs`)",
				Port:    configserverPort,
				Rewrite: nil,
			},
		}.Labels(),
		Networks:   nil,
		Ports:      []Port{},
		Restart:    "always",
		Volumes:    volumes,
		WorkingDir: nil,
	}, nil
}
