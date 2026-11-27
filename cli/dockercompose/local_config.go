package dockercompose

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"

	"gopkg.in/yaml.v3"
)

const protocolTCP = "tcp"

var (
	errLocalComposeServiceNotFound  = errors.New("local development compose service not found")
	errLocalComposePublishedPort    = errors.New("local development published port not found")
	errLocalComposeTLSLabelNotFound = errors.New("local development TLS label not found")
)

// LocalDevelopmentConfig describes the host-facing ports and TLS mode used by
// the generated local development Docker Compose environment. PostgresPort is
// zero when the compose file does not include a local Postgres service.
type LocalDevelopmentConfig struct {
	HTTPPort     uint
	UseTLS       bool
	PostgresPort uint
}

// LocalDevelopmentConfig reads the generated Docker Compose file and returns
// the local development port and TLS settings that were used to start it.
func (dc *DockerCompose) LocalDevelopmentConfig() (LocalDevelopmentConfig, error) {
	var zero LocalDevelopmentConfig

	data, err := os.ReadFile(dc.filepath)
	if err != nil {
		return zero, fmt.Errorf("read docker compose file: %w", err)
	}

	var composeFile ComposeFile
	if err := yaml.Unmarshal(data, &composeFile); err != nil {
		return zero, fmt.Errorf("parse docker compose file: %w", err)
	}

	config, err := localDevelopmentConfig(&composeFile)
	if err != nil {
		return zero, err
	}

	return config, nil
}

func localDevelopmentConfig(composeFile *ComposeFile) (LocalDevelopmentConfig, error) {
	var zero LocalDevelopmentConfig

	httpPort, err := firstPublishedPort(composeFile, "traefik")
	if err != nil {
		return zero, fmt.Errorf("read HTTP port: %w", err)
	}

	useTLS, err := localDevelopmentUseTLS(composeFile)
	if err != nil {
		return zero, fmt.Errorf("read TLS mode: %w", err)
	}

	postgresPublishedPort, err := targetPublishedPort(composeFile, "postgres", postgresPort)
	if err != nil && !errors.Is(err, errLocalComposeServiceNotFound) {
		return zero, fmt.Errorf("read Postgres port: %w", err)
	}

	return LocalDevelopmentConfig{
		HTTPPort:     httpPort,
		UseTLS:       useTLS,
		PostgresPort: postgresPublishedPort,
	}, nil
}

func firstPublishedPort(composeFile *ComposeFile, serviceName string) (uint, error) {
	service, err := composeService(composeFile, serviceName)
	if err != nil {
		return 0, err
	}

	for _, port := range service.Ports {
		if port.Protocol != "" && port.Protocol != protocolTCP {
			continue
		}

		return parsePublishedPort(port.Published)
	}

	return 0, fmt.Errorf("%w: %s", errLocalComposePublishedPort, serviceName)
}

func targetPublishedPort(
	composeFile *ComposeFile,
	serviceName string,
	target uint,
) (uint, error) {
	service, err := composeService(composeFile, serviceName)
	if err != nil {
		return 0, err
	}

	for _, port := range service.Ports {
		if port.Target != target {
			continue
		}

		if port.Protocol != "" && port.Protocol != protocolTCP {
			continue
		}

		return parsePublishedPort(port.Published)
	}

	return 0, fmt.Errorf("%w: %s:%d", errLocalComposePublishedPort, serviceName, target)
}

func composeService(composeFile *ComposeFile, name string) (*Service, error) {
	if composeFile == nil || composeFile.Services == nil {
		return nil, fmt.Errorf("%w: %s", errLocalComposeServiceNotFound, name)
	}

	service, ok := composeFile.Services[name]
	if !ok || service == nil {
		return nil, fmt.Errorf("%w: %s", errLocalComposeServiceNotFound, name)
	}

	return service, nil
}

func parsePublishedPort(published string) (uint, error) {
	candidate := strings.TrimSpace(published)
	if candidate == "" {
		return 0, errLocalComposePublishedPort
	}

	if strings.Contains(candidate, ":") {
		candidate = candidate[strings.LastIndex(candidate, ":")+1:]
	}

	if before, _, ok := strings.Cut(candidate, "-"); ok {
		candidate = before
	}

	port, err := strconv.ParseUint(candidate, 10, 16)
	if err != nil {
		return 0, fmt.Errorf("parse published port %q: %w", published, err)
	}

	if port == 0 {
		return 0, fmt.Errorf("%w: %s", errLocalComposePublishedPort, published)
	}

	return uint(port), nil
}

func localDevelopmentUseTLS(composeFile *ComposeFile) (bool, error) {
	preferredLabels := []struct {
		service string
		label   string
	}{
		{
			service: "graphql",
			label:   "traefik.http.routers.graphql.tls",
		},
		{
			service: "console",
			label:   "traefik.http.routers.hasura.tls",
		},
	}

	for _, preferred := range preferredLabels {
		service, err := composeService(composeFile, preferred.service)
		if err != nil {
			continue
		}

		useTLS, ok, err := parseServiceTLSLabel(service, preferred.label)
		if err != nil {
			return false, err
		}

		if ok {
			return useTLS, nil
		}
	}

	for _, service := range composeFile.Services {
		useTLS, ok, err := firstServiceTLSLabel(service)
		if err != nil {
			return false, err
		}

		if ok {
			return useTLS, nil
		}
	}

	return false, errLocalComposeTLSLabelNotFound
}

func firstServiceTLSLabel(service *Service) (bool, bool, error) {
	if service == nil {
		return false, false, nil
	}

	for label := range service.Labels {
		if strings.HasPrefix(label, "traefik.http.routers.") && strings.HasSuffix(label, ".tls") {
			return parseServiceTLSLabel(service, label)
		}
	}

	return false, false, nil
}

func parseServiceTLSLabel(service *Service, label string) (bool, bool, error) {
	if service == nil || service.Labels == nil {
		return false, false, nil
	}

	value, ok := service.Labels[label]
	if !ok {
		return false, false, nil
	}

	useTLS, err := strconv.ParseBool(value)
	if err != nil {
		return false, false, fmt.Errorf("parse TLS label %s=%q: %w", label, value, err)
	}

	return useTLS, true, nil
}
