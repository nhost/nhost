package dev

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/nhost/cli/clienv"
	"github.com/nhost/cli/cmd/config"
	"github.com/nhost/cli/dockercompose"
	"github.com/urfave/cli/v2"
)

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
)

const (
	defaultHTTPPort     = 443
	defaultPostgresPort = 5432
)

func CommandUp() *cli.Command {
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
				EnvVars: []string{"NHOST_HTTP_PORT"},
			},
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:    flagDisableTLS,
				Usage:   "Disable TLS",
				Value:   false,
				EnvVars: []string{"NHOST_DISABLE_TLS"},
			},
			&cli.UintFlag{ //nolint:exhaustruct
				Name:    flagPostgresPort,
				Usage:   "Postgres port to listen on",
				Value:   defaultPostgresPort,
				EnvVars: []string{"NHOST_POSTGRES_PORT"},
			},
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:    flagApplySeeds,
				Usage:   "Apply seeds. If the .nhost folder does not exist, seeds will be applied regardless of this flag",
				Value:   false,
				EnvVars: []string{"NHOST_APPLY_SEEDS"},
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
		},
	}
}

func commandUp(cCtx *cli.Context) error {
	ce := clienv.FromCLI(cCtx)

	// projname to be root directory

	if !clienv.PathExists(ce.Path.NhostToml()) {
		return fmt.Errorf( //nolint:goerr113
			"no nhost project found, please run `nhost init` or `nhost config pull`",
		)
	}
	if !clienv.PathExists(ce.Path.Secrets()) {
		return fmt.Errorf( //nolint:goerr113
			"no secrets found, please run `nhost init` or `nhost config pull`",
		)
	}

	applySeeds := cCtx.Bool(flagApplySeeds) || !clienv.PathExists(ce.Path.DotNhostFolder())
	return Up(
		cCtx.Context,
		ce,
		cCtx.Uint(flagHTTPPort),
		!cCtx.Bool(flagDisableTLS),
		cCtx.Uint(flagPostgresPort),
		applySeeds,
		dockercompose.ExposePorts{
			Auth:      cCtx.Uint(flagAuthPort),
			Storage:   cCtx.Uint(flagStoragePort),
			Graphql:   cCtx.Uint(flagsHasuraPort),
			Console:   cCtx.Uint(flagsHasuraConsolePort),
			Functions: cCtx.Uint(flagsFunctionsPort),
		},
	)
}

func migrations(
	ctx context.Context,
	ce *clienv.CliEnv,
	dc *dockercompose.DockerCompose,
	applySeeds bool,
) error {
	if clienv.PathExists(filepath.Join(ce.Path.NhostFolder(), "migrations", "default")) {
		ce.Infoln("Applying migrations...")
		if err := dc.ApplyMigrations(ctx); err != nil {
			return fmt.Errorf("failed to apply migrations: %w", err)
		}
	}

	if clienv.PathExists(filepath.Join(ce.Path.NhostFolder(), "metadata", "version.yaml")) {
		ce.Infoln("Applying metadata...")
		if err := dc.ApplyMetadata(ctx); err != nil {
			return fmt.Errorf("failed to apply metadata: %w", err)
		}
	}

	if applySeeds {
		if clienv.PathExists(filepath.Join(ce.Path.NhostFolder(), "seeds", "default")) {
			ce.Infoln("Applying seeds...")
			if err := dc.ApplySeeds(ctx); err != nil {
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
) error {
	ce.Infoln("Restarting services to reapply metadata if needed...")
	if err := dc.Wrapper(ctx, "restart", "auth", "storage", "functions"); err != nil {
		return fmt.Errorf("failed to restart services: %w", err)
	}

	return nil
}

func up( //nolint:funlen
	ctx context.Context,
	ce *clienv.CliEnv,
	dc *dockercompose.DockerCompose,
	httpPort uint,
	useTLS bool,
	postgresPort uint,
	applySeeds bool,
	ports dockercompose.ExposePorts,
) error {
	ctx, cancel := context.WithCancel(ctx)

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM, os.Interrupt)
	go func() {
		<-sigChan
		cancel()
	}()

	cfg, err := config.Validate(ce, "local")
	if err != nil {
		return fmt.Errorf("failed to validate config: %w", err)
	}

	ce.Infoln("Setting up Nhost development environment...")
	composeFile, err := dockercompose.ComposeFileFromConfig(
		cfg,
		ce.ProjectName(),
		httpPort,
		useTLS,
		postgresPort,
		ce.Path.DataFolder(),
		ce.Path.NhostFolder(),
		ce.Path.DotNhostFolder(),
		ce.Path.Root(),
		ports,
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

	if err := migrations(ctx, ce, dc, applySeeds); err != nil {
		return err
	}

	if err := restart(ctx, ce, dc); err != nil {
		return err
	}

	docker := dockercompose.NewDocker()
	ce.Infoln("Downloading metadata")
	if err := docker.HasuraWrapper(
		ctx, ce.Path.NhostFolder(),
		*cfg.Hasura.Version,
		"metadata", "export",
		"--skip-update-check",
		"--log-level", "ERROR",
		"--endpoint", dockercompose.URL("hasura", httpPort, useTLS),
		"--admin-secret", cfg.Hasura.AdminSecret,
	); err != nil {
		return fmt.Errorf("failed to create metadata: %w", err)
	}

	ce.Infoln("Nhost development environment started.")
	printInfo(ce, httpPort, postgresPort, useTLS)
	return nil
}

func printInfo(ce *clienv.CliEnv, httpPort, postgresPort uint, useTLS bool) {
	ce.Println("URLs:")
	ce.Println(
		"- Postgres:             postgres://postgres:postgres@localhost:%d/local",
		postgresPort,
	)
	ce.Println("- Hasura:               %s", dockercompose.URL("hasura", httpPort, useTLS))
	ce.Println("- GraphQL:              %s", dockercompose.URL("graphql", httpPort, useTLS))
	ce.Println("- Auth:                 %s", dockercompose.URL("auth", httpPort, useTLS))
	ce.Println("- Storage:              %s", dockercompose.URL("storage", httpPort, useTLS))
	ce.Println("- Functions:            %s", dockercompose.URL("functions", httpPort, useTLS))
	ce.Println("- Dashboard:            %s", dockercompose.URL("dashboard", httpPort, useTLS))
	ce.Println("- Mailhog:              %s", dockercompose.URL("mailhog", httpPort, useTLS))
	ce.Println("")
	ce.Println("SDK Configuration:")
	ce.Println(" Subdomain:             local")
	ce.Println(" Region:                (empty)")
	ce.Println("")
	ce.Println("Run `nhost up` to reload the development environment")
	ce.Println("Run `nhost down` to stop the development environment")
	ce.Println("Run `nhost logs` to watch the logs")
}

func Up(
	ctx context.Context,
	ce *clienv.CliEnv,
	httpPort uint,
	useTLS bool,
	postgresPort uint,
	applySeeds bool,
	ports dockercompose.ExposePorts,
) error {
	dc := dockercompose.New(ce.Path.WorkingDir(), ce.Path.DockerCompose(), ce.ProjectName())

	if err := up(
		ctx, ce, dc, httpPort, useTLS, postgresPort, applySeeds, ports,
	); err != nil {
		ce.Warnln(err.Error())

		ce.PromptMessage("Do you want to stop Nhost's development environment? [y/N] ")
		resp, err := ce.PromptInput(false)
		if err != nil {
			ce.Warnln("failed to read input: %s", err)
			return nil
		}
		if resp != "y" && resp != "Y" {
			return nil
		}

		ce.Infoln("Stopping Nhost development environment...")
		ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
		defer cancel()

		if err := dc.Stop(ctx); err != nil { //nolint:contextcheck
			ce.Warnln("failed to stop Nhost development environment: %s", err)
		}

		return err //nolint:wrapcheck
	}

	return nil
}
