package dockercompose

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/ssl"
)

const (
	authPort         = 4000
	mailhogPort      = 8025
	dashboardPort    = 3000
	storagePort      = 5000
	functionsPort    = 3000
	hasuraPort       = 8080
	consolePort      = 9695
	postgresPort     = 5432
	configserverPort = 8088
)

const (
	minimumHasuraVerson = "v2.18.0"
)

func rootNodeModules(branch string) string {
	return sanitizeBranch(branch) + "-root_node_modules"
}

func functionsNodeModules(branch string) string {
	return sanitizeBranch(branch) + "-functions_node_modules"
}

func ports(host, container uint) []Port {
	if host == 0 {
		return nil
	}

	return []Port{
		{
			Mode:      "ingress",
			Target:    container,
			Published: strconv.FormatUint(uint64(host), 10),
			Protocol:  "tcp",
		},
	}
}

type ComposeFile struct {
	Services map[string]*Service `yaml:"services"`
	Volumes  map[string]struct{} `yaml:"volumes"`
}

// Environment is a map of environment variables that escapes literal `$` as
// `$$` when marshaled to YAML so Docker Compose doesn't interpret them as
// variable substitution.
type Environment map[string]string

func (e Environment) MarshalYAML() (any, error) {
	escaped := make(map[string]string, len(e))
	for k, v := range e {
		escaped[k] = strings.ReplaceAll(v, "$", "$$")
	}

	return escaped, nil
}

//nolint:tagliatelle
type Service struct {
	Image       string                    `yaml:"image"`
	DependsOn   map[string]DependsOn      `yaml:"depends_on,omitempty"`
	EntryPoint  []string                  `yaml:"entrypoint,omitempty"`
	Command     []string                  `yaml:"command,omitempty"`
	Environment Environment               `yaml:"environment,omitempty"`
	ExtraHosts  []string                  `yaml:"extra_hosts"`
	HealthCheck *HealthCheck              `yaml:"healthcheck,omitempty"`
	Labels      map[string]string         `yaml:"labels,omitempty"`
	Networks    map[string]*NetworkConfig `yaml:"networks,omitempty"`
	Ports       []Port                    `yaml:"ports,omitempty"`
	Restart     string                    `yaml:"restart"`
	User        *string                   `yaml:"user,omitempty"`
	Volumes     []Volume                  `yaml:"volumes,omitempty"`
	WorkingDir  *string                   `yaml:"working_dir,omitempty"`
}

type DependsOn struct {
	Condition string `yaml:"condition"`
}

type NetworkConfig struct {
	Aliases []string `yaml:"aliases,omitempty"`
}

func networkAliases(aliases ...string) map[string]*NetworkConfig {
	return map[string]*NetworkConfig{
		"default": {Aliases: aliases},
	}
}

//nolint:tagliatelle
type HealthCheck struct {
	Test        []string `yaml:"test"`
	Timeout     string   `yaml:"timeout"`
	Interval    string   `yaml:"interval"`
	StartPeriod string   `yaml:"start_period"`
}

type Port struct {
	Mode      string `yaml:"mode"`
	Target    uint   `yaml:"target"`
	Published string `yaml:"published"`
	Protocol  string `yaml:"protocol"`
}

//nolint:tagliatelle
type Volume struct {
	Type     string `yaml:"type"`
	Source   string `yaml:"source"`
	Target   string `yaml:"target"`
	ReadOnly *bool  `yaml:"read_only,omitempty"`
}

// extraHosts is the set of /etc/hosts entries injected into every bridge
// service. Public local.nhost.run hostnames are intentionally absent: on
// Linux, `host-gateway` resolves to the default docker0 bridge gateway,
// which is unroutable from containers attached to the user-defined
// project bridge. Resolution for those hostnames is provided by network
// aliases on the traefik service (see traefikAliases).
var extraHosts = []string{ //nolint:gochecknoglobals // immutable /etc/hosts entries shared by all bridge services
	"host.docker.internal:host-gateway",
}

// traefikAliases returns the set of public local hostnames that resolve
// to the traefik container via Docker's embedded DNS on the project
// bridge. Container-to-container HTTPS via these hostnames terminates at
// traefik and is routed using the existing ingress labels.
func traefikAliases(subdomain string) []string {
	return []string{
		subdomain + ".auth.local.nhost.run",
		subdomain + ".db.local.nhost.run",
		subdomain + ".functions.local.nhost.run",
		subdomain + ".graphql.local.nhost.run",
		subdomain + ".hasura.local.nhost.run",
		subdomain + ".storage.local.nhost.run",
		subdomain + ".dashboard.local.nhost.run",
		subdomain + ".mailhog.local.nhost.run",
		"local.auth.nhost.run",
		"local.db.nhost.run",
		"local.functions.nhost.run",
		"local.graphql.nhost.run",
		"local.hasura.nhost.run",
		"local.storage.nhost.run",
		"local.dashboard.nhost.run",
		"local.mailhog.nhost.run",
	}
}

// hostGatewayHosts returns the legacy host-gateway based mapping used by
// containers that run outside the project's bridge network (e.g. the
// standalone hasura-cli helper started via `docker run` without
// --network), where the default docker0 bridge gateway can reach the
// host-published traefik port.
func hostGatewayHosts(subdomain string) []string {
	return []string{
		"host.docker.internal:host-gateway",
		subdomain + ".auth.local.nhost.run:host-gateway",
		subdomain + ".db.local.nhost.run:host-gateway",
		subdomain + ".functions.local.nhost.run:host-gateway",
		subdomain + ".graphql.local.nhost.run:host-gateway",
		subdomain + ".hasura.local.nhost.run:host-gateway",
		subdomain + ".storage.local.nhost.run:host-gateway",
		"local.auth.nhost.run:host-gateway",
		"local.db.nhost.run:host-gateway",
		"local.functions.nhost.run:host-gateway",
		"local.graphql.nhost.run:host-gateway",
		"local.hasura.nhost.run:host-gateway",
		"local.storage.nhost.run:host-gateway",
	}
}

const traefikConfig = `
# v1
# DO NOT EDIT THIS FILE
tls:
  certificates:
    - certFile: /opt/traefik/certs/local.crt
      keyFile: /opt/traefik/certs/local.key
    - certFile: /opt/traefik/certs/sub.crt
      keyFile: /opt/traefik/certs/sub.key
log:
  level: DEBUG
accessLog: {}
`

func dumpCert(
	cert []byte,
	key []byte,
	dstName string,
	dotnhostfolder string,
) error {
	f1, err := os.OpenFile(
		filepath.Join(dotnhostfolder, "traefik", "certs", dstName+".crt"),
		os.O_TRUNC|os.O_CREATE|os.O_WRONLY,
		0o644, //nolint:mnd
	)
	if err != nil {
		return fmt.Errorf("failed to open local.crt: %w", err)
	}
	defer f1.Close()

	if _, err := f1.Write(cert); err != nil {
		return fmt.Errorf("failed to write local.crt: %w", err)
	}

	f2, err := os.OpenFile(
		filepath.Join(dotnhostfolder, "traefik", "certs", dstName+".key"),
		os.O_TRUNC|os.O_CREATE|os.O_WRONLY,
		0o644, //nolint:mnd
	)
	if err != nil {
		return fmt.Errorf("failed to open local.key: %w", err)
	}
	defer f2.Close()

	if _, err := f2.Write(key); err != nil {
		return fmt.Errorf("failed to write local.cert: %w", err)
	}

	return nil
}

func trafikFiles(dotnhostfolder string) error {
	if err := os.MkdirAll(
		filepath.Join(dotnhostfolder, "traefik", "certs"),
		0o755, //nolint:mnd
	); err != nil {
		return fmt.Errorf("failed to create traefik folder: %w", err)
	}

	if err := dumpCert(ssl.LocalCertFile, ssl.LocalKeyFile, "local", dotnhostfolder); err != nil {
		return fmt.Errorf("failed to dump local cert: %w", err)
	}

	if err := dumpCert(ssl.SubCertFile, ssl.SubKeyFile, "sub", dotnhostfolder); err != nil {
		return fmt.Errorf("failed to dump sub cert: %w", err)
	}

	f, err := os.OpenFile(
		filepath.Join(dotnhostfolder, "traefik", "traefik.yaml"),
		os.O_TRUNC|os.O_CREATE|os.O_WRONLY,
		0o644, //nolint:mnd
	)
	if err != nil {
		return fmt.Errorf("failed to open traefik.yaml: %w", err)
	}
	defer f.Close()

	if _, err := f.WriteString(traefikConfig); err != nil {
		return fmt.Errorf("failed to write traefik.yaml: %w", err)
	}

	return nil
}

func getDockerHost() (*url.URL, error) {
	socket, ok := os.LookupEnv("DOCKER_HOST")
	if !ok {
		u, _ := url.Parse("unix:///var/run/docker.sock")
		return u, nil
	}

	u, err := url.Parse(socket)
	if err != nil {
		return nil, fmt.Errorf("failed to parse DOCKER_HOST: %w", err)
	}

	return u, nil
}

func traefik(subdomain, projectName string, port uint, dotnhostfolder string) (*Service, error) {
	if err := trafikFiles(dotnhostfolder); err != nil {
		return nil, fmt.Errorf("failed to create traefik files: %w", err)
	}

	dockerURL, err := getDockerHost()
	if err != nil {
		return nil, fmt.Errorf("failed to get docker host: %w", err)
	}

	volumes := []Volume{{
		Type:     "bind",
		Source:   filepath.Join(dotnhostfolder, "traefik"),
		Target:   "/opt/traefik",
		ReadOnly: new(true),
	}}

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
		Image:      "traefik:v3.6",
		DependsOn:  nil,
		EntryPoint: nil,
		Command: []string{
			"--api.insecure=true",
			"--providers.docker=true",
			"--providers.docker.endpoint=" + dockerEndpoint,
			"--providers.file.directory=/opt/traefik",
			"--providers.file.watch=true",
			"--providers.docker.exposedbydefault=false",
			fmt.Sprintf(
				"--providers.docker.constraints=Label(`com.docker.compose.project`,`%s`)",
				projectName,
			),
			fmt.Sprintf("--entrypoints.web.address=:%d", port),
		},
		Environment: nil,
		ExtraHosts:  extraHosts,
		HealthCheck: nil,
		Labels:      nil,
		Networks:    networkAliases(traefikAliases(subdomain)...),
		Ports: []Port{
			{
				Mode:      "ingress",
				Target:    port,
				Published: strconv.FormatUint(uint64(port), 10),
				Protocol:  "tcp",
			},
		},
		Restart:    "always",
		User:       nil,
		Volumes:    volumes,
		WorkingDir: nil,
	}, nil
}

func minio(volumeName string) *Service {
	return &Service{
		Image:      "minio/minio:RELEASE.2025-02-28T09-55-16Z",
		DependsOn:  nil,
		EntryPoint: []string{"/bin/sh"},
		Command: []string{
			"-c", "mkdir -p /data/nhost && /usr/bin/minio server --address :9000 /data",
		},
		Environment: map[string]string{
			"MINIO_ROOT_PASSWORD": "minioaccesskey123123",
			"MINIO_ROOT_USER":     "minioaccesskey123123",
		},
		ExtraHosts:  extraHosts,
		Ports:       nil,
		Restart:     "always",
		User:        nil,
		HealthCheck: nil,
		Labels:      nil,
		Networks:    nil,
		Volumes: []Volume{
			{
				Type:     "volume",
				Source:   volumeName,
				Target:   "/data",
				ReadOnly: nil,
			},
		},
		WorkingDir: nil,
	}
}

func dashboard( //nolint:funlen // single env-var config map, not decomposable
	cfg *model.ConfigConfig,
	subdomain string,
	dashboardVersion string,
	httpPort uint,
	useTLS bool,
	appID string,
) *Service {
	// With constellation enabled, the dashboard's hasura admin/metadata API
	// calls flow through constellation (which proxies unmatched paths to hasura)
	// instead of hitting hasura directly. Console UI and migrations API stay on
	// the hasura-cli helper containers and are not affected.
	hasuraAPISubdomain := "hasura"
	if cfg.GetExperimental().GetConstellation() != nil {
		hasuraAPISubdomain = "graphql"
	}

	return &Service{
		Image:      dashboardVersion,
		DependsOn:  nil,
		EntryPoint: nil,
		Command:    nil,
		Environment: map[string]string{
			"NEXT_PUBLIC_ENV":                "dev",
			"NEXT_PUBLIC_NHOST_PLATFORM":     "false",
			"NEXT_PUBLIC_NHOST_APP_ID":       appID,
			"NEXT_PUBLIC_NHOST_ADMIN_SECRET": cfg.Hasura.AdminSecret,
			"NEXT_PUBLIC_NHOST_AUTH_URL": URL(
				subdomain, "auth", httpPort, useTLS,
			) + "/v1",
			"NEXT_PUBLIC_NHOST_CONFIGSERVER_URL": URL(
				subdomain, "dashboard", httpPort, useTLS,
			) + "/v1/configserver/graphql",
			"NEXT_PUBLIC_NHOST_FUNCTIONS_URL": URL(
				subdomain, "functions", httpPort, useTLS,
			) + "/v1",
			"NEXT_PUBLIC_NHOST_LOGS_GRAPHQL_URL": URL(
				subdomain, "dashboard", httpPort, useTLS,
			) + "/v1/logs/graphql",
			"NEXT_PUBLIC_NHOST_LOGS_WEBSOCKET": WebsocketURL(
				subdomain, "dashboard", httpPort, useTLS,
			) + "/v1/logs/graphql",
			"NEXT_PUBLIC_NHOST_GRAPHQL_URL": URL(
				subdomain, "graphql", httpPort, useTLS,
			) + "/v1",
			"NEXT_PUBLIC_NHOST_HASURA_API_URL": URL(
				subdomain, hasuraAPISubdomain, httpPort, useTLS,
			),
			"NEXT_PUBLIC_NHOST_HASURA_CONSOLE_URL": URL(
				subdomain, "hasura", httpPort, useTLS,
			) + "/console",
			"NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL": URL(
				subdomain, "hasura", httpPort, useTLS,
			) + "/apis/migrate",
			"NEXT_PUBLIC_NHOST_STORAGE_URL": URL(
				subdomain, "storage", httpPort, useTLS,
			) + "/v1",
		},
		ExtraHosts:  extraHosts,
		HealthCheck: nil,
		Labels: Ingresses{
			{
				Name:    "dashboard",
				TLS:     useTLS,
				Rule:    traefikHostMatch("dashboard"),
				Port:    dashboardPort,
				Rewrite: nil,
			},
		}.Labels(),
		Networks:   nil,
		Ports:      []Port{},
		Restart:    "",
		User:       nil,
		Volumes:    []Volume{},
		WorkingDir: new(string),
	}
}

func stripJWTSecretToPublic(value string) (string, error) {
	var full map[string]any
	if err := json.Unmarshal([]byte(value), &full); err != nil {
		return value, nil //nolint:nilerr
	}

	public := make(map[string]any)
	if v, ok := full["key"]; ok {
		public["key"] = v
	}

	if v, ok := full["type"]; ok {
		public["type"] = v
	}

	b, err := json.Marshal(public)
	if err != nil {
		return "", fmt.Errorf("failed to marshal JWT secret: %w", err)
	}

	return string(b), nil
}

func functions( //nolint:funlen
	cfg *model.ConfigConfig,
	subdomain string,
	httpPort uint,
	useTLS bool,
	rootFolder string,
	jwtSecret string,
	port uint,
	branch string,
	functionsVersion string,
) (*Service, error) {
	jwtSecret, err := stripJWTSecretToPublic(jwtSecret)
	if err != nil {
		return nil, fmt.Errorf("failed to strip JWT secret for %s: %w", "functions", err)
	}

	if err := prepareFunctionsHostFiles(rootFolder); err != nil {
		return nil, err
	}

	envVars := map[string]string{
		"HASURA_GRAPHQL_ADMIN_SECRET": cfg.Hasura.AdminSecret,
		"HASURA_GRAPHQL_DATABASE_URL": "postgres://nhost_auth_admin@local.db.nhost.run:5432/local",
		"HASURA_GRAPHQL_GRAPHQL_URL":  "http://graphql:8080/v1/graphql",
		"HASURA_GRAPHQL_JWT_SECRET":   jwtSecret,
		"NHOST_ADMIN_SECRET":          cfg.Hasura.AdminSecret,
		"NHOST_AUTH_URL":              URL(subdomain, "auth", httpPort, useTLS) + "/v1",
		"NHOST_FUNCTIONS_URL":         URL(subdomain, "functions", httpPort, useTLS) + "/v1",
		"NHOST_GRAPHQL_URL":           URL(subdomain, "graphql", httpPort, useTLS) + "/v1",
		"NHOST_HASURA_URL":            URL(subdomain, "hasura", httpPort, useTLS) + "/console",
		"NHOST_STORAGE_URL":           URL(subdomain, "storage", httpPort, useTLS) + "/v1",
		"NHOST_JWT_SECRET":            jwtSecret,
		"NHOST_REGION":                "local",
		"NHOST_SUBDOMAIN":             subdomain,
		"NHOST_WEBHOOK_SECRET":        cfg.Hasura.WebhookSecret,
		"GRAPHITE_WEBHOOK_SECRET":     cfg.GetAi().GetWebhookSecret(),
	}
	for _, envVar := range cfg.GetGlobal().GetEnvironment() {
		envVars[envVar.GetName()] = envVar.GetValue()
	}

	return &Service{
		Image: fmt.Sprintf(
			"nhost/functions:%d-%s",
			*cfg.GetFunctions().GetNode().Version,
			functionsVersion,
		),
		DependsOn:   nil,
		EntryPoint:  nil,
		Command:     nil,
		Environment: envVars,
		ExtraHosts:  extraHosts,
		HealthCheck: &HealthCheck{
			Test:        []string{"CMD", "wget", "--spider", "-S", "http://localhost:3000/healthz"},
			Interval:    "5s",
			Timeout:     "600s",
			StartPeriod: "600s",
		},
		Labels: Ingresses{
			{
				Name: "functions",
				TLS:  useTLS,
				Rule: traefikHostMatch("functions") + "&& PathPrefix(`/v1`)",
				Port: functionsPort,
				Rewrite: &Rewrite{
					Regex:       "/v1(/|$$)(.*)",
					Replacement: "/$$2",
				},
			},
		}.Labels(),
		Networks: networkAliases("functions-service"),
		Ports:    ports(port, functionsPort),
		Restart:  "always",
		User:     nil,
		Volumes: []Volume{
			{
				Type:     "bind",
				Source:   rootFolder,
				Target:   "/opt/project",
				ReadOnly: new(false),
			},
			{
				Type:     "volume",
				Source:   rootNodeModules(branch),
				Target:   "/opt/project/node_modules",
				ReadOnly: new(false),
			},
			{
				Type:     "volume",
				Source:   functionsNodeModules(branch),
				Target:   "/opt/project/functions/node_modules",
				ReadOnly: new(false),
			},
		},
		WorkingDir: nil,
	}, nil
}

// defaultFunctionsTSConfig matches services/functions/tsconfig.json,
// which the nhost/functions image's start.sh copies into the user's
// project on boot via `cp -n` (no-clobber). The container runs as
// root, so that copy leaves a root-owned file in the host repo.
// Pre-creating the file as the calling user makes the `cp -n` a
// no-op.
const defaultFunctionsTSConfig = `{
  "compilerOptions": {
    "allowJs": true,
    "skipLibCheck": true,
    "noEmit": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "strictNullChecks": false
  }
}
`

// prepareFunctionsHostFiles materialises directories and files that
// the functions container would otherwise create on the bind-mounted
// project root as root: nested named-volume mountpoints and the
// default tsconfig.json. Running here in the CLI process means they
// land owned by the calling user.
func prepareFunctionsHostFiles(rootFolder string) error {
	dirs := []string{
		filepath.Join(rootFolder, "node_modules"),
		filepath.Join(rootFolder, "functions"),
		filepath.Join(rootFolder, "functions", "node_modules"),
	}
	for _, p := range dirs {
		if err := os.MkdirAll(p, 0o755); err != nil { //nolint:mnd
			return fmt.Errorf("create %s: %w", p, err)
		}
	}

	tsconfig := filepath.Join(rootFolder, "functions", "tsconfig.json")
	if _, err := os.Stat(tsconfig); errors.Is(err, os.ErrNotExist) {
		if err := os.WriteFile(
			tsconfig,
			[]byte(defaultFunctionsTSConfig),
			0o600, //nolint:mnd
		); err != nil {
			return fmt.Errorf("create %s: %w", tsconfig, err)
		}
	} else if err != nil {
		return fmt.Errorf("stat %s: %w", tsconfig, err)
	}

	return nil
}

func mailhog(volumeName string, useTLS bool) *Service {
	return &Service{
		Image:      "jcalonso/mailhog:v1.0.1",
		DependsOn:  nil,
		EntryPoint: []string{},
		Command:    []string{},
		Environment: map[string]string{
			"SMTP_HOST":   "mailhog",
			"SMTP_PASS":   "password",
			"SMTP_PORT":   "1025",
			"SMTP_SECURE": "false",
			"SMTP_SENDER": "auth@example.com",
			"SMTP_USER":   "user",
		},
		ExtraHosts:  extraHosts,
		HealthCheck: nil,
		Labels: Ingresses{
			{
				Name:    "mailhog",
				TLS:     useTLS,
				Rule:    traefikHostMatch("mailhog"),
				Port:    mailhogPort,
				Rewrite: nil,
			},
		}.Labels(),
		Networks: nil,
		Ports:    nil,
		Restart:  "always",
		User:     nil,
		Volumes: []Volume{
			{
				Type:     "volume",
				Source:   volumeName,
				Target:   "/maildir",
				ReadOnly: new(false),
			},
		},
		WorkingDir: nil,
	}
}

type ExposePorts struct {
	Auth      uint
	Storage   uint
	Graphql   uint
	Console   uint
	Functions uint
}

func sanitizeBranch(name string) string {
	re := regexp.MustCompile(`[^a-zA-Z0-9_-]`)
	return strings.ToLower(re.ReplaceAllString(name, ""))
}

func IsJWTSecretCompatibleWithHasuraAuth(
	jwtSecret *model.ConfigJWTSecret,
) bool {
	if jwtSecret != nil && jwtSecret.Type != nil && *jwtSecret.Type != "" && jwtSecret.Key != nil &&
		*jwtSecret.Key != "" {
		return *jwtSecret.Type == "HS256" || *jwtSecret.Type == "HS384" ||
			*jwtSecret.Type == "HS512" || *jwtSecret.Type == "RS256" ||
			*jwtSecret.Type == "RS384" || *jwtSecret.Type == "RS512"
	}

	return false
}

func getServices( //nolint: funlen,cyclop
	cfg *model.ConfigConfig,
	subdomain string,
	projectName string,
	httpPort uint,
	useTLS bool,
	postgresPort uint,
	nhostFolder string,
	dotNhostFolder string,
	rootFolder string,
	ports ExposePorts,
	branch string,
	dashboardVersion string,
	functionsVersion string,
	configserviceImage string,
	appID string,
	startFunctions bool,
	runServices ...*RunService,
) (map[string]*Service, error) {
	minioVolumeName := "minio_" + sanitizeBranch(branch)
	minio := minio(minioVolumeName)

	storage, err := storage(cfg, subdomain, useTLS, httpPort, ports.Storage)
	if err != nil {
		return nil, err
	}

	pgVolumeName := "pgdata_" + sanitizeBranch(branch)
	dataFolder := filepath.Join(dotNhostFolder, "data")

	postgres, err := postgres(cfg, postgresPort, dataFolder, pgVolumeName)
	if err != nil {
		return nil, err
	}

	graphql, err := graphql(
		cfg,
		subdomain,
		useTLS,
		httpPort,
		ports.Graphql,
	)
	if err != nil {
		return nil, err
	}

	jwtSecret := graphql.Environment["HASURA_GRAPHQL_JWT_SECRET"]

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

	traefik, err := traefik(subdomain, projectName, httpPort, dotNhostFolder)
	if err != nil {
		return nil, err
	}

	mailhogVolumeName := "mailhog_" + sanitizeBranch(branch)
	mailhog := mailhog(mailhogVolumeName, useTLS)

	cs, err := configserver(
		configserviceImage,
		rootFolder,
		nhostFolder,
		projectName,
		appID,
		useTLS,
		runServices...,
	)
	if err != nil {
		return nil, err
	}

	services := map[string]*Service{
		"console":      console,
		"dashboard":    dashboard(cfg, subdomain, dashboardVersion, httpPort, useTLS, appID),
		"graphql":      graphql,
		"minio":        minio,
		"postgres":     postgres,
		"storage":      storage,
		"mailhog":      mailhog,
		"traefik":      traefik,
		"configserver": cs,
	}

	if startFunctions {
		services["functions"], err = functions(
			cfg,
			subdomain,
			httpPort,
			useTLS,
			rootFolder,
			jwtSecret,
			ports.Functions,
			branch,
			functionsVersion,
		)
		if err != nil {
			return nil, err
		}
	}

	if cfg.GetExperimental().GetConstellation() != nil {
		c, err := constellation(
			cfg,
			subdomain,
			useTLS,
			httpPort,
			nhostFolder,
			"nhost/constellation:"+*cfg.GetExperimental().GetConstellation().GetVersion(),
		)
		if err != nil {
			return nil, err
		}

		services["constellation"] = c
	}

	if len(cfg.GetHasura().GetJwtSecrets()) > 0 &&
		IsJWTSecretCompatibleWithHasuraAuth(cfg.GetHasura().GetJwtSecrets()[0]) &&
		cfg.GetHasura().GetAuthHook() == nil {
		auth, err := auth(cfg, subdomain, httpPort, useTLS, nhostFolder, ports.Auth)
		if err != nil {
			return nil, err
		}

		services["auth"] = auth

		if cfg.Ai != nil {
			services["ai"] = ai(cfg)
		}
	}

	for _, runService := range runServices {
		svc := run(runService.Config, branch)

		if len(runService.BindMounts) > 0 {
			svc.Volumes = append(svc.Volumes, runService.BindMounts...)
		}

		services["run-"+runService.Config.Name] = svc
	}

	return services, nil
}

type RunService struct {
	Config     *model.ConfigRunServiceConfig
	Path       string
	BindMounts []Volume
}

func mountCACertificates(
	path string,
	services map[string]*Service,
) {
	for _, service := range services {
		service.Volumes = append(service.Volumes, Volume{
			Type:     "bind",
			Source:   path,
			Target:   "/etc/ssl/certs/ca-certificates.crt",
			ReadOnly: new(true),
		})
	}
}

// servicesRunAsHostUser is the set of services that write into
// host-bind-mounted directories the user owns (migrations, metadata,
// generated config). Running them as the host user keeps those files
// owned by the caller instead of root.
//
// The `functions` service is intentionally excluded: its image is
// built with Nix and ships a read-only /tmp (mode 0555), so its
// entrypoint relies on root's DAC_OVERRIDE to create
// /tmp/corepack-shims. Stub directories that dockerd otherwise
// creates as root inside the bind-mounted project root are handled
// separately in functions() by pre-creating the mountpoints.
//
// The `configserver` service is also excluded: it bind-mounts the
// host Docker socket to discover sibling containers and serve their
// logs. That socket is owned by root:docker, and the caller normally
// reaches it via the `docker` supplementary group. Forcing
// `user: <uid>:<gid>` runs the container with only that primary gid
// and drops the caller's supplementary groups, so it would lose
// access to the socket. It therefore keeps its default (root) user.
// osLinux is runtime.GOOS on Linux hosts.
const osLinux = "linux"

var servicesRunAsHostUser = []string{ //nolint:gochecknoglobals
	"console",
	"constellation",
}

// prepareNhostFolderSubdirs materialises the directories under the
// project's nhost/ folder that the stack bind-mounts into containers
// (metadata, migrations, seeds, emails). Without this, dockerd creates
// any missing source dirs as root when attaching the bind, leaving
// root-owned directories in the user's repo even after the relevant
// containers are demoted to the host user.
func prepareNhostFolderSubdirs(nhostFolder string) error {
	for _, name := range []string{"metadata", "migrations", "seeds", "emails"} {
		p := filepath.Join(nhostFolder, name)
		if err := os.MkdirAll(p, 0o755); err != nil { //nolint:mnd
			return fmt.Errorf("create %s: %w", p, err)
		}
	}

	return nil
}

// applyHostUserID sets `user: <uid>:<gid>` on services that produce
// host-visible files, so those files end up owned by the user who ran
// `nhost up` rather than root.
//
// Linux only: on Docker Desktop (macOS/Windows) the bind-mount layer
// already maps ownership to the host user, and forcing `user:` can
// break images that expect their default UID.
func applyHostUserID(services map[string]*Service) {
	if runtime.GOOS != osLinux {
		return
	}

	uid := os.Getuid()
	if uid < 0 {
		return
	}

	spec := fmt.Sprintf("%d:%d", uid, os.Getgid())
	for _, name := range servicesRunAsHostUser {
		if svc, ok := services[name]; ok {
			svc.User = &spec
		}
	}
}

func ComposeFileFromConfig( //nolint:funlen
	cfg *model.ConfigConfig,
	subdomain string,
	projectName string,
	httpPort uint,
	useTLS bool,
	postgresPort uint,
	nhostFolder string,
	dotNhostFolder string,
	rootFolder string,
	ports ExposePorts,
	branch string,
	dashboardVersion string,
	functionsVersion string,
	configserverImage string,
	appID string,
	startFunctions bool,
	caCertificatesPath string,
	runServices ...*RunService,
) (*ComposeFile, error) {
	services, err := getServices(
		cfg,
		subdomain,
		projectName,
		httpPort,
		useTLS,
		postgresPort,
		nhostFolder,
		dotNhostFolder,
		rootFolder,
		ports,
		branch,
		dashboardVersion,
		functionsVersion,
		configserverImage,
		appID,
		startFunctions,
		runServices...,
	)
	if err != nil {
		return nil, err
	}

	volumes := map[string]struct{}{
		rootNodeModules(branch):             {},
		"pgdata_" + sanitizeBranch(branch):  {},
		"minio_" + sanitizeBranch(branch):   {},
		"mailhog_" + sanitizeBranch(branch): {},
	}

	if startFunctions {
		volumes[functionsNodeModules(branch)] = struct{}{}
	}

	for _, runService := range runServices {
		for _, s := range runService.Config.GetResources().GetStorage() {
			volumes[runVolumeName(runService.Config.Name, s.GetName(), branch)] = struct{}{}
		}
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
		Volumes:  volumes,
	}, nil
}
