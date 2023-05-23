package dev

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/cli/clienv"
	"github.com/nhost/cli/cmd/config"
	"github.com/nhost/cli/dockercompose"
	"github.com/nhost/cli/project/env"
	"github.com/urfave/cli/v2"
)

const (
	flagHTTPPort     = "http-port"
	flagDisableTLS   = "disable-tls"
	flagPostgresPort = "postgres-port"
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
		},
	}
}

func commandUp(cCtx *cli.Context) error {
	ce := clienv.New(cCtx)

	// projname to be root directory

	if !clienv.PathExists(ce.Path.NhostToml()) {
		return fmt.Errorf( //nolint:goerr113
			"no nhost project found, please run `nhost project init` or `nhost config pull`",
		)
	}
	if !clienv.PathExists(ce.Path.Secrets()) {
		return fmt.Errorf( //nolint:goerr113
			"no secrets found, please run `nhost project init` or `nhost config pull`",
		)
	}

	return Up(
		cCtx.Context,
		ce,
		ce.ProjectName(),
		cCtx.Uint(flagHTTPPort),
		!cCtx.Bool(flagDisableTLS),
		cCtx.Uint(flagPostgresPort),
	)
}

func overrideEnv(ce *clienv.CliEnv, cfg *model.ConfigConfig) error {
	var envDev model.Secrets
	if err := clienv.UnmarshalFile(ce.Path.EnvDevelopment(), &envDev, env.Unmarshal); err != nil {
		return fmt.Errorf("failed to %s: %w", ce.Path.EnvDevelopment(), err)
	}
	for _, genv := range cfg.Global.Environment {
		for _, devenv := range envDev {
			if genv.Name == devenv.Name {
				ce.Warnln("Overriding environment variable %s", genv.Name)
				genv.Value = devenv.Value
			}
		}
	}
	return nil
}

func migrations(ctx context.Context, ce *clienv.CliEnv, dc *dockercompose.DockerCompose) error {
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

	return nil
}

func up(
	ctx context.Context,
	ce *clienv.CliEnv,
	dc *dockercompose.DockerCompose,
	projectName string,
	httpPort uint,
	useTLS bool,
	postgresPort uint,
) error {
	ctx, cancel := context.WithCancel(ctx)

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM, os.Interrupt)
	go func() {
		<-sigChan
		cancel()
	}()

	cfg, err := config.Validate(ce)
	if err != nil {
		return fmt.Errorf("failed to validate config: %w", err)
	}

	if clienv.PathExists(ce.Path.EnvDevelopment()) {
		ce.Infoln("Loading development environment variables...")
		if err := overrideEnv(ce, cfg); err != nil {
			return err
		}
	}

	ce.Infoln("Setting up Nhost development environment...")
	composeFile, err := dockercompose.ComposeFileFromConfig(
		cfg,
		projectName,
		httpPort,
		useTLS,
		postgresPort,
		ce.Path.DataFolder(),
		ce.Path.NhostFolder(),
		ce.Path.DotNhostFolder(),
		ce.Path.Root(),
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

	if err := migrations(ctx, ce, dc); err != nil {
		return err
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
	ce.Println("Run `nhost dev up` to reload the development environment")
	ce.Println("Run `nhost dev down` to stop the development environment")
	ce.Println("Run `nhost dev logs` to watch the logs")
}

func Up(
	ctx context.Context,
	ce *clienv.CliEnv,
	projectName string,
	httpPort uint,
	useTLS bool,
	postgresPort uint,
) error {
	dc := dockercompose.New(ce.Path.DockerCompose(), projectName)

	if err := up(
		ctx, ce, dc, projectName, httpPort, useTLS, postgresPort,
	); err != nil {
		ce.Warnln(err.Error())

		ce.PromptMessage("Do you want to stop Nhost development environment it? [y/N] ")
		resp, err := ce.PromptInput(false)
		if err != nil {
			ce.Warnln("failed to read input: %s", err)
			return nil
		}
		if resp != "y" {
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
