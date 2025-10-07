package dev

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"text/tabwriter"
	"time"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/cmd/config"
	"github.com/nhost/nhost/cli/cmd/run"
	"github.com/nhost/nhost/cli/cmd/software"
	"github.com/nhost/nhost/cli/dockercompose"
	"github.com/nhost/nhost/cli/project/env"
	"github.com/urfave/cli/v3"
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
				Value:   "nhost/dashboard:2.38.3",
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
		ce.Warnln("No migrations found, make sure this is intentional or it could lead to unexpected behavior")
	}

	if clienv.PathExists(filepath.Join(ce.Path.NhostFolder(), "metadata", "version.yaml")) {
		ce.Infoln("Applying metadata...")

		if err := dc.ApplyMetadata(ctx, endpoint); err != nil {
			return fmt.Errorf("failed to apply metadata: %w", err)
		}
	} else {
		ce.Warnln("No metadata found, make sure this is intentional or it could lead to unexpected behavior")
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

func processRunServices(
	ce *clienv.CliEnv,
	runServices []string,
	secrets model.Secrets,
) ([]*dockercompose.RunService, error) {
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

		r = append(r, &dockercompose.RunService{
			Path:   cfgPath,
			Config: cfg,
		})
	}

	return r, nil
}

func up( //nolint:funlen,cyclop
	ctx context.Context,
	ce *clienv.CliEnv,
	appVersion string,
	dc *dockercompose.DockerCompose,
	httpPort uint,
	useTLS bool,
	postgresPort uint,
	applySeeds bool,
	ports dockercompose.ExposePorts,
	dashboardVersion string,
	configserverImage string,
	caCertificatesPath string,
	runServices []string,
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

	ctxWithTimeout, cancel := context.WithTimeout(ctx, 5*time.Second) //nolint:mnd
	defer cancel()

	ce.Infoln("Checking versions...")

	if err := software.CheckVersions(ctxWithTimeout, ce, cfg, appVersion); err != nil {
		ce.Warnln("Problem verifying recommended versions: %s", err.Error())
	}

	runServicesCfg, err := processRunServices(ce, runServices, secrets)
	if err != nil {
		return err
	}

	ce.Infoln("Setting up Nhost development environment...")

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
		return fmt.Errorf("failed to generate docker-compose.yaml: %w", err)
	}

	if err := dc.WriteComposeFile(composeFile); err != nil {
		return fmt.Errorf("failed to write docker-compose.yaml: %w", err)
	}

	ce.Infoln("Starting Nhost development environment...")

	if err = dc.Start(ctx); err != nil {
		return fmt.Errorf("failed to start Nhost development environment: %w", err)
	}

	if err := migrations(ctx, ce, dc, "http://graphql:8080", applySeeds); err != nil {
		return err
	}

	if err := restart(ctx, ce, dc, composeFile); err != nil {
		return err
	}

	docker := dockercompose.NewDocker()

	ce.Infoln("Downloading metadata...")

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
		return fmt.Errorf("failed to create metadata: %w", err)
	}

	if err := reload(ctx, ce, dc); err != nil {
		return err
	}

	ce.Infoln("Nhost development environment started.")
	printInfo(ce.LocalSubdomain(), httpPort, postgresPort, useTLS, runServicesCfg)

	return nil
}

func printInfo(
	subdomain string,
	httpPort, postgresPort uint,
	useTLS bool,
	runServices []*dockercompose.RunService,
) {
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 4, ' ', 0) //nolint:mnd
	fmt.Fprintf(w, "URLs:\n")
	fmt.Fprintf(w,
		"- Postgres:\t\tpostgres://postgres:postgres@localhost:%d/local\n",
		postgresPort,
	)
	fmt.Fprintf(w, "- Hasura:\t\t%s\n", dockercompose.URL(
		subdomain, "hasura", httpPort, useTLS))
	fmt.Fprintf(w, "- GraphQL:\t\t%s\n", dockercompose.URL(
		subdomain, "graphql", httpPort, useTLS))
	fmt.Fprintf(w, "- Auth:\t\t%s\n", dockercompose.URL(
		subdomain, "auth", httpPort, useTLS))
	fmt.Fprintf(w, "- Storage:\t\t%s\n", dockercompose.URL(
		subdomain, "storage", httpPort, useTLS))
	fmt.Fprintf(w, "- Functions:\t\t%s\n", dockercompose.URL(
		subdomain, "functions", httpPort, useTLS))
	fmt.Fprintf(w, "- Dashboard:\t\t%s\n", dockercompose.URL(
		subdomain, "dashboard", httpPort, useTLS))
	fmt.Fprintf(w, "- Mailhog:\t\t%s\n", dockercompose.URL(
		subdomain, "mailhog", httpPort, useTLS))

	for _, svc := range runServices {
		for _, port := range svc.Config.GetPorts() {
			if deptr(port.GetPublish()) {
				fmt.Fprintf(
					w,
					"- run-%s:\t\tFrom laptop:\t%s://localhost:%d\n",
					svc.Config.Name,
					port.GetType(),
					port.GetPort(),
				)
				fmt.Fprintf(
					w,
					"\t\tFrom services:\t%s://run-%s:%d\n",
					port.GetType(),
					svc.Config.Name,
					port.GetPort(),
				)
			}
		}
	}

	fmt.Fprintf(w, "\n")
	fmt.Fprintf(w, "SDK Configuration:\n")
	fmt.Fprintf(w, " Subdomain:\t%s\n", subdomain)
	fmt.Fprintf(w, " Region:\tlocal\n")
	fmt.Fprintf(w, "")
	fmt.Fprintf(w, "Run `nhost up` to reload the development environment\n")
	fmt.Fprintf(w, "Run `nhost down` to stop the development environment\n")
	fmt.Fprintf(w, "Run `nhost logs` to watch the logs\n")

	w.Flush()
}

func upErr(
	ce *clienv.CliEnv,
	dc *dockercompose.DockerCompose,
	downOnError bool,
	err error,
) error {
	ce.Warnln("%s", err.Error())

	if !downOnError {
		ce.PromptMessage("Do you want to stop Nhost's development environment? [y/N] ")

		resp, err := ce.PromptInput(false)
		if err != nil {
			ce.Warnln("failed to read input: %s", err)
			return nil
		}

		if resp != "y" && resp != "Y" {
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
	downOnError bool,
) error {
	dc := dockercompose.New(ce.Path.WorkingDir(), ce.Path.DockerCompose(), ce.ProjectName())

	if err := up(
		ctx,
		ce,
		appVersion,
		dc,
		httpPort,
		useTLS,
		postgresPort,
		applySeeds,
		ports,
		dashboardVersion,
		configserverImage,
		caCertificatesPath,
		runServices,
	); err != nil {
		return upErr(ce, dc, downOnError, err) //nolint:contextcheck
	}

	return nil
}
