package dev

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/charmbracelet/lipgloss"
	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/cmd/config"
	"github.com/nhost/nhost/cli/cmd/run"
	"github.com/nhost/nhost/cli/cmd/software"
	"github.com/nhost/nhost/cli/dockercompose"
	"github.com/nhost/nhost/cli/project/env"
	"github.com/nhost/nhost/cli/tui"
	"github.com/urfave/cli/v3"
	"golang.org/x/term"
)

func deptr[T any](t *T) T { //nolint:ireturn
	if t == nil {
		return *new(T)
	}

	return *t
}

const (
	flagHTTPPort           = "http-port"
	flagDisableTLS         = "disable-tls"
	flagPostgresPort       = "postgres-port"
	flagApplySeeds         = "apply-seeds"
	flagAuthPort           = "auth-port"
	flagStoragePort        = "storage-port"
	flagsFunctionsPort     = "functions-port"
	flagsHasuraPort        = "hasura-port"
	flagsHasuraConsolePort = "hasura-console-port"
	flagDashboardVersion   = "dashboard-version"
	flagConfigserverImage  = "configserver-image"
	flagRunService         = "run-service"
	flagRunServiceVolume   = "run-service-volume"
	flagDownOnError        = "down-on-error"
	flagCACertificates     = "ca-certificates"
)

const (
	defaultHTTPPort     = 443
	defaultPostgresPort = 5432
)

func CommandUp() *cli.Command { //nolint:funlen
	return &cli.Command{ //nolint:exhaustruct
		Name:    "up",
		Aliases: []string{},
		Usage:   "Start local development environment",
		Action:  commandUp,
		Flags: []cli.Flag{
			&cli.UintFlag{ //nolint:exhaustruct
				Name:    flagHTTPPort,
				Usage:   "HTTP port to listen on",
				Value:   defaultHTTPPort,
				Sources: cli.EnvVars("NHOST_HTTP_PORT"),
			},
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:    flagDisableTLS,
				Usage:   "Disable TLS",
				Value:   false,
				Sources: cli.EnvVars("NHOST_DISABLE_TLS"),
			},
			&cli.UintFlag{ //nolint:exhaustruct
				Name:    flagPostgresPort,
				Usage:   "Postgres port to listen on",
				Value:   defaultPostgresPort,
				Sources: cli.EnvVars("NHOST_POSTGRES_PORT"),
			},
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:    flagApplySeeds,
				Usage:   "Apply seeds. If the .nhost folder does not exist, seeds will be applied regardless of this flag",
				Value:   false,
				Sources: cli.EnvVars("NHOST_APPLY_SEEDS"),
			},
			&cli.UintFlag{ //nolint:exhaustruct
				Name:  flagAuthPort,
				Usage: "If specified, expose auth on this port. Not recommended",
				Value: 0,
			},
			&cli.UintFlag{ //nolint:exhaustruct
				Name:  flagStoragePort,
				Usage: "If specified, expose storage on this port. Not recommended",
				Value: 0,
			},
			&cli.UintFlag{ //nolint:exhaustruct
				Name:  flagsFunctionsPort,
				Usage: "If specified, expose functions on this port. Not recommended",
				Value: 0,
			},
			&cli.UintFlag{ //nolint:exhaustruct
				Name:  flagsHasuraPort,
				Usage: "If specified, expose hasura on this port. Not recommended",
				Value: 0,
			},
			&cli.UintFlag{ //nolint:exhaustruct
				Name:  flagsHasuraConsolePort,
				Usage: "If specified, expose hasura console on this port. Not recommended",
				Value: 0,
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagDashboardVersion,
				Usage:   "Dashboard version to use",
				Value:   "nhost/dashboard:2.55.0",
				Sources: cli.EnvVars("NHOST_DASHBOARD_VERSION"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagConfigserverImage,
				Hidden:  true,
				Value:   "",
				Sources: cli.EnvVars("NHOST_CONFIGSERVER_IMAGE"),
			},
			&cli.StringSliceFlag{ //nolint:exhaustruct
				Name:    flagRunService,
				Usage:   "Run service to add to the development environment. Can be passed multiple times. Comma-separated values are also accepted. Format: /path/to/run-service.toml[:overlay_name]", //nolint:lll
				Sources: cli.EnvVars("NHOST_RUN_SERVICE"),
			},
			&cli.StringSliceFlag{ //nolint:exhaustruct
				Name:    flagRunServiceVolume,
				Usage:   "Mount a local directory into a run service container. Format: service-name=/local/path:/container/path. Can be passed multiple times", //nolint:lll
				Sources: cli.EnvVars("NHOST_RUN_SERVICE_VOLUME"),
			},
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:    flagDownOnError,
				Usage:   "Skip confirmation",
				Sources: cli.EnvVars("NHOST_YES"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagCACertificates,
				Usage:   "Mounts and everrides path to CA certificates in the containers",
				Sources: cli.EnvVars("NHOST_CA_CERTIFICATES"),
			},
		},
		Commands: []*cli.Command{
			CommandCloud(),
		},
	}
}

func commandUp(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	// projname to be root directory

	if !clienv.PathExists(ce.Path.NhostToml()) {
		return errors.New( //nolint:err113
			"no nhost project found, please run `nhost init` or `nhost config pull`",
		)
	}

	if !clienv.PathExists(ce.Path.Secrets()) {
		return errors.New( //nolint:err113
			"no secrets found, please run `nhost init` or `nhost config pull`",
		)
	}

	configserverImage := cmd.String(flagConfigserverImage)
	if configserverImage == "" {
		configserverImage = "nhost/cli:" + cmd.Root().Version
	}

	applySeeds := cmd.Bool(flagApplySeeds) || !clienv.PathExists(ce.Path.DotNhostFolder())

	return Up(
		ctx,
		ce,
		cmd.Root().Version,
		cmd.Uint(flagHTTPPort),
		!cmd.Bool(flagDisableTLS),
		cmd.Uint(flagPostgresPort),
		applySeeds,
		dockercompose.ExposePorts{
			Auth:      cmd.Uint(flagAuthPort),
			Storage:   cmd.Uint(flagStoragePort),
			Graphql:   cmd.Uint(flagsHasuraPort),
			Console:   cmd.Uint(flagsHasuraConsolePort),
			Functions: cmd.Uint(flagsFunctionsPort),
		},
		cmd.String(flagDashboardVersion),
		configserverImage,
		cmd.String(flagCACertificates),
		cmd.StringSlice(flagRunService),
		cmd.StringSlice(flagRunServiceVolume),
		cmd.Bool(flagDownOnError),
	)
}

func migrations(
	ctx context.Context,
	ce *clienv.CliEnv,
	dc *dockercompose.DockerCompose,
	endpoint string,
	applySeeds bool,
) error {
	if clienv.PathExists(filepath.Join(ce.Path.NhostFolder(), "migrations", "default")) {
		ce.Infoln("Applying migrations...")

		if err := dc.ApplyMigrations(ctx, endpoint); err != nil {
			return fmt.Errorf("failed to apply migrations: %w", err)
		}
	} else {
		ce.Warnln(
			"No migrations found, make sure this is intentional or it could lead to unexpected behavior",
		)
	}

	if clienv.PathExists(filepath.Join(ce.Path.NhostFolder(), "metadata", "version.yaml")) {
		ce.Infoln("Applying metadata...")

		if err := dc.ApplyMetadata(ctx, endpoint); err != nil {
			return fmt.Errorf("failed to apply metadata: %w", err)
		}
	} else {
		ce.Warnln(
			"No metadata found, make sure this is intentional or it could lead to unexpected behavior",
		)
	}

	if applySeeds {
		if clienv.PathExists(filepath.Join(ce.Path.NhostFolder(), "seeds", "default")) {
			ce.Infoln("Applying seeds...")

			if err := dc.ApplySeeds(ctx, endpoint); err != nil {
				return fmt.Errorf("failed to apply seeds: %w", err)
			}
		}
	}

	return nil
}

func restart(
	ctx context.Context,
	ce *clienv.CliEnv,
	dc *dockercompose.DockerCompose,
	composeFile *dockercompose.ComposeFile,
) error {
	ce.Infoln("Restarting services to reapply metadata if needed...")

	args := []string{"restart"}

	if _, ok := composeFile.Services["storage"]; ok {
		args = append(args, "storage")
	}

	if _, ok := composeFile.Services["auth"]; ok {
		args = append(args, "auth")
	}

	if _, ok := composeFile.Services["ai"]; ok {
		args = append(args, "ai")
	}

	if _, ok := composeFile.Services["functions"]; ok {
		args = append(args, "functions")
	}

	if err := dc.Wrapper(ctx, args...); err != nil {
		return fmt.Errorf("failed to restart services: %w", err)
	}

	ce.Infoln("Verifying services are healthy...")

	// this ensures that all services are healthy before returning
	if err := dc.Start(ctx); err != nil {
		return fmt.Errorf("failed to wait services: %w", err)
	}

	return nil
}

func reload(
	ctx context.Context,
	ce *clienv.CliEnv,
	dc *dockercompose.DockerCompose,
) error {
	ce.Infoln("Reapplying metadata...")

	if err := dc.ReloadMetadata(ctx); err != nil {
		return fmt.Errorf("failed to reapply metadata: %w", err)
	}

	return nil
}

func parseRunServiceConfigFlag(value string) (string, string, error) {
	parts := strings.Split(value, ":")
	switch len(parts) {
	case 1:
		return parts[0], "", nil
	case 2: //nolint:mnd
		return parts[0], parts[1], nil
	default:
		return "", "", fmt.Errorf( //nolint:err113
			"invalid run service format, must be /path/to/config.toml:overlay_name, got %s",
			value,
		)
	}
}

func parseRunServiceOverride(value string) (string, string, error) {
	before, after, ok := strings.Cut(value, "=")
	if !ok {
		return "", "", fmt.Errorf( //nolint:err113
			"invalid format, must be service-name=value, got %s",
			value,
		)
	}

	return before, after, nil
}

func parseRunServiceVolumes(
	flags []string,
) (map[string][]dockercompose.Volume, error) {
	result := make(map[string][]dockercompose.Volume, len(flags))

	for _, flag := range flags {
		name, vol, err := parseRunServiceOverride(flag)
		if err != nil {
			return nil, fmt.Errorf("invalid --run-service-volume: %w", err)
		}

		parts := strings.SplitN(vol, ":", 2) //nolint:mnd
		if len(parts) != 2 {                 //nolint:mnd
			return nil, fmt.Errorf( //nolint:err113
				"invalid volume format, must be /local/path:/container/path, got %s",
				vol,
			)
		}

		absSource, err := filepath.Abs(parts[0])
		if err != nil {
			return nil, fmt.Errorf("failed to resolve volume path %s: %w", parts[0], err)
		}

		result[name] = append(result[name], dockercompose.Volume{
			Type:     "bind",
			Source:   absSource,
			Target:   parts[1],
			ReadOnly: new(false),
		})
	}

	return result, nil
}

func processRunServices(
	ce *clienv.CliEnv,
	runServices []string,
	runServiceVolumes []string,
	secrets model.Secrets,
) ([]*dockercompose.RunService, error) {
	volOverrides, err := parseRunServiceVolumes(runServiceVolumes)
	if err != nil {
		return nil, err
	}

	r := make([]*dockercompose.RunService, 0, len(runServices))
	for _, runService := range runServices {
		cfgPath, overlayName, err := parseRunServiceConfigFlag(runService)
		if err != nil {
			return nil, err
		}

		cfg, err := run.Validate(ce, cfgPath, overlayName, secrets, false)
		if err != nil {
			return nil, fmt.Errorf("failed to validate run service %s: %w", cfgPath, err)
		}

		svc := &dockercompose.RunService{
			Path:       cfgPath,
			Config:     cfg,
			BindMounts: volOverrides[cfg.GetName()],
		}

		r = append(r, svc)
	}

	return r, nil
}

func up( //nolint:funlen,cyclop
	ctx context.Context,
	ce *clienv.CliEnv,
	appVersion string,
	dc *dockercompose.DockerCompose,
	docker *dockercompose.Docker,
	r tui.ProgressReporter,
	httpPort uint,
	useTLS bool,
	postgresPort uint,
	applySeeds bool,
	ports dockercompose.ExposePorts,
	dashboardVersion string,
	configserverImage string,
	caCertificatesPath string,
	runServices []string,
	runServiceVolumes []string,
) error {
	ctx, cancel := context.WithCancel(ctx)

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM, os.Interrupt)

	go func() {
		<-sigChan
		cancel()
	}()

	var secrets model.Secrets
	if err := clienv.UnmarshalFile(ce.Path.Secrets(), &secrets, env.Unmarshal); err != nil {
		return fmt.Errorf(
			"failed to parse secrets, make sure secret values are between quotes: %w",
			err,
		)
	}

	cfg, err := config.Validate(ce, "local", secrets)
	if err != nil {
		return fmt.Errorf("failed to validate config: %w", err)
	}

	r.StartPhase("Checking versions")

	ctxWithTimeout, cancel := context.WithTimeout(ctx, 5*time.Second) //nolint:mnd
	defer cancel()

	if err := software.CheckVersions(ctxWithTimeout, ce, cfg, appVersion); err != nil {
		ce.Warnln("Problem verifying recommended versions: %s", err.Error())
	}

	r.EndPhase()

	runServicesCfg, err := processRunServices(
		ce, runServices, runServiceVolumes, secrets,
	)
	if err != nil {
		return err
	}

	r.StartPhase("Setting up environment")

	composeFile, err := dockercompose.ComposeFileFromConfig(
		cfg,
		ce.LocalSubdomain(),
		ce.ProjectName(),
		httpPort,
		useTLS,
		postgresPort,
		ce.Path.NhostFolder(),
		ce.Path.DotNhostFolder(),
		ce.Path.Root(),
		ports,
		ce.Branch(),
		dashboardVersion,
		configserverImage,
		clienv.PathExists(ce.Path.Functions()),
		caCertificatesPath,
		runServicesCfg...,
	)
	if err != nil {
		r.FailPhase(err)
		return fmt.Errorf("failed to generate docker-compose.yaml: %w", err)
	}

	if err := dc.WriteComposeFile(composeFile); err != nil {
		r.FailPhase(err)
		return fmt.Errorf("failed to write docker-compose.yaml: %w", err)
	}

	r.EndPhase()

	r.StartPhase("Starting services")

	if err = dc.Start(ctx); err != nil {
		r.FailPhase(err)
		return fmt.Errorf("failed to start Nhost development environment: %w", err)
	}

	r.EndPhase()

	r.StartPhase("Applying migrations")

	if err := migrations(ctx, ce, dc, "http://graphql:8080", applySeeds); err != nil {
		r.FailPhase(err)
		return err
	}

	r.EndPhase()

	r.StartPhase("Restarting services")

	if err := restart(ctx, ce, dc, composeFile); err != nil {
		r.FailPhase(err)
		return err
	}

	r.EndPhase()

	r.StartPhase("Downloading metadata")

	if err := docker.HasuraWrapper(
		ctx,
		ce.LocalSubdomain(),
		ce.Path.NhostFolder(),
		*cfg.Hasura.Version,
		"metadata", "export",
		"--skip-update-check",
		"--log-level", "ERROR",
		"--endpoint", dockercompose.URL(ce.LocalSubdomain(), "hasura", httpPort, useTLS),
		"--admin-secret", cfg.Hasura.AdminSecret,
	); err != nil {
		r.FailPhase(err)
		return fmt.Errorf("failed to create metadata: %w", err)
	}

	r.EndPhase()

	r.StartPhase("Reloading metadata")

	if err := reload(ctx, ce, dc); err != nil {
		r.FailPhase(err)
		return err
	}

	r.EndPhase()

	r.Complete("")

	return nil
}

func printInfo(
	subdomain string,
	httpPort, postgresPort uint,
	useTLS bool,
	runServices []*dockercompose.RunService,
) {
	dim := lipgloss.NewStyle().Foreground(clienv.ANSIColorDim)
	bullet := lipgloss.NewStyle().Foreground(clienv.ANSIColorGreen).Render("●")
	urlStyle := lipgloss.NewStyle().Underline(true)

	printInfoURLs(subdomain, httpPort, postgresPort, useTLS, dim, bullet, urlStyle)
	printInfoRunServices(runServices, bullet, urlStyle)
	printInfoSDK(subdomain, dim)
}

func printInfoURLs(
	subdomain string,
	httpPort, postgresPort uint,
	useTLS bool,
	dim lipgloss.Style,
	bullet string,
	urlStyle lipgloss.Style,
) {
	fmt.Println("  " + dim.Render("URLs"))

	urls := []struct{ name, url string }{
		{"Postgres", fmt.Sprintf("postgres://postgres:postgres@localhost:%d/local", postgresPort)},
		{"Hasura", dockercompose.URL(subdomain, "hasura", httpPort, useTLS)},
		{"GraphQL", dockercompose.URL(subdomain, "graphql", httpPort, useTLS)},
		{"Auth", dockercompose.URL(subdomain, "auth", httpPort, useTLS)},
		{"Storage", dockercompose.URL(subdomain, "storage", httpPort, useTLS)},
		{"Functions", dockercompose.URL(subdomain, "functions", httpPort, useTLS)},
		{"Dashboard", dockercompose.URL(subdomain, "dashboard", httpPort, useTLS)},
		{"Mailhog", dockercompose.URL(subdomain, "mailhog", httpPort, useTLS)},
	}

	for _, u := range urls {
		fmt.Printf("    %s %-14s %s\n", bullet, u.name, urlStyle.Render(u.url))
	}
}

func printInfoRunServices(
	runServices []*dockercompose.RunService,
	bullet string,
	urlStyle lipgloss.Style,
) {
	for _, svc := range runServices {
		for _, port := range svc.Config.GetPorts() {
			if deptr(port.GetPublish()) {
				svcURL := fmt.Sprintf("%s://localhost:%d", port.GetType(), port.GetPort())
				fmt.Printf("    %s %-14s %s\n",
					bullet, "run-"+svc.Config.Name, urlStyle.Render(svcURL))
			}
		}
	}
}

func printInfoSDK(subdomain string, dim lipgloss.Style) {
	fmt.Println()
	fmt.Println("  " + dim.Render("SDK Configuration"))
	fmt.Printf("    Subdomain:    %s\n", subdomain)
	fmt.Printf("    Region:       local\n")
	fmt.Println()
	fmt.Println("  Run `nhost up` to reload the development environment")
	fmt.Println("  Run `nhost down` to stop the development environment")
	fmt.Println("  Run `nhost logs` to watch the logs")
}

func upErr(
	ce *clienv.CliEnv,
	dc *dockercompose.DockerCompose,
	downOnError bool,
	err error,
) error {
	ce.Warnln("%s", err.Error())

	if !downOnError {
		confirmed, _ := confirmStopDev(ce)
		if !confirmed {
			return nil
		}
	}

	ce.Infoln("Stopping Nhost development environment...")

	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()

	if err := dc.Stop(ctx, false); err != nil {
		ce.Warnln("failed to stop Nhost development environment: %s", err)
	}

	return err
}

func confirmStopDev(ce *clienv.CliEnv) (bool, error) {
	if term.IsTerminal(int(os.Stdout.Fd())) {
		return tui.RunConfirm("Stop development environment?")
	}

	ce.PromptMessage("Do you want to stop Nhost's development environment? [y/N] ")

	resp, err := ce.PromptInput(false)
	if err != nil {
		return false, fmt.Errorf("failed to read input: %w", err)
	}

	return resp == "y" || resp == "Y", nil
}

func Up(
	ctx context.Context,
	ce *clienv.CliEnv,
	appVersion string,
	httpPort uint,
	useTLS bool,
	postgresPort uint,
	applySeeds bool,
	ports dockercompose.ExposePorts,
	dashboardVersion string,
	configserverImage string,
	caCertificatesPath string,
	runServices []string,
	runServiceVolumes []string,
	downOnError bool,
) error {
	isTTY := term.IsTerminal(int(os.Stdout.Fd()))
	if isTTY {
		return upWithTUI(
			ctx, ce, appVersion, httpPort, useTLS, postgresPort,
			applySeeds, ports, dashboardVersion, configserverImage,
			caCertificatesPath, runServices, runServiceVolumes, downOnError,
		)
	}

	return upWithText(
		ctx, ce, appVersion, httpPort, useTLS, postgresPort,
		applySeeds, ports, dashboardVersion, configserverImage,
		caCertificatesPath, runServices, runServiceVolumes, downOnError,
	)
}

func upWithText(
	ctx context.Context,
	ce *clienv.CliEnv,
	appVersion string,
	httpPort uint,
	useTLS bool,
	postgresPort uint,
	applySeeds bool,
	ports dockercompose.ExposePorts,
	dashboardVersion string,
	configserverImage string,
	caCertificatesPath string,
	runServices []string,
	runServiceVolumes []string,
	downOnError bool,
) error {
	dc := dockercompose.New(
		ce.Path.WorkingDir(), ce.Path.DockerCompose(), ce.ProjectName(),
	)
	docker := dockercompose.NewDocker()
	reporter := tui.NewTextReporter(ce)

	if err := up(
		ctx, ce, appVersion, dc, docker, reporter, httpPort, useTLS,
		postgresPort, applySeeds, ports, dashboardVersion,
		configserverImage, caCertificatesPath, runServices,
		runServiceVolumes,
	); err != nil {
		return upErr(ce, dc, downOnError, err) //nolint:contextcheck
	}

	return nil
}

func upWithTUI(
	ctx context.Context,
	ce *clienv.CliEnv,
	appVersion string,
	httpPort uint,
	useTLS bool,
	postgresPort uint,
	applySeeds bool,
	ports dockercompose.ExposePorts,
	dashboardVersion string,
	configserverImage string,
	caCertificatesPath string,
	runServices []string,
	runServiceVolumes []string,
	downOnError bool,
) error {
	dc := dockercompose.NewWithWriters(
		ce.Path.WorkingDir(), ce.Path.DockerCompose(), ce.ProjectName(),
		io.Discard, io.Discard, strings.NewReader(""),
	)
	ce.SetStdout(io.Discard)

	appCfg := tui.AppConfig{
		DC:           dc,
		Subdomain:    ce.LocalSubdomain(),
		HTTPPort:     httpPort,
		UseTLS:       useTLS,
		PostgresPort: postgresPort,
		ProjectName:  ce.ProjectName(),
	}

	docker := dockercompose.NewDockerWithWriters(
		io.Discard, io.Discard, strings.NewReader(""),
	)

	err := tui.RunApp(ctx, appCfg, func(r tui.ProgressReporter) error {
		return up(
			ctx, ce, appVersion, dc, docker, r, httpPort, useTLS,
			postgresPort, applySeeds, ports, dashboardVersion,
			configserverImage, caCertificatesPath, runServices,
			runServiceVolumes,
		)
	})

	ce.SetStdout(os.Stdout)

	if err != nil {
		return upErr(ce, dc, downOnError, err) //nolint:contextcheck
	}

	return nil
}
