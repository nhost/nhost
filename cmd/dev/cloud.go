package dev

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"text/tabwriter"
	"time"

	"github.com/nhost/cli/clienv"
	"github.com/nhost/cli/cmd/config"
	"github.com/nhost/cli/cmd/software"
	"github.com/nhost/cli/dockercompose"
	"github.com/nhost/cli/nhostclient/graphql"
	"github.com/urfave/cli/v2"
)

const (
	flagSubdomain   = "subdomain"
	flagPostgresURL = "postgres-url"
)

func CommandCloud() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "cloud",
		Aliases: []string{},
		Usage:   "Start local development environment connected to an Nhost Cloud project (BETA)",
		Action:  commandCloud,
		Flags: []cli.Flag{
			&cli.UintFlag{ //nolint:exhaustruct
				Name:    flagHTTPPort,
				Usage:   "HTTP port to listen on",
				Value:   defaultHTTPPort,
				EnvVars: []string{"NHOST_HTTP_PORT"},
			},
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:    flagDisableTLS,
				Usage:   "Disable TLS",
				Value:   false,
				EnvVars: []string{"NHOST_DISABLE_TLS"},
			},
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:    flagApplySeeds,
				Usage:   "Apply seeds. If the .nhost folder does not exist, seeds will be applied regardless of this flag",
				Value:   false,
				EnvVars: []string{"NHOST_APPLY_SEEDS"},
			},
			&cli.UintFlag{ //nolint:exhaustruct
				Name:  flagsHasuraConsolePort,
				Usage: "If specified, expose hasura console on this port. Not recommended",
				Value: 0,
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagDashboardVersion,
				Usage:   "Dashboard version to use",
				Value:   "nhost/dashboard:2.33.0",
				EnvVars: []string{"NHOST_DASHBOARD_VERSION"},
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagConfigserverImage,
				Hidden:  true,
				Value:   "",
				EnvVars: []string{"NHOST_CONFIGSERVER_IMAGE"},
			},
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:    flagDownOnError,
				Usage:   "Skip confirmation",
				EnvVars: []string{"NHOST_YES"},
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagCACertificates,
				Usage:   "Mounts and everrides path to CA certificates in the containers",
				EnvVars: []string{"NHOST_CA_CERTIFICATES"},
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagSubdomain,
				Usage:   "Project's subdomain to operate on, defaults to linked project",
				EnvVars: []string{"NHOST_SUBDOMAIN"},
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagPostgresURL,
				Usage:    "Postgres URL",
				Required: true,
				EnvVars:  []string{"NHOST_POSTGRES_URL"},
			},
		},
	}
}

func commandCloud(cCtx *cli.Context) error {
	ce := clienv.FromCLI(cCtx)

	if !clienv.PathExists(ce.Path.NhostToml()) {
		return errors.New( //nolint:goerr113
			"no nhost project found, please run `nhost init` or `nhost config pull`",
		)
	}
	if !clienv.PathExists(ce.Path.Secrets()) {
		return errors.New( //nolint:goerr113
			"no secrets found, please run `nhost init` or `nhost config pull`",
		)
	}

	proj, err := ce.GetAppInfo(cCtx.Context, cCtx.String(flagSubdomain))
	if err != nil {
		return fmt.Errorf("failed to get app info: %w", err)
	}

	configserverImage := cCtx.String(flagConfigserverImage)
	if configserverImage == "" {
		configserverImage = "nhost/cli:" + cCtx.App.Version
	}

	applySeeds := cCtx.Bool(flagApplySeeds)
	return Cloud(
		cCtx.Context,
		ce,
		cCtx.App.Version,
		cCtx.Uint(flagHTTPPort),
		!cCtx.Bool(flagDisableTLS),
		applySeeds,
		dockercompose.ExposePorts{
			Auth:      cCtx.Uint(flagAuthPort),
			Storage:   cCtx.Uint(flagStoragePort),
			Graphql:   cCtx.Uint(flagsHasuraPort),
			Console:   cCtx.Uint(flagsHasuraConsolePort),
			Functions: cCtx.Uint(flagsFunctionsPort),
		},
		cCtx.String(flagDashboardVersion),
		configserverImage,
		cCtx.String(flagCACertificates),
		cCtx.Bool(flagDownOnError),
		proj,
		cCtx.String(flagPostgresURL),
	)
}

func cloud( //nolint:funlen
	ctx context.Context,
	ce *clienv.CliEnv,
	appVersion string,
	dc *dockercompose.DockerCompose,
	httpPort uint,
	useTLS bool,
	applySeeds bool,
	ports dockercompose.ExposePorts,
	dashboardVersion string,
	configserverImage string,
	caCertificatesPath string,
	proj *graphql.AppSummaryFragment,
	postgresURL string,
) error {
	ctx, cancel := context.WithCancel(ctx)

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM, os.Interrupt)
	go func() {
		<-sigChan
		cancel()
	}()

	ce.Infoln("Validating configuration...")
	cfg, cfgSecrets, err := config.ValidateRemote(
		ctx,
		ce,
		proj.GetSubdomain(),
		proj.GetID(),
	)
	if err != nil {
		return fmt.Errorf("failed to validate configuration: %w", err)
	}

	ctxWithTimeout, cancel := context.WithTimeout(ctx, 5*time.Second) //nolint:mnd
	defer cancel()
	ce.Infoln("Checking versions...")
	if err := software.CheckVersions(ctxWithTimeout, ce, cfg, appVersion); err != nil {
		ce.Warnln("Problem verifying recommended versions: %s", err.Error())
	}

	ce.Infoln("Setting up Nhost development environment...")
	composeFile, err := dockercompose.CloudComposeFileFromConfig(
		cfg,
		ce.LocalSubdomain(),
		proj.GetSubdomain(),
		proj.GetRegion().GetName(),
		cfgSecrets.Hasura.GetAdminSecret(),
		postgresURL,
		ce.ProjectName(),
		httpPort,
		useTLS,
		ce.Path.NhostFolder(),
		ce.Path.DotNhostFolder(),
		ce.Path.Root(),
		ports,
		dashboardVersion,
		configserverImage,
		caCertificatesPath,
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

	ce.Infoln("Applying configuration to Nhost Cloud project...")
	if err = config.Apply(ctx, ce, proj.GetID(), cfg, true); err != nil {
		return fmt.Errorf("failed to apply configuration: %w", err)
	}

	endpoint := fmt.Sprintf(
		"https://%s.hasura.%s.nhost.run",
		proj.GetSubdomain(), proj.GetRegion().GetName(),
	)

	if err := migrations(ctx, ce, dc, endpoint, applySeeds); err != nil {
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
		"--endpoint", endpoint,
		"--admin-secret", cfgSecrets.Hasura.GetAdminSecret(),
	); err != nil {
		return fmt.Errorf("failed to create metadata: %w", err)
	}

	ce.Infoln("Nhost development environment started.")
	printCloudInfo(ce.LocalSubdomain(), httpPort, useTLS)
	return nil
}

func printCloudInfo(
	subdomain string,
	httpPort uint,
	useTLS bool,
) {
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 4, ' ', 0) //nolint:mnd
	fmt.Fprintf(w, "URLs:\n")
	fmt.Fprintf(w, "- Console:\t\t%s\n", dockercompose.URL(
		subdomain, "hasura", httpPort, useTLS))
	fmt.Fprintf(w, "- Dashboard:\t\t%s\n", dockercompose.URL(
		subdomain, "dashboard", httpPort, useTLS))

	w.Flush()
}

func Cloud(
	ctx context.Context,
	ce *clienv.CliEnv,
	appVersion string,
	httpPort uint,
	useTLS bool,
	applySeeds bool,
	ports dockercompose.ExposePorts,
	dashboardVersion string,
	configserverImage string,
	caCertificatesPath string,
	downOnError bool,
	proj *graphql.AppSummaryFragment,
	postgresURL string,
) error {
	dc := dockercompose.New(ce.Path.WorkingDir(), ce.Path.DockerCompose(), ce.ProjectName())

	if err := cloud(
		ctx,
		ce,
		appVersion,
		dc,
		httpPort,
		useTLS,
		applySeeds,
		ports,
		dashboardVersion,
		configserverImage,
		caCertificatesPath,
		proj,
		postgresURL,
	); err != nil {
		return upErr(ce, dc, downOnError, err) //nolint:contextcheck
	}

	return nil
}
