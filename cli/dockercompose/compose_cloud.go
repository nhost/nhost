package dockercompose

import (
	"fmt"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/clienv"
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
	appID string,
) *Service {
	dashboard := dashboard(cfg, subdomain, dashboardVersion, httpPort, useTLS, appID)

	dashboard.Environment["NEXT_PUBLIC_NHOST_ADMIN_SECRET"] = cloudAdminSecret
	dashboard.Environment["NEXT_PUBLIC_NHOST_AUTH_URL"] = clienv.NhostAuthURL(
		cloudSubdomain, cloudRegion,
	)
	dashboard.Environment["NEXT_PUBLIC_NHOST_GRAPHQL_URL"] = clienv.NhostGraphqlURL(
		cloudSubdomain, cloudRegion,
	)
	dashboard.Environment["NEXT_PUBLIC_NHOST_STORAGE_URL"] = clienv.NhostStorageURL(
		cloudSubdomain, cloudRegion,
	)
	dashboard.Environment["NEXT_PUBLIC_NHOST_HASURA_API_URL"] = clienv.NhostHasuraURL(
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
	dotNhostFolder string,
	ports ExposePorts,
) (*Service, error) {
	console, err := console(
		cfg,
		subdomain,
		httpPort,
		useTLS,
		nhostFolder,
		dotNhostFolder,
		ports.Console,
	)
	if err != nil {
		return nil, err
	}

	scheme := schemeHTTP
	if useTLS {
		scheme = schemeHTTPS
	}

	cloudHasuraURL := clienv.NhostHasuraURL(cloudSubdomain, cloudRegion)

	console.DependsOn = nil
	console.Command = []string{
		"bash", "-c",
		fmt.Sprintf(`
            hasura-cli \
              console \
              --no-browser \
              --endpoint %s \
              --address 0.0.0.0 \
              --console-port 9695 \
              --api-port %d \
              --api-host %s://%s.hasura.local.nhost.run \
              --console-hge-endpoint %s`,
			cloudHasuraURL, httpPort, scheme, subdomain, cloudHasuraURL),
	}

	console.Environment["HASURA_GRAPHQL_ADMIN_SECRET"] = cloudAdminSecret
	console.Environment["HASURA_GRAPHQL_DATABASE_URL"] = clouadPostgresURL

	return console, nil
}

func getServicesCloud( //nolint:funlen
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
	appID string,
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
		dotNhostFolder,
		ports,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create console service: %w", err)
	}

	cs, err := configserver(
		configserviceImage,
		rootFolder,
		nhostFolder,
		projectName,
		appID,
		useTLS,
	)
	if err != nil {
		return nil, err
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
			appID,
		),
		"traefik":      traefik,
		"configserver": cs,
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
	appID string,
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
		appID,
	)
	if err != nil {
		return nil, err
	}

	if caCertificatesPath != "" {
		mountCACertificates(caCertificatesPath, services)
	}

	if err := prepareNhostFolderSubdirs(nhostFolder); err != nil {
		return nil, err
	}

	applyHostUserID(services)

	return &ComposeFile{
		Services: services,
		Volumes:  nil,
	}, nil
}
