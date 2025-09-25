package dockercompose

import (
	"fmt"

	"github.com/nhost/be/services/mimir/model"
)

const (
	schemeHTTP  = "http"
	schemeHTTPS = "https"
)

func dashboardCloud(
	cfg *model.ConfigConfig,
	subdomain string,
	cloudSubdomain string,
	cloudRegion string,
	cloudAdminSecret string,
	httpPort uint,
	useTLS bool,
	dashboardVersion string,
) *Service {
	dashboard := dashboard(cfg, subdomain, dashboardVersion, httpPort, useTLS)

	dashboard.Environment["NEXT_PUBLIC_NHOST_ADMIN_SECRET"] = cloudAdminSecret
	dashboard.Environment["NEXT_PUBLIC_NHOST_AUTH_URL"] = fmt.Sprintf(
		"https://%s.auth.%s.nhost.run/v1", cloudSubdomain, cloudRegion,
	)
	dashboard.Environment["NEXT_PUBLIC_NHOST_GRAPHQL_URL"] = fmt.Sprintf(
		"https://%s.graphql.%s.nhost.run/v1", cloudSubdomain, cloudRegion,
	)
	dashboard.Environment["NEXT_PUBLIC_NHOST_STORAGE_URL"] = fmt.Sprintf(
		"https://%s.storage.%s.nhost.run/v1", cloudSubdomain, cloudRegion,
	)
	dashboard.Environment["NEXT_PUBLIC_NHOST_HASURA_API_URL"] = fmt.Sprintf(
		"https://%s.hasura.%s.nhost.run",
		cloudSubdomain, cloudRegion,
	)

	return dashboard
}

func consoleCloud(
	cfg *model.ConfigConfig,
	subdomain string,
	cloudSubdomain string,
	cloudRegion string,
	cloudAdminSecret string,
	clouadPostgresURL string,
	httpPort uint,
	useTLS bool,
	nhostFolder string,
	ports ExposePorts,
) (*Service, error) {
	console, err := console(cfg, subdomain, httpPort, useTLS, nhostFolder, ports.Console)
	if err != nil {
		return nil, err
	}

	scheme := schemeHTTP
	if useTLS {
		scheme = schemeHTTPS
	}

	console.DependsOn = nil
	console.Command = []string{
		"bash", "-c",
		fmt.Sprintf(`
            hasura-cli \
              console \
              --no-browser \
              --endpoint https://%s.hasura.%s.nhost.run \
              --address 0.0.0.0 \
              --console-port 9695 \
              --api-port %d \
              --api-host %s://%s.hasura.local.nhost.run \
              --console-hge-endpoint https://%s.hasura.%s.nhost.run`,
			cloudSubdomain, cloudRegion, httpPort, scheme, subdomain, cloudSubdomain, cloudRegion),
	}

	console.Environment["HASURA_GRAPHQL_ADMIN_SECRET"] = cloudAdminSecret
	console.Environment["HASURA_GRAPHQL_DATABASE_URL"] = clouadPostgresURL

	return console, nil
}

func getServicesCloud(
	cfg *model.ConfigConfig,
	subdomain string,
	cloudSubdomain string,
	cloudRegion string,
	cloudAdminSecret string,
	clouadPostgresURL string,
	projectName string,
	httpPort uint,
	useTLS bool,
	nhostFolder string,
	dotNhostFolder string,
	rootFolder string,
	ports ExposePorts,
	dashboardVersion string,
	configserviceImage string,
) (map[string]*Service, error) {
	traefik, err := traefik(subdomain, projectName, httpPort, dotNhostFolder)
	if err != nil {
		return nil, err
	}

	console, err := consoleCloud(
		cfg,
		subdomain,
		cloudSubdomain,
		cloudRegion,
		cloudAdminSecret,
		clouadPostgresURL,
		httpPort,
		useTLS,
		nhostFolder,
		ports,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create console service: %w", err)
	}

	services := map[string]*Service{
		"console": console,
		"dashboard": dashboardCloud(
			cfg,
			subdomain,
			cloudSubdomain,
			cloudRegion,
			cloudAdminSecret,
			httpPort,
			useTLS,
			dashboardVersion,
		),
		"traefik": traefik,
		"configserver": configserver(
			configserviceImage,
			rootFolder,
			nhostFolder,
			useTLS,
		),
	}

	return services, nil
}

func CloudComposeFileFromConfig(
	cfg *model.ConfigConfig,
	subdomain string,
	cloudSubdomain string,
	cloudRegion string,
	cloudAdminSecret string,
	clouadPostgresURL string,
	projectName string,
	httpPort uint,
	useTLS bool,
	nhostFolder string,
	dotNhostFolder string,
	rootFolder string,
	ports ExposePorts,
	dashboardVersion string,
	configserverImage string,
	caCertificatesPath string,
) (*ComposeFile, error) {
	services, err := getServicesCloud(
		cfg,
		subdomain,
		cloudSubdomain,
		cloudRegion,
		cloudAdminSecret,
		clouadPostgresURL,
		projectName,
		httpPort,
		useTLS,
		nhostFolder,
		dotNhostFolder,
		rootFolder,
		ports,
		dashboardVersion,
		configserverImage,
	)
	if err != nil {
		return nil, err
	}

	if caCertificatesPath != "" {
		mountCACertificates(caCertificatesPath, services)
	}

	return &ComposeFile{
		Services: services,
		Volumes:  nil,
	}, nil
}
